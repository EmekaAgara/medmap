const CreditScore = require('../../models/CreditScore');
const Loan = require('../../models/Loan');
const Rating = require('../../models/Rating');
const { computeCreditScore } = require('../../utils/creditScore');

async function calculateForUser(userId) {
  const [loansAsBorrower, ratings, latestScore] = await Promise.all([
    Loan.find({ borrower: userId }),
    Rating.find({ toUser: userId }),
    CreditScore.findOne({ user: userId }),
  ]);

  const totalRepayments = loansAsBorrower.length;
  const onTimeRepayments = loansAsBorrower.filter((l) => l.status === 'repaid').length;
  const defaults = loansAsBorrower.filter((l) => l.status === 'defaulted').length;
  const successfulLoans = onTimeRepayments;

  const ratingsAverage =
    ratings.length > 0
      ? ratings.reduce((sum, r) => sum + (r.score || 0), 0) / ratings.length
      : 3;

  const createdAt = latestScore?.createdAt || new Date();
  const accountAgeDays = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

  const base = computeCreditScore({
    onTimeRepayments,
    totalRepayments,
    defaults,
    walletVolume: 0,
    ratingsAverage,
    accountAgeDays,
    successfulLoans,
  });

  const doc = await CreditScore.findOneAndUpdate(
    { user: userId },
    {
      user: userId,
      score: base.score,
      riskRating: base.riskRating,
      loanLimit: base.loanLimit,
      factors: {
        onTimeRepayments,
        totalRepayments,
        defaults,
        ratingsAverage,
        accountAgeDays,
        successfulLoans,
      },
      calculatedAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return doc;
}

async function getCurrentScore(userId) {
  const score = await CreditScore.findOne({ user: userId });
  if (!score) {
    return calculateForUser(userId);
  }
  return score;
}

module.exports = {
  calculateForUser,
  getCurrentScore,
};

