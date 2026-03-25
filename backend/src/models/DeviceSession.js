const mongoose = require('mongoose');

const deviceSessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    deviceId: { type: String, required: true },
    deviceInfo: {
      model: String,
      os: String,
    },
    ip: { type: String },
    userAgent: { type: String },
    refreshTokenHash: { type: String, required: true },
    lastSeenAt: { type: Date, default: Date.now },
    isBlacklisted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

deviceSessionSchema.index({ deviceId: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('DeviceSession', deviceSessionSchema);

