const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    unitPrice: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    buyerUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    provider: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider', required: true, index: true },
    providerOwnerUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    items: { type: [orderItemSchema], required: true, default: [] },
    totalAmount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'NGN' },
    status: {
      type: String,
      enum: ['pending_payment', 'paid', 'fulfilled', 'cancelled'],
      default: 'pending_payment',
      index: true,
    },
    paymentReference: { type: String, trim: true },
    paidAt: { type: Date },
  },
  { timestamps: true }
);

orderSchema.index({ buyerUser: 1, createdAt: -1 });
orderSchema.index({ providerOwnerUser: 1, createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);
