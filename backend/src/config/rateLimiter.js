const rateLimit = require('express-rate-limit');
const env = require('./env');

const isProd = env.nodeEnv === 'production';

const createRateLimiter = (options = {}) =>
  rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000,
    max: options.max || 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests, please try again later.' },
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
  });

const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 20 : 100,
});

const writeLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 120 : 1000,
});

const chatLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: isProd ? 30 : 300,
});

module.exports = {
  createRateLimiter,
  authLimiter,
  writeLimiter,
  chatLimiter,
};

