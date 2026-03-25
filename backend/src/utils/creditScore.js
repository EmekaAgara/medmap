function computeCreditScore({
  onTimeRepayments = 0,
  totalRepayments = 0,
  defaults = 0,
  walletVolume = 0,
  ratingsAverage = 0,
  accountAgeDays = 0,
  successfulLoans = 0,
}) {
  let score = 600;

  if (totalRepayments > 0) {
    const onTimeRatio = onTimeRepayments / totalRepayments;
    score += (onTimeRatio - 0.5) * 200;
  }

  score -= defaults * 20;

  if (walletVolume > 0) {
    score += Math.min(Math.log10(walletVolume + 1) * 20, 80);
  }

  score += (ratingsAverage - 3) * 20;
  score += Math.min(accountAgeDays / 30, 24);
  score += Math.min(successfulLoans * 3, 60);

  if (Number.isNaN(score)) score = 600;
  score = Math.max(300, Math.min(850, Math.round(score)));

  let riskRating = 'Fair';
  if (score >= 800) riskRating = 'Excellent';
  else if (score >= 700) riskRating = 'Good';
  else if (score >= 650) riskRating = 'Fair';
  else if (score >= 580) riskRating = 'Poor';
  else riskRating = 'Very Poor';

  let loanLimitMultiplier = 0.5;
  if (riskRating === 'Excellent') loanLimitMultiplier = 3;
  else if (riskRating === 'Good') loanLimitMultiplier = 2;
  else if (riskRating === 'Fair') loanLimitMultiplier = 1;
  else if (riskRating === 'Poor') loanLimitMultiplier = 0.5;
  else loanLimitMultiplier = 0.2;

  const loanLimit = loanLimitMultiplier;

  return {
    score,
    riskRating,
    loanLimit,
  };
}

module.exports = {
  computeCreditScore,
};

