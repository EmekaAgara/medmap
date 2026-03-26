const dotenv = require('dotenv');

dotenv.config();

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 4000,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/medmap',

  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'change-me-access',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'change-me-refresh',
  jwtAccessTtl: process.env.JWT_ACCESS_TTL || '15m',
  jwtRefreshTtl: process.env.JWT_REFRESH_TTL || '30d',

  corsOrigins: (process.env.CORS_ORIGINS || '').split(',').filter(Boolean),

  interswitch: {
    webhookSecret: process.env.INTERSWITCH_WEBHOOK_SECRET || '',
    /** Passport not required for Web Redirect + gettransaction; optional for future APIs. */
    clientId: process.env.INTERSWITCH_CLIENT_ID || '',
    clientSecret: process.env.INTERSWITCH_CLIENT_SECRET || '',
    /** Pay Bill API host (sandbox QA / live). */
    baseUrl: (process.env.INTERSWITCH_BASE_URL || 'https://qa.interswitchng.com').replace(/\/$/, ''),
    /**
     * site_redirect_url — must accept gateway POST (txnref, amount, resp, …).
     * Use your API URL, e.g. https://HOST/api/v1/wallets/webpay/redirect
     */
    redirectUrl: (process.env.INTERSWITCH_REDIRECT_URL || '').trim(),
    merchantCode: process.env.INTERSWITCH_MERCHANT_CODE || '',
    payableCode: process.env.INTERSWITCH_PAYABLE_CODE || '',
    /** If gettransaction requires Hash header for your merchant. */
    macKey: process.env.INTERSWITCH_MAC_KEY || '',
    /** Optional Pay Bill link flow — else Web Redirect auto-POST form. */
    usePayBill: process.env.INTERSWITCH_USE_PAY_BILL === 'true',
    payBillPath: process.env.INTERSWITCH_PAY_BILL_PATH || '/collections/api/v1/pay-bill',
    webPayMode: (process.env.INTERSWITCH_WEBPAY_MODE || 'TEST').toUpperCase() === 'LIVE' ? 'LIVE' : 'TEST',
    webPayActionUrlTest:
      process.env.INTERSWITCH_WEBPAY_URL_TEST || 'https://newwebpay.qa.interswitchng.com/collections/w/pay',
    webPayActionUrlLive:
      process.env.INTERSWITCH_WEBPAY_URL_LIVE || 'https://newwebpay.interswitchng.com/collections/w/pay',
    getTransactionPath:
      process.env.INTERSWITCH_GETTRANSACTION_PATH || '/collections/api/v1/gettransaction.json',
    requeryBaseUrlTest:
      process.env.INTERSWITCH_REQUERY_BASE_TEST || 'https://qa.interswitchng.com',
    requeryBaseUrlLive:
      process.env.INTERSWITCH_REQUERY_BASE_LIVE || 'https://webpay.interswitchng.com',
    /** Legacy OPay status endpoint for old pending transactions only. */
    collectionsStatusPath: process.env.INTERSWITCH_COLLECTIONS_STATUS_PATH || '',
    /**
     * When true (default), /fund/verify calls gettransaction so the app can confirm without webhooks.
     */
    enableServerRequery: process.env.INTERSWITCH_ENABLE_SERVER_REQUERY !== 'false',
  },

  meddie: {
    enabled: process.env.MEDDIE_ENABLED !== 'false',
    // Prefer Gemini (Google AI Studio) if configured.
    geminiApiKey: process.env.GEMINI_API_KEY || process.env.MEDDIE_GEMINI_API_KEY || '',
    geminiModel: process.env.MEDDIE_GEMINI_MODEL || 'gemini-3-flash-preview',
    // Optional OpenAI-compatible fallback.
    openaiApiKey: process.env.MEDDIE_OPENAI_API_KEY || '',
    openaiBaseUrl: process.env.MEDDIE_OPENAI_BASE_URL || 'https://api.openai.com/v1',
    openaiModel: process.env.MEDDIE_OPENAI_MODEL || 'gpt-4o-mini',
  },

  /** Platform commission on paid appointments & orders (basis points: 500 = 5%) */
  platformFeeBps: Math.max(0, parseInt(process.env.PLATFORM_FEE_BPS || '500', 10) || 0),

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
  },

  /** When true (default), doctor / hospital_admin / pharmacy_admin listings go live without admin review */
  autoApproveProviderListings: process.env.AUTO_APPROVE_PROVIDER_LISTINGS !== 'false',

  /** node-cron expression; server must stay up for jobs to run */
  appointmentReminderCron: process.env.APPOINTMENT_REMINDER_CRON || '*/15 * * * *',
  appointmentRemindersEnabled: process.env.APPOINTMENT_REMINDERS_ENABLED !== 'false',

  email: {
    host: process.env.EMAIL_HOST || '',
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || '',
    from: process.env.EMAIL_FROM || 'MedMap <no-reply@medmap.app>',
  },
};

module.exports = env;

