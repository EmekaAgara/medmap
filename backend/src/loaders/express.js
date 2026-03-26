const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const env = require('../config/env');
const logger = require('../config/logger');
const { errorHandler, notFound } = require('../middlewares/errorHandler');
const routes = require('../routes');
const docs = require('../routes/docs');
const { scheduleAccountCleanup } = require('../jobs/cleanupDeactivatedAccounts');

function createApp() {
  const app = express();

  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || env.corsOrigins.length === 0) {
          return callback(null, true);
        }
        if (env.corsOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
    })
  );
  app.use(compression());
  // Preserve raw body bytes for Interswitch webhook HMAC (must match incoming JSON exactly).
  app.use(
    express.json({
      limit: '10mb',
      verify: (req, res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use(express.urlencoded({ extended: true }));

  app.use(
    morgan('combined', {
      stream: {
        write: (message) => logger.info(message.trim()),
      },
    })
  );

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  app.use('/api/v1', routes);
  app.use('/api-docs', docs);

  app.use(notFound);
  app.use(errorHandler);

  // Start background jobs
  scheduleAccountCleanup();

  return app;
}

module.exports = {
  createApp,
};

