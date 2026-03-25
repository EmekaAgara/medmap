const { v4: uuidv4 } = require('uuid');
const Wallet = require('../../models/Wallet');
const Transaction = require('../../models/Transaction');
const env = require('../../config/env');
const { hasCredentials, interswitchRequest } = require('../../utils/interswitch');

async function getOrCreateWallet(userId) {
  let wallet = await Wallet.findOne({ user: userId });
  if (!wallet) {
    wallet = await Wallet.create({ user: userId });
  }
  return wallet;
}

async function getWalletSummary(userId) {
  const wallet = await getOrCreateWallet(userId);
  return wallet;
}

async function listTransactions(userId, { page = 1, limit = 20 }) {
  const wallet = await getOrCreateWallet(userId);
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Transaction.find({ wallet: wallet._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Transaction.countDocuments({ wallet: wallet._id }),
  ]);
  return {
    items,
    page,
    limit,
    total,
  };
}

async function initFundWallet(userId, amount) {
  const wallet = await getOrCreateWallet(userId);
  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    throw Object.assign(new Error('Amount must be greater than zero'), { status: 400 });
  }
  const normalizedAmount = Number(amount);
  const reference = `NEARME_FUND_${uuidv4()}`;

  await Transaction.create({
    wallet: wallet._id,
    user: userId,
    type: 'fund',
    amount: normalizedAmount,
    reference,
    provider: 'interswitch',
    status: 'pending',
  });

  let paymentLink = `${env.interswitch.redirectUrl}?tx_ref=${reference}`;
  let providerReference = reference;

  // If Interswitch credentials are available, call provider endpoint.
  // Otherwise return a safe fallback link so local/dev flows still work end-to-end.
  if (hasCredentials()) {
    const payload = {
      transactionRef: reference,
      amount: normalizedAmount,
      currency: wallet.currency,
      redirectUrl: env.interswitch.redirectUrl,
      customer: {
        userId: String(userId),
      },
    };

    const res = await interswitchRequest('/api/v1/payments', {
      method: 'POST',
      body: payload,
    });

    paymentLink = res.paymentLink || paymentLink;
    providerReference = res.providerReference || providerReference;
  }

  return {
    reference,
    provider: 'interswitch',
    providerReference,
    paymentLink,
  };
}

async function verifyFunding(reference) {
  const tx = await Transaction.findOne({ reference });
  if (!tx) throw Object.assign(new Error('Transaction not found'), { status: 404 });
  if (tx.status === 'success') return tx;

  if (!hasCredentials()) {
    return tx;
  }

  const verification = await interswitchRequest(`/api/v1/payments/${reference}`, { method: 'GET' });
  const status = String(verification.status || '').toLowerCase();
  if (status === 'success' || status === 'successful' || status === 'completed') {
    await applySuccessfulFunding(reference);
  }
  return Transaction.findOne({ reference }).lean();
}

async function applySuccessfulFunding(reference) {
  const tx = await Transaction.findOne({ reference });
  if (!tx || tx.status === 'success') return;

  const wallet = await Wallet.findById(tx.wallet);
  if (!wallet) return;

  wallet.availableBalance += tx.amount;
  tx.status = 'success';

  await Promise.all([wallet.save(), tx.save()]);
}

/**
 * Debit patient wallet for in-app purchases (e.g. product orders).
 */
async function debitWallet(userId, amount, { reference, meta = {} } = {}) {
  const wallet = await getOrCreateWallet(userId);
  const normalized = Number(amount);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw Object.assign(new Error('Amount must be greater than zero'), { status: 400 });
  }
  if (wallet.availableBalance < normalized) {
    throw Object.assign(new Error('Insufficient wallet balance'), { status: 400 });
  }

  const ref = reference || `NEARME_BILL_${uuidv4()}`;
  await Transaction.create({
    wallet: wallet._id,
    user: userId,
    type: 'bill_payment',
    amount: normalized,
    reference: ref,
    provider: 'internal',
    status: 'success',
    meta,
  });

  wallet.availableBalance -= normalized;
  await wallet.save();

  return { reference: ref, wallet };
}

module.exports = {
  getWalletSummary,
  listTransactions,
  initFundWallet,
  applySuccessfulFunding,
  verifyFunding,
  debitWallet,
};

