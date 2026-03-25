const { success, fail } = require('../../utils/responses');
const loanService = require('./loan.service');

async function createOffer(req, res) {
  try {
    const offer = await loanService.createOffer(req.user.id, req.body);
    return success(res, offer, 'Offer created', 201);
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function listOffers(req, res) {
  try {
    const { lng, lat, radiusKm, minAmount, maxAmount } = req.query;
    const offers = await loanService.listOffers({
      longitude: lng ? parseFloat(lng) : undefined,
      latitude: lat ? parseFloat(lat) : undefined,
      radiusKm: radiusKm ? parseFloat(radiusKm) : 10,
      minAmount: minAmount ? parseFloat(minAmount) : undefined,
      maxAmount: maxAmount ? parseFloat(maxAmount) : undefined,
    });
    return success(res, offers);
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function requestLoan(req, res) {
  try {
    const { offerId, amount, message } = req.body;
    const request = await loanService.requestLoan(req.user.id, offerId, amount, message);
    return success(res, request, 'Loan requested', 201);
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function approveRequest(req, res) {
  try {
    const { requestId } = req.body;
    const loan = await loanService.approveRequest(req.user.id, requestId);
    return success(res, loan, 'Loan approved');
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function disburseLoan(req, res) {
  try {
    const { loanId } = req.body;
    const loan = await loanService.disburseLoan(req.user.id, loanId);
    return success(res, loan, 'Loan disbursed');
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

module.exports = {
  createOffer,
  listOffers,
  requestLoan,
  approveRequest,
  disburseLoan,
};

