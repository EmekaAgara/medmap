const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    wallet: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: [
        'fund',
        'withdraw',
        'transfer_in',
        'transfer_out',
        'loan_disbursement',
        'loan_repayment',
        'bill_payment',
        'refund',
      ],
      required: true,
    },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'NGN' },
    reference: { type: String, required: true, unique: true },
    provider: { type: String, enum: ['interswitch', 'internal'], default: 'internal' },
    status: {
      type: String,
      enum: ['pending', 'success', 'failed'],
      default: 'pending',
    },
    meta: { type: Object },
  },
  { timestamps: true }
);

transactionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);

