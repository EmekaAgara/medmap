const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    availableBalance: { type: Number, default: 0 },
    escrowBalance: { type: Number, default: 0 },
    currency: { type: String, default: 'NGN' },
    virtualAccount: {
      accountNumber: String,
      bankName: String,
      providerReference: String,
    },
    status: {
      type: String,
      enum: ['active', 'frozen'],
      default: 'active',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Wallet', walletSchema);

