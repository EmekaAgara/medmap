const mongoose = require('mongoose');
const env = require('./env');
const logger = require('./logger');

mongoose.set('strictQuery', true);

async function connectDb() {
  try {
    await mongoose.connect(env.mongoUri, {
      autoIndex: env.nodeEnv !== 'production',
    });
    logger.info('MongoDB connected');
  } catch (err) {
    logger.error('MongoDB connection error', { error: err.message });
    throw err;
  }
}

module.exports = {
  connectDb,
};

