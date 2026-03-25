const Notification = require('../../models/Notification');

async function createNotification({ userId, type, title, body, data }) {
  if (!userId) return null;
  return Notification.create({
    user: userId,
    type: type || 'generic',
    title: title || 'Notification',
    body: body || '',
    data: data || undefined,
  });
}

async function listMine({ userId, unreadOnly = false, limit = 30 } = {}) {
  const q = { user: userId };
  if (unreadOnly) q.readAt = { $exists: false };
  const lim = Math.max(1, Math.min(100, parseInt(limit, 10) || 30));
  return Notification.find(q)
    .sort({ createdAt: -1 })
    .limit(lim)
    .lean();
}

async function markRead({ userId, notificationId = null } = {}) {
  const now = new Date();
  if (notificationId) {
    return Notification.findOneAndUpdate(
      { user: userId, _id: notificationId, readAt: { $exists: false } },
      { $set: { readAt: now } },
      { new: true }
    ).lean();
  }

  return Notification.updateMany(
    { user: userId, readAt: { $exists: false } },
    { $set: { readAt: now } }
  );
}

async function unreadCount(userId) {
  return Notification.countDocuments({ user: userId, readAt: { $exists: false } });
}

module.exports = {
  createNotification,
  listMine,
  markRead,
  unreadCount,
};

