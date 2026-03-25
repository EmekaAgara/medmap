const User = require('../../models/User');
const Loan = require('../../models/Loan');
const Transaction = require('../../models/Transaction');
const Wallet = require('../../models/Wallet');
const LoginEvent = require('../../models/LoginEvent');
const Provider = require('../../models/Provider');

// ── Dashboard stats ───────────────────────────────────────────────────────────

async function getDashboardStats() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    newUsersThisMonth,
    pendingKyc,
    approvedKyc,
    rejectedKyc,
    bannedUsers,
    providersPending,
    providersApproved,
    accountTypeChangePending,
    totalLoans,
    activeLoans,
    recentLogins,
  ] = await Promise.all([
    User.countDocuments({ isDeactivated: false }),
    User.countDocuments({ createdAt: { $gte: thirtyDaysAgo }, isDeactivated: false }),
    User.countDocuments({ kycStatus: 'pending' }),
    User.countDocuments({ kycStatus: 'approved' }),
    User.countDocuments({ kycStatus: 'rejected' }),
    User.countDocuments({ isBanned: true }),
    Provider.countDocuments({ moderationStatus: 'pending', isActive: true }).catch(() => 0),
    Provider.countDocuments({ moderationStatus: 'approved', isActive: true }).catch(() => 0),
    User.countDocuments({ accountTypeChangeStatus: 'pending' }),
    Loan.countDocuments({}).catch(() => 0),
    Loan.countDocuments({ status: 'active' }).catch(() => 0),
    LoginEvent.countDocuments({ createdAt: { $gte: thirtyDaysAgo }, eventType: 'login' }).catch(() => 0),
  ]);

  // Wallet totals
  let totalWalletBalance = 0;
  try {
    const walletAgg = await Wallet.aggregate([
      { $group: { _id: null, total: { $sum: '$availableBalance' } } },
    ]);
    totalWalletBalance = walletAgg[0]?.total || 0;
  } catch { /* ignore */ }

  return {
    users: {
      total: totalUsers,
      newThisMonth: newUsersThisMonth,
      banned: bannedUsers,
      accountTypeChangePending,
    },
    kyc: { pending: pendingKyc, approved: approvedKyc, rejected: rejectedKyc },
    providers: { pending: providersPending, approved: providersApproved },
    loans: { total: totalLoans, active: activeLoans },
    wallet: { totalBalance: totalWalletBalance },
    activity: { loginsThisMonth: recentLogins },
  };
}

// ── Users ─────────────────────────────────────────────────────────────────────

async function listUsers({ search = '', status = '', page = 1, limit = 20 } = {}) {
  const query = { isDeactivated: false };

  if (search) {
    const re = new RegExp(search, 'i');
    query.$or = [{ fullName: re }, { email: re }, { phone: re }];
  }
  if (status === 'banned') query.isBanned = true;
  else if (status === 'kyc_pending') query.kycStatus = 'pending';
  else if (status === 'kyc_approved') query.kycStatus = 'approved';
  else if (status === 'kyc_rejected') query.kycStatus = 'rejected';

  const skip = (Number(page) - 1) * Number(limit);
  const [users, total] = await Promise.all([
    User.find(query)
      .select('fullName email phone avatarUrl kycStatus kycStep isBanned roles createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    User.countDocuments(query),
  ]);

  return { users, total, page: Number(page), pages: Math.ceil(total / Number(limit)) };
}

async function getUserDetail(userId) {
  const user = await User.findById(userId)
    .select('-passwordHash -transactionPinHash -refreshTokenHash')
    .lean();
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  return user;
}

// ── KYC review ────────────────────────────────────────────────────────────────

async function listPendingKyc({ page = 1, limit = 20 } = {}) {
  const skip = (Number(page) - 1) * Number(limit);
  const [users, total] = await Promise.all([
    User.find({ kycStatus: 'pending' })
      .select('fullName email phone avatarUrl kycStatus kycStep kycDocuments bvn bankAccounts kycSubmittedAt')
      .sort({ kycSubmittedAt: 1 }) // oldest first
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    User.countDocuments({ kycStatus: 'pending' }),
  ]);
  return { users, total, page: Number(page), pages: Math.ceil(total / Number(limit)) };
}

async function setKycStatus(userId, { status, rejectionReason }, adminId) {
  if (!['approved', 'rejected'].includes(status)) {
    throw Object.assign(new Error("Status must be 'approved' or 'rejected'"), { status: 400 });
  }
  if (status === 'rejected' && !rejectionReason?.trim()) {
    throw Object.assign(new Error('Rejection reason is required'), { status: 400 });
  }

  const update = {
    kycStatus: status,
    kycReviewedAt: new Date(),
    kycReviewerId: adminId,
  };
  if (status === 'rejected') update.kycRejectionReason = rejectionReason.trim();
  else update.kycRejectionReason = undefined;

  const user = await User.findByIdAndUpdate(userId, update, { new: true })
    .select('fullName email kycStatus kycRejectionReason');
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  return user;
}

// ── Ban / Unban ───────────────────────────────────────────────────────────────

async function banUser(userId, { reason }, adminId) {
  if (!reason?.trim()) throw Object.assign(new Error('Ban reason is required'), { status: 400 });

  const user = await User.findByIdAndUpdate(
    userId,
    { isBanned: true, bannedAt: new Date(), bannedReason: reason.trim(), bannedByAdminId: adminId },
    { new: true }
  ).select('fullName email isBanned');
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  return user;
}

async function unbanUser(userId) {
  const user = await User.findByIdAndUpdate(
    userId,
    { isBanned: false, bannedAt: undefined, bannedReason: undefined, bannedByAdminId: undefined },
    { new: true }
  ).select('fullName email isBanned');
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  return user;
}

// ── Activity / Audit ──────────────────────────────────────────────────────────

async function getRecentLoginEvents({ page = 1, limit = 30 } = {}) {
  const skip = (Number(page) - 1) * Number(limit);
  const [events, total] = await Promise.all([
    LoginEvent.find()
      .populate('user', 'fullName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    LoginEvent.countDocuments(),
  ]);
  return { events, total, page: Number(page), pages: Math.ceil(total / Number(limit)) };
}

async function listPendingAccountTypeChanges({ page = 1, limit = 20 } = {}) {
  const skip = (Number(page) - 1) * Number(limit);
  const query = { accountTypeChangeStatus: 'pending', pendingAccountType: { $exists: true, $ne: null } };
  const [users, total] = await Promise.all([
    User.find(query)
      .select('fullName email phone accountType pendingAccountType accountTypeChangeStatus updatedAt')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    User.countDocuments(query),
  ]);
  return { users, total, page: Number(page), pages: Math.ceil(total / Number(limit)) };
}

async function reviewAccountTypeChange(userId, { action, reason }, adminId) {
  if (!['approve', 'reject'].includes(action)) {
    throw Object.assign(new Error("Action must be 'approve' or 'reject'"), { status: 400 });
  }
  if (action === 'reject' && !String(reason || '').trim()) {
    throw Object.assign(new Error('Rejection reason is required'), { status: 400 });
  }

  const user = await User.findById(userId);
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  if (user.accountTypeChangeStatus !== 'pending' || !user.pendingAccountType) {
    throw Object.assign(new Error('No pending account type change for this user'), { status: 400 });
  }

  if (action === 'approve') {
    user.accountType = user.pendingAccountType;
    user.accountTypeChangeStatus = 'approved';
    user.accountTypeChangeReason = undefined;
    user.pendingAccountType = undefined;
  } else {
    user.accountTypeChangeStatus = 'rejected';
    user.accountTypeChangeReason = String(reason).trim();
  }
  user.accountTypeReviewedAt = new Date();
  user.accountTypeReviewerId = adminId;
  await user.save();

  return User.findById(userId)
    .select('fullName email accountType pendingAccountType accountTypeChangeStatus accountTypeChangeReason accountTypeReviewedAt')
    .lean();
}

module.exports = {
  getDashboardStats,
  listUsers,
  getUserDetail,
  listPendingKyc,
  setKycStatus,
  listPendingAccountTypeChanges,
  reviewAccountTypeChange,
  banUser,
  unbanUser,
  getRecentLoginEvents,
};
