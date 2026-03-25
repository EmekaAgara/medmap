const { success, fail } = require('../../utils/responses');
const notificationsService = require('./notifications.service');

async function listMine(req, res) {
  try {
    const unreadOnly = String(req.query.unreadOnly || '').toLowerCase() === 'true';
    const items = await notificationsService.listMine({
      userId: req.user.id,
      unreadOnly,
      limit: req.query.limit,
    });
    const count = unreadOnly ? items.length : await notificationsService.unreadCount(req.user.id);
    return success(res, { items, unreadCount: count });
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function markAllRead(req, res) {
  try {
    await notificationsService.markRead({ userId: req.user.id, notificationId: null });
    return success(res, null, 'Notifications marked as read');
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function markRead(req, res) {
  try {
    const { id } = req.params;
    const updated = await notificationsService.markRead({ userId: req.user.id, notificationId: id });
    return success(res, updated, 'Notification marked as read');
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

module.exports = {
  listMine,
  markAllRead,
  markRead,
};

