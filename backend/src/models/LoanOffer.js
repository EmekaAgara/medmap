const mongoose = require('mongoose');

const loanOfferSchema = new mongoose.Schema(
  {
    lender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    minAmount: { type: Number, required: true },
    maxAmount: { type: Number, required: true },
    interestRate: { type: Number, required: true },
    tenureDays: { type: Number, required: true },
    repaymentScheduleType: {
      type: String,
      enum: ['weekly', 'monthly', 'once'],
      default: 'monthly',
    },
    communitiesAllowed: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Community' }],
    locationRangeKm: { type: Number, default: 10 },
    location: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: {
        type: [Number],
      },
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    maxConcurrentLoans: { type: Number, default: 5 },
  },
  { timestamps: true }
);

loanOfferSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('LoanOffer', loanOfferSchema);

