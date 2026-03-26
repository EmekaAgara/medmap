const { success, fail } = require('../../utils/responses');
const adminService = require('./admin.service');
const walletService = require('../wallet/wallet.service');

async function getDashboard(req, res) {
  try {
    const data = await adminService.getDashboardStats();
    return success(res, data);
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function listUsers(req, res) {
  try {
    const { search, status, page, limit } = req.query;
    const data = await adminService.listUsers({ search, status, page, limit });
    return success(res, data);
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function getUserDetail(req, res) {
  try {
    const user = await adminService.getUserDetail(req.params.id);
    return success(res, user);
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function listPendingKyc(req, res) {
  try {
    const { page, limit } = req.query;
    const data = await adminService.listPendingKyc({ page, limit });
    return success(res, data);
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function setKycStatus(req, res) {
  try {
    const { status, rejectionReason } = req.body;
    const user = await adminService.setKycStatus(
      req.params.id,
      { status, rejectionReason },
      req.user.id
    );
    return success(res, user, `KYC ${status}`);
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function banUser(req, res) {
  try {
    const { reason } = req.body;
    const user = await adminService.banUser(req.params.id, { reason }, req.user.id);
    return success(res, user, 'User banned');
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function unbanUser(req, res) {
  try {
    const user = await adminService.unbanUser(req.params.id);
    return success(res, user, 'User unbanned');
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function getActivity(req, res) {
  try {
    const { page, limit } = req.query;
    const data = await adminService.getRecentLoginEvents({ page, limit });
    return success(res, data);
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function listPendingAccountTypeChanges(req, res) {
  try {
    const { page, limit } = req.query;
    const data = await adminService.listPendingAccountTypeChanges({ page, limit });
    return success(res, data);
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function reviewAccountTypeChange(req, res) {
  try {
    const { action, reason } = req.body;
    const data = await adminService.reviewAccountTypeChange(req.params.id, { action, reason }, req.user.id);
    return success(res, data, `Account type ${action}d`);
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function getPaymentsReconciliation(req, res) {
  try {
    const limit = Math.min(500, parseInt(req.query.limit || '100', 10) || 100);
    const data = await walletService.getPlatformReconciliation({ limit });
    return success(res, data);
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

module.exports = {
  getDashboard,
  listUsers,
  getUserDetail,
  listPendingKyc,
  setKycStatus,
  listPendingAccountTypeChanges,
  reviewAccountTypeChange,
  banUser,
  unbanUser,
  getActivity,
  getPaymentsReconciliation,
};
