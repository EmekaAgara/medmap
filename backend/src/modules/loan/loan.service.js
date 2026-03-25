const { v4: uuidv4 } = require('uuid');
const LoanOffer = require('../../models/LoanOffer');
const LoanRequest = require('../../models/LoanRequest');
const Loan = require('../../models/Loan');
const Wallet = require('../../models/Wallet');

async function createOffer(lenderId, payload) {
  const lenderWallet = await Wallet.findOne({ user: lenderId });
  if (!lenderWallet) {
    throw Object.assign(new Error('Wallet not found for lender'), { status: 400 });
  }

  const offer = await LoanOffer.create({
    lender: lenderId,
    ...payload,
  });
  return offer;
}

async function listOffers({ longitude, latitude, radiusKm = 10, minAmount, maxAmount }) {
  const query = { status: 'active' };

  if (typeof minAmount === 'number' || typeof maxAmount === 'number') {
    query.minAmount = {};
    if (typeof minAmount === 'number') query.minAmount.$lte = maxAmount || minAmount;
  }

  if (longitude && latitude) {
    query.location = {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude],
        },
        $maxDistance: radiusKm * 1000,
      },
    };
  }

  const offers = await LoanOffer.find(query).sort({ createdAt: -1 }).limit(50);
  return offers;
}

async function requestLoan(borrowerId, offerId, amountRequested, message) {
  const offer = await LoanOffer.findById(offerId);
  if (!offer || offer.status !== 'active') {
    throw Object.assign(new Error('Offer not available'), { status: 400 });
  }
  if (amountRequested < offer.minAmount || amountRequested > offer.maxAmount) {
    throw Object.assign(new Error('Requested amount out of range'), { status: 400 });
  }

  const request = await LoanRequest.create({
    borrower: borrowerId,
    offer: offerId,
    amountRequested,
    message,
  });
  return request;
}

async function approveRequest(lenderId, requestId) {
  const request = await LoanRequest.findById(requestId).populate('offer');
  if (!request) {
    throw Object.assign(new Error('Request not found'), { status: 404 });
  }
  if (String(request.offer.lender) !== String(lenderId)) {
    throw Object.assign(new Error('Not authorized to approve this request'), { status: 403 });
  }
  if (request.status !== 'pending') {
    throw Object.assign(new Error('Request already processed'), { status: 400 });
  }

  const lenderWallet = await Wallet.findOne({ user: lenderId });
  if (!lenderWallet || lenderWallet.availableBalance < request.amountRequested) {
    throw Object.assign(new Error('Insufficient wallet balance'), { status: 400 });
  }

  lenderWallet.availableBalance -= request.amountRequested;
  lenderWallet.escrowBalance += request.amountRequested;
  await lenderWallet.save();

  request.status = 'approved';
  await request.save();

  const principal = request.amountRequested;
  const interestRate = request.offer.interestRate;
  const totalPayable = principal + (principal * interestRate) / 100;

  const loan = await Loan.create({
    lender: lenderId,
    borrower: request.borrower,
    offer: request.offer._id,
    request: request._id,
    principal,
    interestRate,
    totalPayable,
    tenureDays: request.offer.tenureDays,
    status: 'approved',
  });

  return loan;
}

async function disburseLoan(lenderId, loanId) {
  const loan = await Loan.findById(loanId);
  if (!loan) {
    throw Object.assign(new Error('Loan not found'), { status: 404 });
  }
  if (String(loan.lender) !== String(lenderId)) {
    throw Object.assign(new Error('Not authorized to disburse this loan'), { status: 403 });
  }
  if (loan.status !== 'approved') {
    throw Object.assign(new Error('Loan not in approved status'), { status: 400 });
  }

  const lenderWallet = await Wallet.findOne({ user: lenderId });
  const borrowerWallet = await Wallet.findOne({ user: loan.borrower });
  if (!lenderWallet || !borrowerWallet) {
    throw Object.assign(new Error('Wallets not found'), { status: 400 });
  }

  if (lenderWallet.escrowBalance < loan.principal) {
    throw Object.assign(new Error('Escrow balance insufficient'), { status: 400 });
  }

  lenderWallet.escrowBalance -= loan.principal;
  await lenderWallet.save();

  borrowerWallet.availableBalance += loan.principal;
  await borrowerWallet.save();

  loan.status = 'disbursed';
  loan.disbursedAt = new Date();
  await loan.save();

  return loan;
}

module.exports = {
  createOffer,
  listOffers,
  requestLoan,
  approveRequest,
  disburseLoan,
};

