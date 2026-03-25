const User = require('../../models/User');
const OtpToken = require('../../models/OtpToken');
const DeviceSession = require('../../models/DeviceSession');
const LoginEvent = require('../../models/LoginEvent');
const { hashPassword, comparePassword } = require('../../utils/crypto');
const { sendEmail, buildOtpEmailHtml } = require('../../utils/notifications');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[0-9]{7,15}$/;

const PROFILE_SELECT =
  'fullName email phone avatarUrl address city country bio dateOfBirth roles accountType pendingAccountType accountTypeChangeStatus accountTypeChangeReason accountTypeReviewedAt location kycStatus kycStep kycRejectionReason createdAt';
const { buildGeoPoint } = require('../../utils/location');

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function createChangeOtp(userId, currentEmail, purpose, newValue) {
  const code = generateOtpCode();
  const codeHash = await hashPassword(code);
  await OtpToken.create({
    user: userId,
    email: currentEmail,
    purpose,
    newValue,
    codeHash,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });
  return code;
}

async function getProfile(userId) {
  const user = await User.findById(userId).select(PROFILE_SELECT + ' transactionPinHash');
  if (!user) return null;
  const obj = user.toObject();
  obj.hasPIN = !!obj.transactionPinHash;
  delete obj.transactionPinHash;
  return obj;
}

async function getSecurityInfo(userId, currentDeviceId) {
  const user = await User.findById(userId).select('transactionPinHash');

  const sessions = await DeviceSession.find({ user: userId, isBlacklisted: false })
    .sort({ lastSeenAt: -1 })
    .lean();

  const loginHistory = await LoginEvent.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  return {
    hasPIN: !!user?.transactionPinHash,
    sessions: sessions.map((s) => ({
      id: s._id,
      deviceId: s.deviceId,
      deviceModel: s.deviceInfo?.model || 'Unknown device',
      deviceOs: s.deviceInfo?.os || '',
      ip: s.ip || 'Unknown',
      lastSeenAt: s.lastSeenAt,
      createdAt: s.createdAt,
      isCurrent: s.deviceId === currentDeviceId,
    })),
    loginHistory: loginHistory.map((e) => ({
      id: e._id,
      eventType: e.eventType,
      ip: e.ip || 'Unknown',
      deviceModel: e.deviceModel || 'Unknown device',
      deviceOs: e.deviceOs || '',
      createdAt: e.createdAt,
    })),
  };
}

async function revokeSession(userId, sessionDeviceId) {
  const session = await DeviceSession.findOne({ user: userId, deviceId: sessionDeviceId });
  if (!session) throw Object.assign(new Error('Session not found'), { status: 404 });
  session.isBlacklisted = true;
  session.refreshTokenHash = '';
  await session.save();
}

async function revokeOtherSessions(userId, currentDeviceId) {
  await DeviceSession.updateMany(
    { user: userId, deviceId: { $ne: currentDeviceId }, isBlacklisted: false },
    { isBlacklisted: true, refreshTokenHash: '' }
  );
}

async function updateProfile(userId, payload) {
  const allowedFields = ['fullName', 'address', 'city', 'country', 'bio', 'dateOfBirth'];
  const update = {};
  const accountTypes = ['patient', 'doctor', 'hospital_admin', 'pharmacy_admin'];

  allowedFields.forEach((field) => {
    if (payload[field] !== undefined) {
      update[field] = typeof payload[field] === 'string' ? payload[field].trim() : payload[field];
    }
  });

  const user = await User.findById(userId);
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });

  if (payload.accountType !== undefined) {
    const nextType = String(payload.accountType).trim();
    if (!accountTypes.includes(nextType)) {
      throw Object.assign(new Error('Invalid account type'), { status: 400 });
    }
    if (nextType !== user.accountType) {
      user.pendingAccountType = nextType;
      user.accountTypeChangeStatus = 'pending';
      user.accountTypeChangeReason = undefined;
      user.accountTypeReviewedAt = undefined;
      user.accountTypeReviewerId = undefined;
    }
  }

  Object.assign(user, update);
  await user.save();
  return User.findById(userId).select(PROFILE_SELECT);
}

async function updateAvatar(userId, avatarUrl) {
  return User.findByIdAndUpdate(userId, { avatarUrl }, { new: true }).select(PROFILE_SELECT);
}

async function submitKyc(userId, data) {
  const update = {
    bvn: data.bvn,
    kycStatus: 'pending',
    kycSubmittedAt: new Date(),
    kycDocuments: {
      selfieUrl: data.selfieUrl,
      idUrl: data.idUrl,
      idType: data.idType,
    },
    address: data.address,
    city: data.city,
    country: data.country,
  };

  if (data.bankAccounts) update.bankAccounts = data.bankAccounts;

  return User.findByIdAndUpdate(userId, update, { new: true });
}

// ── Contact-change: email (3-step: request → verify old → verify new) ─────────

async function requestEmailChange(userId, newEmail) {
  const normalized = String(newEmail).toLowerCase().trim();

  if (!EMAIL_REGEX.test(normalized)) {
    throw Object.assign(new Error('Invalid email address'), { status: 400 });
  }

  const user = await User.findById(userId);
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });

  if (user.email === normalized) {
    throw Object.assign(new Error('New email must be different from your current email'), { status: 400 });
  }

  const taken = await User.findOne({ email: normalized, _id: { $ne: userId } });
  if (taken) throw Object.assign(new Error('Email already in use by another account'), { status: 400 });

  user.pendingEmail = normalized;
  await user.save();

  // Step 1 of 2: send security code to the OLD email
  const code = await createChangeOtp(userId, user.email, 'email_change_old', normalized);
  const html = buildOtpEmailHtml({
    title: 'Confirm your email change request',
    intro:
      'Someone requested to change the email address on your MedMap account. ' +
      'Use the code below to confirm it was you. This code will expire in 10 minutes.',
    code,
    footer: 'If you did not request this, please secure your account immediately.',
  });
  await sendEmail(user.email, 'Confirm your MedMap email change', html);
}

// Called after the user verifies their old email — sends OTP to the new email
async function verifyOldEmailAndSendNew(userId, code) {
  const user = await User.findById(userId);
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  if (!user.pendingEmail) {
    throw Object.assign(new Error('No pending email change found'), { status: 400 });
  }

  const token = await OtpToken.findOne({ user: userId, purpose: 'email_change_old' })
    .sort({ createdAt: -1 })
    .exec();

  if (!token || token.expiresAt < new Date() || token.consumedAt) {
    throw Object.assign(new Error('Invalid or expired code'), { status: 400 });
  }

  const matches = await comparePassword(String(code).trim(), token.codeHash);
  if (!matches) throw Object.assign(new Error('Invalid or expired code'), { status: 400 });

  token.consumedAt = new Date();
  await token.save();

  // Step 2 of 2: send ownership code to the NEW email
  const newCode = await createChangeOtp(userId, user.email, 'email_change_new', user.pendingEmail);
  const html = buildOtpEmailHtml({
    title: 'Verify your new email address',
    intro:
      'Use the code below to confirm your new MedMap email address. This code will expire in 10 minutes.',
    code: newCode,
    footer: 'If you did not request this change, you can safely ignore this email.',
  });
  await sendEmail(user.pendingEmail, 'Verify your new MedMap email address', html);
}

// Called after the user verifies ownership of the new email — commits the change
async function verifyNewEmailAndCommit(userId, code) {
  const user = await User.findById(userId);
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });

  const token = await OtpToken.findOne({ user: userId, purpose: 'email_change_new' })
    .sort({ createdAt: -1 })
    .exec();

  if (!token || token.expiresAt < new Date() || token.consumedAt) {
    throw Object.assign(new Error('Invalid or expired code'), { status: 400 });
  }

  const matches = await comparePassword(String(code).trim(), token.codeHash);
  if (!matches) throw Object.assign(new Error('Invalid or expired code'), { status: 400 });

  token.consumedAt = new Date();
  await token.save();

  user.email = token.newValue;
  user.pendingEmail = undefined;
  await user.save();

  return User.findById(userId).select(PROFILE_SELECT);
}

// ── Contact-change: phone ─────────────────────────────────────────────────────

async function requestPhoneChange(userId, newPhone) {
  const trimmed = String(newPhone).trim();

  if (!PHONE_REGEX.test(trimmed)) {
    throw Object.assign(new Error('Invalid phone number'), { status: 400 });
  }

  const user = await User.findById(userId);
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });

  if (user.phone === trimmed) {
    throw Object.assign(new Error('New phone must be different from your current phone'), { status: 400 });
  }

  const taken = await User.findOne({ phone: trimmed, _id: { $ne: userId } });
  if (taken) throw Object.assign(new Error('Phone number already in use by another account'), { status: 400 });

  user.pendingPhone = trimmed;
  await user.save();

  // No SMS gateway — verification code is sent to the user's current email
  const code = await createChangeOtp(userId, user.email, 'phone_change', trimmed);
  const html = buildOtpEmailHtml({
    title: 'Confirm your new phone number',
    intro: `Use the code below to confirm changing your MedMap phone number to ${trimmed}. This code will expire in 10 minutes.`,
    code,
    footer: 'If you did not request this change, you can safely ignore this email.',
  });
  await sendEmail(user.email, 'Confirm your MedMap phone number change', html);
}

async function verifyPhoneChange(userId, code) {
  const user = await User.findById(userId);
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });

  const token = await OtpToken.findOne({ user: userId, purpose: 'phone_change' })
    .sort({ createdAt: -1 })
    .exec();

  if (!token || token.expiresAt < new Date() || token.consumedAt) {
    throw Object.assign(new Error('Invalid or expired code'), { status: 400 });
  }

  const matches = await comparePassword(String(code).trim(), token.codeHash);
  if (!matches) throw Object.assign(new Error('Invalid or expired code'), { status: 400 });

  token.consumedAt = new Date();
  await token.save();

  user.phone = token.newValue;
  user.pendingPhone = undefined;
  await user.save();

  return User.findById(userId).select(PROFILE_SELECT);
}

// ── Account deletion ──────────────────────────────────────────────────────────

async function deleteAccount(userId) {
  await User.findByIdAndUpdate(userId, {
    isDeactivated: true,
    deactivatedAt: new Date(),
  });

  await DeviceSession.updateMany(
    { user: userId },
    { isBlacklisted: true, refreshTokenHash: '' }
  );
}

async function updateLocation(userId, { latitude, longitude }) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw Object.assign(new Error('Valid latitude and longitude are required'), { status: 400 });
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw Object.assign(new Error('Coordinates are out of valid range'), { status: 400 });
  }
  const location = buildGeoPoint(lng, lat);
  return User.findByIdAndUpdate(userId, { location }, { new: true }).select(PROFILE_SELECT);
}

async function updateExpoPushToken(userId, expoPushToken) {
  const token = expoPushToken != null ? String(expoPushToken).trim() : '';
  if (!token) {
    return User.findByIdAndUpdate(userId, { $unset: { expoPushToken: 1 } }, { new: true }).select(
      PROFILE_SELECT
    );
  }
  return User.findByIdAndUpdate(userId, { expoPushToken: token }, { new: true }).select(PROFILE_SELECT);
}

module.exports = {
  getProfile,
  getSecurityInfo,
  revokeSession,
  revokeOtherSessions,
  updateProfile,
  submitKyc,
  updateAvatar,
  requestEmailChange,
  verifyOldEmailAndSendNew,
  verifyNewEmailAndCommit,
  requestPhoneChange,
  verifyPhoneChange,
  deleteAccount,
  updateLocation,
  updateExpoPushToken,
};
