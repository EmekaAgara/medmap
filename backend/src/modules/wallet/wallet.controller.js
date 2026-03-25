const { success, fail } = require('../../utils/responses');
const walletService = require('./wallet.service');
const { verifyInterswitchWebhookSignature } = require('../../utils/interswitch');

async function getWallet(req, res) {
  try {
    const wallet = await walletService.getWalletSummary(req.user.id);
    return success(res, wallet);
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function getTransactions(req, res) {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    const result = await walletService.listTransactions(req.user.id, { page, limit });
    return success(res, result);
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function fundWallet(req, res) {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) return fail(res, 'Invalid amount', 400);
    const init = await walletService.initFundWallet(req.user.id, amount);
    return success(res, init, 'Funding initialized');
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function verifyFundWallet(req, res) {
  try {
    const { reference } = req.body;
    if (!reference) return fail(res, 'reference is required', 400);
    const data = await walletService.verifyFunding(reference);
    return success(res, data, 'Funding verification completed');
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function interswitchWebhook(req, res) {
  try {
    const signature = req.headers['x-interswitch-signature'] || req.headers['x-signature'];
    const rawBody = JSON.stringify(req.body || {});
    const valid = verifyInterswitchWebhookSignature(rawBody, signature);
    if (!valid) return fail(res, 'Invalid webhook signature', 401);

    const reference =
      req.body?.transactionRef ||
      req.body?.tx_ref ||
      req.body?.reference;

    const paymentStatus = String(req.body?.status || '').toLowerCase();
    if (reference && (paymentStatus === 'successful' || paymentStatus === 'success' || paymentStatus === 'completed')) {
      await walletService.applySuccessfulFunding(reference);
    }
    return success(res, { processed: true });
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

module.exports = {
  getWallet,
  getTransactions,
  fundWallet,
  verifyFundWallet,
  interswitchWebhook,
};

