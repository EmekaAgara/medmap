const { success, fail } = require('../../utils/responses');
const kycService = require('./kyc.service');

async function getStatus(req, res) {
  try {
    const data = await kycService.getKycStatus(req.user.id);
    return success(res, data);
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function skipBvn(req, res) {
  try {
    await kycService.skipBvn(req.user.id);
    return success(res, null, 'BVN step skipped');
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function submitBvn(req, res) {
  try {
    const { bvn } = req.body;
    if (!bvn) return fail(res, 'BVN is required', 400);
    await kycService.submitBvn(req.user.id, bvn);
    return success(res, null, 'BVN submitted');
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function submitIdentity(req, res) {
  try {
    const { idType, idNumber } = req.body;
    if (!idType || !idNumber) return fail(res, 'ID type and number are required', 400);
    await kycService.submitIdentity(req.user.id, { idType, idNumber });
    return success(res, null, 'Identity information saved');
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function uploadIdDocument(req, res) {
  try {
    if (!req.file) return fail(res, 'No file uploaded', 400);
    const { side } = req.body;
    if (!side) return fail(res, "Document side ('front' or 'back') is required", 400);
    const url = await kycService.uploadIdDocument(req.user.id, req.file.buffer, side);
    return success(res, { url }, 'Document uploaded');
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function uploadSelfie(req, res) {
  try {
    if (!req.file) return fail(res, 'No file uploaded', 400);
    const url = await kycService.uploadSelfie(req.user.id, req.file.buffer);
    return success(res, { url }, 'Selfie uploaded');
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function addBankAccount(req, res) {
  try {
    const { bankName, accountNumber, accountName } = req.body;
    await kycService.addBankAccount(req.user.id, { bankName, accountNumber, accountName });
    return success(res, null, 'Bank account added');
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function submitForReview(req, res) {
  try {
    await kycService.submitKycForReview(req.user.id);
    return success(res, null, 'KYC submitted for review');
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

module.exports = {
  getStatus,
  skipBvn,
  submitBvn,
  submitIdentity,
  uploadIdDocument,
  uploadSelfie,
  addBankAccount,
  submitForReview,
};
