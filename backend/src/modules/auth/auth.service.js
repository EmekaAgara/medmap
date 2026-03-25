const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const User = require('../../models/User');
const Wallet = require('../../models/Wallet');
const OtpToken = require('../../models/OtpToken');
const DeviceSession = require('../../models/DeviceSession');
const LoginEvent = require('../../models/LoginEvent');
const env = require('../../config/env');
const logger = require('../../config/logger');
const { hashPassword, comparePassword, hashPin, comparePin } = require('../../utils/crypto');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} = require('../../utils/jwt');
const { sendEmail, buildOtpEmailHtml } = require('../../utils/notifications');

async function recordLoginEvent({ userId, device, eventType, failReason }) {
  try {
    await LoginEvent.create({
      user: userId,
      eventType,
      ip: device?.ip,
      userAgent: device?.userAgent,
      deviceId: device?.deviceId,
      deviceModel: device?.deviceModel,
      deviceOs: device?.deviceOs,
      failReason,
    });
  } catch { /* never let logging break the main flow */ }
}

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function createOtpToken(user, purpose) {
  const code = generateOtpCode();
  const codeHash = await hashPassword(code);

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await OtpToken.create({
    user: user._id,
    email: user.email,
    purpose,
    codeHash,
    expiresAt,
  });

  return code;
}

async function issueTokensForUser(user, device) {
  const payload = {
    sub: user._id.toString(),
    roles: user.roles,
  };

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  const deviceId = await createDeviceSession({
    userId: user._id,
    refreshToken,
    device,
  });

  return {
    accessToken,
    refreshToken,
    deviceId,
    user: {
      id: user._id,
      email: user.email,
      phone: user.phone,
      fullName: user.fullName,
      roles: user.roles,
      accountType: user.accountType || 'patient',
      kycStatus: user.kycStatus,
    },
  };
}

async function register({ email, phone, password, fullName, accountType }) {
  const allowedAccountTypes = ['patient', 'doctor', 'hospital_admin', 'pharmacy_admin'];
  const normalizedAccountType = allowedAccountTypes.includes(accountType) ? accountType : 'patient';
  const exists = await User.findOne({
    $or: [{ email: email.toLowerCase() }, { phone }],
  });
  if (exists) {
    const error = new Error('Email or phone already in use');
    error.status = 400;
    throw error;
  }

  const passwordHash = await hashPassword(password);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = await User.create(
      [
        {
          email: email.toLowerCase(),
          phone,
          passwordHash,
          fullName,
          accountType: normalizedAccountType,
        },
      ],
      { session }
    );

    const createdUser = user[0];

    await Wallet.create(
      [
        {
          user: createdUser._id,
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    // send email verification OTP
    const code = await createOtpToken(createdUser, 'email_verification');
    const html = buildOtpEmailHtml({
      title: 'Verify your MedMap account',
      intro:
        'Use the code below to verify your MedMap account. For your security, this code will expire in 10 minutes.',
      code,
      footer: 'If you did not sign up for MedMap, you can safely ignore this email.',
    });
    await sendEmail(createdUser.email, 'Verify your MedMap account', html);

    return {
      id: createdUser._id,
      email: createdUser.email,
      phone: createdUser.phone,
      fullName: createdUser.fullName,
      roles: createdUser.roles,
      accountType: createdUser.accountType,
    };
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

async function createDeviceSession({ userId, refreshToken, device }) {
  const refreshTokenHash = await hashPassword(refreshToken);

  const deviceId = device.deviceId || uuidv4();

  await DeviceSession.findOneAndUpdate(
    { user: userId, deviceId },
    {
      user: userId,
      deviceId,
      deviceInfo: {
        model: device.deviceModel || '',
        os: device.deviceOs || '',
      },
      ip: device.ip,
      userAgent: device.userAgent,
      refreshTokenHash,
      lastSeenAt: new Date(),
      isBlacklisted: false,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return deviceId;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

async function login({ emailOrPhone, password, device }) {
  const user = await User.findOne({
    $or: [{ email: emailOrPhone.toLowerCase() }, { phone: emailOrPhone }],
  });

  if (!user) {
    const error = new Error('Invalid credentials');
    error.status = 401;
    throw error;
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    await recordLoginEvent({ userId: user._id, device, eventType: 'login_failed', failReason: 'Invalid password' });
    const error = new Error('Invalid credentials');
    error.status = 401;
    throw error;
  }

  // Block unverified accounts
  if (!user.emailVerifiedAt) {
    const error = new Error('Please verify your email before logging in');
    error.status = 403;
    throw error;
  }

  // Handle deactivated accounts
  if (user.isDeactivated) {
    const gracePeriodExpired =
      !user.deactivatedAt ||
      Date.now() - user.deactivatedAt.getTime() > THIRTY_DAYS_MS;

    if (gracePeriodExpired) {
      // Grace period over — permanently delete and reject
      await User.findByIdAndDelete(user._id);
      const error = new Error(
        'This account has been permanently deleted after the 30-day grace period.'
      );
      error.status = 401;
      throw error;
    }

    // Within 30 days — reactivate the account
    user.isDeactivated = false;
    user.deactivatedAt = undefined;
    await user.save();

    logger.info('Account reactivated', { userId: user._id });
  }

  await recordLoginEvent({ userId: user._id, device, eventType: 'login' });
  return issueTokensForUser(user, device);
}

async function requestLoginOtp({ emailOrPhone }) {
  const value = String(emailOrPhone).trim();
  const user = await User.findOne({
    $or: [{ email: value.toLowerCase() }, { phone: value }],
  });

  if (!user) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }

  const code = await createOtpToken(user, 'login');
  const html = buildOtpEmailHtml({
    title: 'Your MedMap login code',
    intro: 'Use the code below to complete your MedMap login. This code will expire in 10 minutes.',
    code,
    footer: 'If you did not attempt to log in, please secure your account immediately.',
  });
  await sendEmail(user.email, 'Your MedMap login code', html);
}

async function loginWithOtp({ emailOrPhone, code, device }) {
  const value = String(emailOrPhone).trim();
  const codeValue = String(code).trim();
  const user = await User.findOne({
    $or: [{ email: value.toLowerCase() }, { phone: value }],
  });

  if (!user) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }

  const token = await OtpToken.findOne({
    user: user._id,
    purpose: 'login',
    email: user.email,
  })
    .sort({ createdAt: -1 })
    .exec();

  if (!token || token.expiresAt < new Date() || token.consumedAt) {
    const error = new Error('Invalid or expired code');
    error.status = 400;
    throw error;
  }

  const matches = await comparePassword(codeValue, token.codeHash);
  if (!matches) {
    const error = new Error('Invalid or expired code');
    error.status = 400;
    throw error;
  }

  token.consumedAt = new Date();
  await token.save();

  await recordLoginEvent({ userId: user._id, device, eventType: 'login' });
  return issueTokensForUser(user, device);
}

async function resendVerificationEmail({ email }) {
  const emailValue = String(email).trim().toLowerCase();
  const user = await User.findOne({ email: emailValue });
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  if (user.emailVerifiedAt) throw Object.assign(new Error('Email is already verified'), { status: 400 });

  const code = await createOtpToken(user, 'email_verification');
  const html = buildOtpEmailHtml({
    title: 'Verify your MedMap account',
    intro: 'Use the code below to verify your MedMap account. This code will expire in 10 minutes.',
    code,
    footer: 'If you did not sign up for MedMap, you can safely ignore this email.',
  });
  await sendEmail(user.email, 'Verify your MedMap account', html);
}

async function verifyEmail({ email, code }) {
  const emailValue = String(email).trim().toLowerCase();
  const codeValue = String(code).trim();
  const user = await User.findOne({ email: emailValue });
  if (!user) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }

  const token = await OtpToken.findOne({
    user: user._id,
    purpose: 'email_verification',
    email: user.email,
  })
    .sort({ createdAt: -1 })
    .exec();

  if (!token || token.expiresAt < new Date() || token.consumedAt) {
    const error = new Error('Invalid or expired code');
    error.status = 400;
    throw error;
  }

  const matches = await comparePassword(codeValue, token.codeHash);
  if (!matches) {
    const error = new Error('Invalid or expired code');
    error.status = 400;
    throw error;
  }

  token.consumedAt = new Date();
  await token.save();

  user.emailVerifiedAt = new Date();
  await user.save();

  return {
    id: user._id,
    email: user.email,
    emailVerifiedAt: user.emailVerifiedAt,
  };
}

async function refresh({ refreshToken, device }) {
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (err) {
    const error = new Error('Invalid refresh token');
    error.status = 401;
    throw error;
  }

  const session = await DeviceSession.findOne({
    user: decoded.sub,
    deviceId: device.deviceId,
  });

  if (!session || session.isBlacklisted) {
    const error = new Error('Session not found or blacklisted');
    error.status = 401;
    throw error;
  }

  const isMatch = await comparePassword(refreshToken, session.refreshTokenHash);
  if (!isMatch) {
    const error = new Error('Invalid refresh token');
    error.status = 401;
    throw error;
  }

  // Re-fetch roles from DB so a demoted/banned user can't keep refreshing stale admin tokens
  const freshUser = await User.findById(decoded.sub).select('roles isDeactivated isBanned');
  if (!freshUser || freshUser.isDeactivated || freshUser.isBanned) {
    const error = new Error('Account is no longer active');
    error.status = 401;
    throw error;
  }

  const payload = {
    sub: decoded.sub,
    roles: freshUser.roles,
  };

  const newAccessToken = signAccessToken(payload);
  const newRefreshToken = signRefreshToken(payload);

  await createDeviceSession({
    userId: decoded.sub,
    refreshToken: newRefreshToken,
    device: {
      ...device,
      deviceId: session.deviceId,
    },
  });

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
}

async function logout({ userId, deviceId }) {
  if (!deviceId) return;
  await DeviceSession.findOneAndUpdate(
    { user: userId, deviceId },
    { isBlacklisted: true, refreshTokenHash: '' }
  );
}

async function setupTransactionPin({ userId, pin }) {
  if (!/^\d{4,6}$/.test(String(pin))) {
    throw Object.assign(new Error('PIN must be 4 to 6 digits'), { status: 400 });
  }
  const pinHash = await hashPin(String(pin));
  await User.findByIdAndUpdate(userId, { transactionPinHash: pinHash });
}

async function changePin({ userId, currentPin, newPin }) {
  const user = await User.findById(userId).select('transactionPinHash');
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  if (!user.transactionPinHash) {
    throw Object.assign(new Error('No PIN has been set yet. Use set PIN instead.'), { status: 400 });
  }

  const valid = await comparePin(String(currentPin), user.transactionPinHash);
  if (!valid) throw Object.assign(new Error('Current PIN is incorrect'), { status: 400 });

  if (!/^\d{4,6}$/.test(String(newPin))) {
    throw Object.assign(new Error('New PIN must be 4 to 6 digits'), { status: 400 });
  }
  if (String(currentPin) === String(newPin)) {
    throw Object.assign(new Error('New PIN must be different from your current PIN'), { status: 400 });
  }

  const pinHash = await hashPin(String(newPin));
  await User.findByIdAndUpdate(userId, { transactionPinHash: pinHash });
}

async function verifyPin({ userId, pin }) {
  const user = await User.findById(userId).select('transactionPinHash');
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  if (!user.transactionPinHash) {
    throw Object.assign(new Error('No transaction PIN set'), { status: 400 });
  }
  const valid = await comparePin(String(pin), user.transactionPinHash);
  if (!valid) throw Object.assign(new Error('Incorrect PIN'), { status: 400 });
}

async function changePassword({ userId, currentPassword, newPassword }) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });

  const valid = await comparePassword(currentPassword, user.passwordHash);
  if (!valid) throw Object.assign(new Error('Current password is incorrect'), { status: 400 });

  const SECURE_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  if (!SECURE_PASSWORD.test(newPassword)) {
    throw Object.assign(
      new Error('New password must be at least 8 characters and include uppercase, lowercase, and a number'),
      { status: 400 }
    );
  }

  const passwordHash = await hashPassword(newPassword);
  await User.findByIdAndUpdate(userId, { passwordHash });
}

module.exports = {
  register,
  login,
  requestLoginOtp,
  loginWithOtp,
  refresh,
  logout,
  resendVerificationEmail,
  verifyEmail,
  setupTransactionPin,
  changePin,
  verifyPin,
  changePassword,
};

