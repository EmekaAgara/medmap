const cron = require('node-cron');
const User = require('../models/User');
const DeviceSession = require('../models/DeviceSession');
const logger = require('../config/logger');

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

async function deleteExpiredAccounts() {
  const cutoff = new Date(Date.now() - THIRTY_DAYS_MS);

  try {
    // Find all accounts whose 30-day grace period has passed
    const expiredUsers = await User.find({
      isDeactivated: true,
      deactivatedAt: { $lte: cutoff },
    }).select('_id');

    if (expiredUsers.length === 0) return;

    const userIds = expiredUsers.map((u) => u._id);

    // Remove all device sessions first
    await DeviceSession.deleteMany({ user: { $in: userIds } });

    // Hard-delete the users
    const result = await User.deleteMany({ _id: { $in: userIds } });

    logger.info(`[cleanup] Permanently deleted ${result.deletedCount} expired account(s)`);
  } catch (err) {
    logger.error('[cleanup] Failed to delete expired accounts', { error: err.message });
  }
}

function scheduleAccountCleanup() {
  // Run every day at 02:00 AM server time
  cron.schedule('0 2 * * *', () => {
    logger.info('[cleanup] Running deactivated account cleanup...');
    deleteExpiredAccounts();
  });

  logger.info('[cleanup] Account cleanup job scheduled (daily at 02:00)');
}

module.exports = { scheduleAccountCleanup, deleteExpiredAccounts };
