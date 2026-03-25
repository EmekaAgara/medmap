const User = require('../models/User');
const logger = require('../config/logger');

/**
 * Send via Expo Push API (works with Expo push tokens from the mobile app).
 * @see https://docs.expo.dev/push-notifications/sending-notifications/
 */
async function sendExpoPush({ to, title, body, data }) {
  if (!to || typeof to !== 'string') return;
  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to,
        title: title || 'MedMap',
        body: body || '',
        data: data && typeof data === 'object' ? data : {},
        sound: 'default',
        priority: 'high',
        channelId: 'default',
      }),
    });
    const json = await res.json().catch(() => ({}));
    const tickets = json?.data;
    if (Array.isArray(tickets)) {
      const err = tickets.find((d) => d.status === 'error');
      if (err) logger.warn('Expo push ticket error', { message: err.message });
    }
  } catch (e) {
    logger.warn('Expo push request failed', { error: e.message });
  }
}

async function notifyUserPush({ userId, title, body, data }) {
  if (!userId) return;
  const user = await User.findById(userId).select('expoPushToken').lean();
  if (!user?.expoPushToken) return;
  await sendExpoPush({ to: user.expoPushToken, title, body, data });
}

module.exports = {
  sendExpoPush,
  notifyUserPush,
};
