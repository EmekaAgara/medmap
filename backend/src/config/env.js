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
    clientId: process.env.INTERSWITCH_CLIENT_ID || '',
    clientSecret: process.env.INTERSWITCH_CLIENT_SECRET || '',
    webhookSecret: process.env.INTERSWITCH_WEBHOOK_SECRET || '',
    baseUrl: process.env.INTERSWITCH_BASE_URL || 'https://qa.interswitchng.com',
    redirectUrl: process.env.INTERSWITCH_REDIRECT_URL || 'https://example.com',
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
  },

  email: {
    host: process.env.EMAIL_HOST || '',
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || '',
    from: process.env.EMAIL_FROM || 'MedMap <no-reply@medmap.app>',
  },
};

module.exports = env;

