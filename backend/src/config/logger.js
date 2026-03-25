const winston = require('winston');

const level = process.env.LOG_LEVEL || 'info';

const logger = winston.createLogger({
  level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.printf(({ level: lvl, message, timestamp, stack, ...meta }) => {
          const base = `${timestamp} [${lvl}] ${message}`;
          const metaString = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return stack ? `${base} - ${stack}${metaString}` : `${base}${metaString}`;
        })
      ),
    }),
  ],
});

module.exports = logger;

