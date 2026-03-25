const mongoose = require('mongoose');

const billPaymentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    wallet: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', required: true },
    category: {
      type: String,
      enum: ['electricity', 'airtime', 'internet', 'cable_tv', 'other'],
      required: true,
    },
    provider: { type: String, required: true },
    customerId: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'NGN' },
    status: {
      type: String,
      enum: ['pending', 'success', 'failed'],
      default: 'pending',
    },
    reference: { type: String, required: true, unique: true },
    providerReference: { type: String },
    meta: { type: Object },
  },
  { timestamps: true }
);

billPaymentSchema.index({ createdAt: -1 });

module.exports = mongoose.model('BillPayment', billPaymentSchema);

