const mongoose = require('mongoose');

const repaymentScheduleItemSchema = new mongoose.Schema(
  {
    dueDate: { type: Date, required: true },
    amountDue: { type: Number, required: true },
    amountPaid: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['pending', 'partial', 'paid', 'overdue'],
      default: 'pending',
    },
  },
  { _id: false }
);

const loanSchema = new mongoose.Schema(
  {
    lender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    borrower: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    offer: { type: mongoose.Schema.Types.ObjectId, ref: 'LoanOffer', required: true },
    request: { type: mongoose.Schema.Types.ObjectId, ref: 'LoanRequest', required: true },
    principal: { type: Number, required: true },
    interestRate: { type: Number, required: true },
    totalPayable: { type: Number, required: true },
    tenureDays: { type: Number, required: true },
    schedule: [repaymentScheduleItemSchema],
    status: {
      type: String,
      enum: [
        'pending',
        'approved',
        'disbursed',
        'active',
        'repaid',
        'defaulted',
        'cancelled',
        'disputed',
      ],
      default: 'pending',
      index: true,
    },
    escrowWalletId: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet' },
    disbursedAt: { type: Date },
    repaidAt: { type: Date },
    defaultedAt: { type: Date },
  },
  { timestamps: true }
);

loanSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Loan', loanSchema);

