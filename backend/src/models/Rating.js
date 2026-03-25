const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema(
  {
    loan: { type: mongoose.Schema.Types.ObjectId, ref: 'Loan', required: true, index: true },
    fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    toUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['lender', 'borrower'], required: true },
    score: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String },
  },
  { timestamps: true }
);

ratingSchema.index({ toUser: 1, createdAt: -1 });

module.exports = mongoose.model('Rating', ratingSchema);

