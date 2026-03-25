const User = require('../../models/User');
const cloudinary = require('../../config/cloudinary');

const BVN_REGEX = /^\d{11}$/;
const ALLOWED_ID_TYPES = ['national_id', 'passport', 'drivers_license', 'voters_card'];

// ── Helpers ───────────────────────────────────────────────────────────────────

async function uploadToCloudinary(buffer, folder, options = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: `medmap/${folder}`, resource_type: 'image', ...options },
      (error, result) => (error ? reject(error) : resolve(result))
    );
    stream.end(buffer);
  });
}

// ── KYC steps ─────────────────────────────────────────────────────────────────

async function getKycStatus(userId) {
  const user = await User.findById(userId).select(
    'kycStatus kycStep kycDocuments bvn bankAccounts kycSubmittedAt kycRejectionReason'
  );
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  return user;
}

async function assertNotApproved(userId) {
  const user = await User.findById(userId).select('kycStatus');
  if (user?.kycStatus === 'approved') {
    throw Object.assign(new Error('Your KYC is already approved'), { status: 400 });
  }
}

async function skipBvn(userId) {
  await assertNotApproved(userId);
  await User.findByIdAndUpdate(userId, { kycStep: 'bvn' });
}

async function submitBvn(userId, bvn) {
  await assertNotApproved(userId);
  const trimmed = String(bvn).trim();
  if (!BVN_REGEX.test(trimmed)) {
    throw Object.assign(new Error('BVN must be exactly 11 digits'), { status: 400 });
  }

  // Check BVN not already used by another verified account
  const conflict = await User.findOne({
    bvn: trimmed,
    _id: { $ne: userId },
    kycStatus: 'approved',
  });
  if (conflict) {
    throw Object.assign(new Error('This BVN is linked to another account'), { status: 400 });
  }

  await User.findByIdAndUpdate(userId, {
    bvn: trimmed,
    kycStep: 'bvn',
  });
}

async function submitIdentity(userId, { idType, idNumber }) {
  await assertNotApproved(userId);
  if (!ALLOWED_ID_TYPES.includes(idType)) {
    throw Object.assign(new Error('Invalid ID type'), { status: 400 });
  }
  const trimmedNumber = String(idNumber || '').trim();
  if (!trimmedNumber) {
    throw Object.assign(new Error('ID number is required'), { status: 400 });
  }

  await User.findByIdAndUpdate(userId, {
    'kycDocuments.idType': idType,
    'kycDocuments.idNumber': trimmedNumber,
    kycStep: 'identity',
  });
}

async function uploadIdDocument(userId, buffer, side) {
  await assertNotApproved(userId);
  if (!['front', 'back'].includes(side)) {
    throw Object.assign(new Error("Side must be 'front' or 'back'"), { status: 400 });
  }

  const result = await uploadToCloudinary(buffer, 'kyc/id-documents', {
    transformation: [{ quality: 'auto', fetch_format: 'auto' }],
  });

  const field = side === 'front' ? 'kycDocuments.idFrontUrl' : 'kycDocuments.idBackUrl';
  await User.findByIdAndUpdate(userId, { [field]: result.secure_url });

  // Advance step if both selfie is done or at least identity step is complete
  const user = await User.findById(userId).select('kycDocuments kycStep');
  const hasIdFront = side === 'front' ? true : !!user.kycDocuments?.idFrontUrl;
  const hasIdBack  = side === 'back'  ? true : !!user.kycDocuments?.idBackUrl;
  const hasSelfie  = !!user.kycDocuments?.selfieUrl;

  if (hasIdFront && hasSelfie) {
    await User.findByIdAndUpdate(userId, { kycStep: 'documents' });
  }

  return result.secure_url;
}

async function uploadSelfie(userId, buffer) {
  await assertNotApproved(userId);
  const result = await uploadToCloudinary(buffer, 'kyc/selfies', {
    transformation: [
      { width: 600, height: 600, crop: 'fill', gravity: 'face' },
      { quality: 'auto', fetch_format: 'auto' },
    ],
  });

  await User.findByIdAndUpdate(userId, { 'kycDocuments.selfieUrl': result.secure_url });

  const user = await User.findById(userId).select('kycDocuments kycStep');
  const hasIdFront = !!user.kycDocuments?.idFrontUrl;

  if (hasIdFront) {
    await User.findByIdAndUpdate(userId, { kycStep: 'documents' });
  }

  return result.secure_url;
}

async function addBankAccount(userId, { bankName, accountNumber, accountName }) {
  const trimmedAccNum = String(accountNumber || '').trim();
  if (!bankName || !trimmedAccNum || !accountName) {
    throw Object.assign(new Error('Bank name, account number, and account name are required'), { status: 400 });
  }
  if (!/^\d{10}$/.test(trimmedAccNum)) {
    throw Object.assign(new Error('Account number must be exactly 10 digits'), { status: 400 });
  }

  const user = await User.findById(userId).select('bankAccounts');
  const alreadyExists = user.bankAccounts?.some(
    (b) => b.accountNumber === trimmedAccNum && b.bankName === bankName
  );
  if (alreadyExists) {
    throw Object.assign(new Error('This bank account is already linked'), { status: 400 });
  }

  const isPrimary = !user.bankAccounts || user.bankAccounts.length === 0;
  await User.findByIdAndUpdate(userId, {
    $push: { bankAccounts: { bankName, accountNumber: trimmedAccNum, accountName, isPrimary } },
    kycStep: 'bank',
  });
}

async function submitKycForReview(userId) {
  const user = await User.findById(userId).select('kycStep bvn kycDocuments bankAccounts kycStatus');
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });

  if (user.kycStatus === 'approved') {
    throw Object.assign(new Error('Your KYC is already approved'), { status: 400 });
  }

  // Validate minimum required documents (BVN is optional — international users may skip it)
  const errors = [];
  if (!user.kycDocuments?.idType) errors.push('Government ID type is required');
  if (!user.kycDocuments?.idNumber) errors.push('Government ID number is required');
  if (!user.kycDocuments?.idFrontUrl) errors.push('ID document (front) is required');
  if (!user.kycDocuments?.selfieUrl) errors.push('Selfie is required');
  if (!user.bankAccounts?.length) errors.push('Bank account is required');

  if (errors.length) {
    const err = new Error(errors.join('. '));
    err.status = 400;
    throw err;
  }

  await User.findByIdAndUpdate(userId, {
    $set: { kycStatus: 'pending', kycStep: 'submitted', kycSubmittedAt: new Date() },
    $unset: { kycRejectionReason: '' },
  });
}

module.exports = {
  getKycStatus,
  skipBvn,
  submitBvn,
  submitIdentity,
  uploadIdDocument,
  uploadSelfie,
  addBankAccount,
  submitKycForReview,
};
