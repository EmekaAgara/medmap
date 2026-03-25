const mongoose = require('mongoose');

const creditScoreSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    score: { type: Number, required: true },
    riskRating: {
      type: String,
      enum: ['Excellent', 'Good', 'Fair', 'Poor', 'Very Poor'],
      required: true,
    },
    loanLimit: { type: Number, required: true },
    factors: { type: Object },
    calculatedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CreditScore', creditScoreSchema);

