const mongoose = require('mongoose');

const loginEventSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    eventType: {
      type: String,
      enum: ['login', 'login_failed'],
      required: true,
    },
    ip: { type: String },
    userAgent: { type: String },
    deviceId: { type: String },
    deviceModel: { type: String },
    deviceOs: { type: String },
    failReason: { type: String },
  },
  { timestamps: true }
);

// Auto-expire events after 90 days
loginEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('LoginEvent', loginEventSchema);
