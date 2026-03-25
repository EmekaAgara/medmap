const mongoose = require('mongoose');

const repaymentSchema = new mongoose.Schema(
  {
    loan: { type: mongoose.Schema.Types.ObjectId, ref: 'Loan', required: true, index: true },
    dueDate: { type: Date, required: true },
    amountDue: { type: Number, required: true },
    amountPaid: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['pending', 'partial', 'paid', 'overdue'],
      default: 'pending',
    },
    transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
  },
  { timestamps: true }
);

repaymentSchema.index({ dueDate: 1, status: 1 });

module.exports = mongoose.model('Repayment', repaymentSchema);

