const mongoose = require('mongoose');

const loanRequestSchema = new mongoose.Schema(
  {
    borrower: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    offer: { type: mongoose.Schema.Types.ObjectId, ref: 'LoanOffer', required: true, index: true },
    amountRequested: { type: Number, required: true },
    message: { type: String },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'cancelled'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LoanRequest', loanRequestSchema);

