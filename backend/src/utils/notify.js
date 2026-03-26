const User = require('../models/User');
const logger = require('../config/logger');
const { notifyUserPush } = require('./push');
const notificationsService = require('../modules/notifications/notifications.service');
const { sendEmail } = require('./notifications'); // existing nodemailer helper

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildBasicEmailHtml({ title, body }) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:24px;background:#f1f5f9;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;padding:20px 20px 16px;box-shadow:0 10px 25px rgba(15,23,42,0.08);">
      <div style="font-weight:800;font-size:18px;margin-bottom:10px;color:#0f172a;">MedMap</div>
      <div style="font-weight:700;font-size:16px;margin-bottom:8px;color:#0f172a;">${escapeHtml(title)}</div>
      <div style="font-size:14px;line-height:20px;color:#334155;">${escapeHtml(body)}</div>
      <div style="margin-top:14px;font-size:12px;color:#94a3b8;">You can manage notifications in the MedMap app.</div>
    </div>
  </body>
</html>`;
}

/**
 * Unified notification: in-app (DB), push (Expo), optional email.
 * data is used by mobile deep-links (e.g. { type: 'order', orderId }).
 */
async function notifyUser({
  userId,
  type = 'generic',
  title,
  body,
  data,
  push = true,
  email = false,
  emailSubject,
} = {}) {
  if (!userId) return null;
  const safeTitle = title || 'Notification';
  const safeBody = body || '';

  const record = await notificationsService.createNotification({
    userId,
    type,
    title: safeTitle,
    body: safeBody,
    data,
  });

  if (push) {
    notifyUserPush({ userId, title: safeTitle, body: safeBody, data }).catch((e) =>
      logger.warn('Push notify failed', { err: e.message })
    );
  }

  if (email) {
    const user = await User.findById(userId).select('email').lean();
    const to = user?.email;
    if (to && String(to).includes('@')) {
      const subj = emailSubject || safeTitle;
      const html = buildBasicEmailHtml({ title: safeTitle, body: safeBody });
      sendEmail(to, subj, html).catch((e) =>
        logger.warn('Email notify failed', { err: e.message })
      );
    }
  }

  return record;
}

module.exports = {
  notifyUser,
};

