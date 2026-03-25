const nodemailer = require('nodemailer');
const env = require('../config/env');
const logger = require('../config/logger');

let transporter;

if (env.email.host && env.email.user && env.email.pass) {
  transporter = nodemailer.createTransport({
    host: env.email.host,
    port: env.email.port,
    secure: env.email.port === 465,
    auth: {
      user: env.email.user,
      pass: env.email.pass,
    },
  });
}

function buildOtpEmailHtml({ title, intro, code, footer }) {
  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <style>
      body { background-color: #f1f5f9; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; padding: 24px; }
      .card { max-width: 480px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; padding: 24px 24px 20px; box-shadow: 0 10px 25px rgba(15,23,42,0.08); }
      .brand { font-size: 20px; font-weight: 700; color: #0f172a; margin-bottom: 16px; }
      .title { font-size: 18px; font-weight: 600; color: #0f172a; margin-bottom: 8px; }
      .intro { font-size: 14px; color: #64748b; margin-bottom: 20px; }
      .code-wrapper { text-align: center; margin-bottom: 20px; }
      .code-label { font-size: 13px; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px; }
      .code { display: inline-block; font-size: 28px; font-weight: 700; letter-spacing: 0.32em; padding: 12px 20px; border-radius: 999px; background-color: #eff6ff; color: #1d4ed8; }
      .footer { font-size: 12px; color: #94a3b8; margin-top: 8px; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="brand">MedMap</div>
      <div class="title">${title}</div>
      <div class="intro">${intro}</div>
      <div class="code-wrapper">
        <div class="code-label">Your code</div>
        <div class="code">${code}</div>
      </div>
      <div class="footer">${footer}</div>
    </div>
  </body>
</html>
`;
}

async function sendEmail(to, subject, html) {
  if (!transporter) {
    logger.warn('Email transporter not configured, skipping email send', {
      to,
      subject,
    });
    return;
  }

  await transporter.sendMail({
    from: env.email.from,
    to,
    subject,
    html,
  });
}

async function sendPushNotification(/* expoPushToken, payload */) {
  // The actual Expo push integration is handled from the mobile app side.
  // Here we only keep a placeholder for server-side orchestration if needed.
  return;
}

module.exports = {
  sendEmail,
  buildOtpEmailHtml,
  sendPushNotification,
};

