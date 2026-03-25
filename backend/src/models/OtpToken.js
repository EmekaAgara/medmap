const mongoose = require('mongoose');

const otpTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    email: { type: String, required: true, lowercase: true, index: true },
    purpose: {
      type: String,
      enum: ['email_verification', 'password_reset', 'login', 'email_change_old', 'email_change_new', 'phone_change'],
      required: true,
      index: true,
    },
    // Stores the pending new value for email_change / phone_change purposes
    newValue: { type: String },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: true },
    consumedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('OtpToken', otpTokenSchema);

