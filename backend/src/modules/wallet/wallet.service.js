const { v4: uuidv4 } = require("uuid");
const Wallet = require("../../models/Wallet");
const Transaction = require("../../models/Transaction");
const User = require("../../models/User");
const env = require("../../config/env");
const logger = require("../../config/logger");
const {
  hasCollectionsWallet,
  hasWebCheckoutCredentials,
  createWalletHostedCheckout,
  verifyRemotePayment,
  extractQuicktellerWebhookReference,
  isQuicktellerWebhookPaymentSuccess,
  amountNgnToKobo,
} = require("../../utils/interswitch");
const { notifyUser } = require("../../utils/notify");

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
      .limit(limit)
      .lean(),
    Transaction.countDocuments({ wallet: wallet._id }),
  ]);
  return {
    items,
    page,
    limit,
    total,
  };
}

async function getTransactionById(userId, transactionId) {
  const wallet = await getOrCreateWallet(userId);
  const id = String(transactionId || "").trim();
  if (!/^[a-f0-9]{24}$/i.test(id)) {
    throw Object.assign(new Error("Invalid transaction id"), { status: 400 });
  }
  const tx = await Transaction.findOne({ _id: id, wallet: wallet._id }).lean();
  if (!tx)
    throw Object.assign(new Error("Transaction not found"), { status: 404 });
  return tx;
}

async function initFundWallet(userId, amount, meta = {}) {
  const wallet = await getOrCreateWallet(userId);
  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    throw Object.assign(new Error("Amount must be greater than zero"), {
      status: 400,
    });
  }
  const normalizedAmount = Number(amount);
  const reference = `NEARME_FUND_${uuidv4()}`;

  const user = await User.findById(userId).select("email fullName").lean();

  await Transaction.create({
    wallet: wallet._id,
    user: userId,
    type: "fund",
    amount: normalizedAmount,
    reference,
    provider: "interswitch",
    status: "pending",
    meta: { ...meta, intent: meta.intent || "wallet_topup" },
  });

  const session = await createWalletHostedCheckout({
    transactionRef: reference,
    amountNgn: normalizedAmount,
    customerEmail: user?.email,
    customerName: user?.fullName,
    customerId: String(userId),
  });

  if (session.txMeta) {
    await Transaction.updateOne(
      { reference },
      { $set: { "meta.interswitch": session.txMeta } },
    );
  }

  return {
    reference,
    provider: "interswitch",
    providerReference: session.providerReference || reference,
    paymentLink: session.paymentLink,
    paymentHtml: session.paymentHtml || null,
    checkoutMode: session.checkoutMode,
    returnUrlPrefixes: [
      env.interswitch.redirectUrl,
      "interswitchng.com",
      "quickteller.com",
      "opaycheckout.com",
      "newwebpay.",
    ].filter(Boolean),
  };
}

async function verifyFunding(reference) {
  const tx = await Transaction.findOne({ reference });
  if (!tx)
    throw Object.assign(new Error("Transaction not found"), { status: 404 });
  if (tx.status === "success") return tx;

  if (!hasCollectionsWallet() && !hasWebCheckoutCredentials()) {
    return Transaction.findOne({ reference }).lean();
  }

  // Default: rely on Quickteller webhooks (HMAC + payload) per Interswitch docs — no server requery.
  if (!env.interswitch.enableServerRequery) {
    return Transaction.findOne({ reference }).lean();
  }

  let remote;
  try {
    remote = await verifyRemotePayment(
      reference,
      tx.toObject ? tx.toObject() : tx,
    );
  } catch (e) {
    logger.warn("verifyRemotePayment failed (returning pending tx)", {
      reference,
      err: e.message,
    });
    return Transaction.findOne({ reference }).lean();
  }
  if (remote.ok) {
    await applySuccessfulFunding(reference);
  }
  return Transaction.findOne({ reference }).lean();
}

async function applySuccessfulFunding(reference) {
  const tx = await Transaction.findOne({ reference });
  if (!tx || tx.status === "success") return;

  const wallet = await Wallet.findById(tx.wallet);
  if (!wallet) return;

  wallet.availableBalance += tx.amount;
  tx.status = "success";

  await Promise.all([wallet.save(), tx.save()]);

  // Notify wallet owner.
  await notifyUser({
    userId: tx.user,
    type: "wallet_topup",
    title: "Wallet credited",
    body: `Your wallet was credited with ₦${Number(tx.amount || 0).toLocaleString()}.`,
    data: { type: "wallet", reference: tx.reference },
    push: true,
    email: true,
    emailSubject: "MedMap wallet top-up",
  });
}

/**
 * Apply credit from a verified Quickteller webhook `data` object (amount is in minor units for NGN).
 */
async function applySuccessfulFundingAfterWebhook(reference, paymentData) {
  const tx = await Transaction.findOne({ reference });
  if (!tx || tx.status === "success") return;

  if (paymentData && typeof paymentData === "object") {
    const wireKobo = Number(paymentData.amount);
    if (Number.isFinite(wireKobo) && wireKobo > 0) {
      const expectedKobo = amountNgnToKobo(tx.amount);
      const majorNgn = Math.round(Number(tx.amount));
      const matches =
        wireKobo === expectedKobo ||
        wireKobo === majorNgn ||
        Math.abs(wireKobo - expectedKobo) <= 5;
      if (!matches) {
        logger.warn("Interswitch webhook amount mismatch (not crediting)", {
          reference,
          webhookAmount: wireKobo,
          expectedKobo,
          txAmountNgn: tx.amount,
        });
        return;
      }
    }
  }

  await applySuccessfulFunding(reference);
}

/**
 * Process body after HMAC verification and HTTP 200 acknowledgement (Interswitch retries if we are slow).
 * @see https://docs.interswitchgroup.com/docs/webhooks
 */
async function handleQuicktellerWebhookPayload(body) {
  if (!body || typeof body !== "object") return;

  const reference =
    extractQuicktellerWebhookReference(body) ||
    body.transactionRef ||
    body.tx_ref ||
    body.txn_ref ||
    body.txnref ||
    body.reference;

  const legacyFlat = String(
    body.status || body.paymentStatus || "",
  ).toLowerCase();
  const legacyResp = String(
    body.resp ?? body.Resp ?? body.responseCode ?? body.ResponseCode ?? "",
  ).trim();

  const isSuccess =
    isQuicktellerWebhookPaymentSuccess(body) ||
    (!!reference &&
      (legacyFlat === "successful" ||
        legacyFlat === "success" ||
        legacyFlat === "completed" ||
        legacyResp === "00" ||
        legacyResp === "10"));

  const data = body.data && typeof body.data === "object" ? body.data : {};

  if (reference && isSuccess) {
    await applySuccessfulFundingAfterWebhook(reference, data);
  } else if (Object.keys(body).length) {
    logger.info("Interswitch webhook ignored or no match", {
      event: body.event,
      reference,
      isSuccess,
    });
  }
}

/**
 * Credit wallet (refunds, provider earnings).
 */
async function creditWallet(
  userId,
  amount,
  { reference, meta = {}, type = "transfer_in" } = {},
) {
  const wallet = await getOrCreateWallet(userId);
  const normalized = Number(amount);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw Object.assign(new Error("Amount must be greater than zero"), {
      status: 400,
    });
  }
  const ref = reference || `NEARME_CREDIT_${uuidv4()}`;
  await Transaction.create({
    wallet: wallet._id,
    user: userId,
    type,
    amount: normalized,
    reference: ref,
    provider: "internal",
    status: "success",
    meta,
  });

  wallet.availableBalance += normalized;
  await wallet.save();

  return { reference: ref, wallet };
}

/**
 * Debit patient wallet for in-app purchases (e.g. product orders, appointment booking).
 * `ledgerType` can be `transfer_out` for provider clawbacks.
 */
async function debitWallet(
  userId,
  amount,
  { reference, meta = {}, ledgerType = "bill_payment" } = {},
) {
  const wallet = await getOrCreateWallet(userId);
  const normalized = Number(amount);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw Object.assign(new Error("Amount must be greater than zero"), {
      status: 400,
    });
  }
  if (wallet.availableBalance < normalized) {
    throw Object.assign(new Error("Insufficient wallet balance"), {
      status: 400,
    });
  }

  const ref = reference || `NEARME_BILL_${uuidv4()}`;
  await Transaction.create({
    wallet: wallet._id,
    user: userId,
    type: ledgerType,
    amount: normalized,
    reference: ref,
    provider: "internal",
    status: "success",
    meta,
  });

  wallet.availableBalance -= normalized;
  await wallet.save();

  return { reference: ref, wallet };
}

const SETTLE_PREFIX = "SETTLE_";

/**
 * Pay provider net-of-fee after appointment confirmation or order fulfillment.
 * Idempotent per patient payment reference.
 */
async function settleProviderEarnings({
  providerUserId,
  grossAmount,
  patientPaymentReference,
  meta = {},
}) {
  if (!patientPaymentReference) return null;

  const billTxEarly = await Transaction.findOne({
    reference: patientPaymentReference,
    type: "bill_payment",
    status: "success",
  });
  if (billTxEarly?.meta?.settlement?.settled) {
    return billTxEarly.meta.settlement;
  }

  const settleRef = `${SETTLE_PREFIX}${patientPaymentReference}`;
  const existing = await Transaction.findOne({ reference: settleRef }).lean();
  if (existing) return billTxEarly?.meta?.settlement || existing.meta || null;

  const gross = Number(grossAmount) || 0;
  if (!providerUserId || gross <= 0) return null;

  const bps = Number(env.platformFeeBps) || 0;
  const platformFee = Math.floor((gross * bps) / 10000);
  const providerNet = gross - platformFee;

  const billTx = billTxEarly;

  const settlementSummary = {
    platformFee,
    providerNet,
    gross,
    providerUserId: String(providerUserId),
    settledAt: new Date().toISOString(),
    settled: true,
  };

  if (providerNet > 0) {
    await creditWallet(providerUserId, providerNet, {
      reference: settleRef,
      meta: {
        ...meta,
        patientPaymentReference,
        grossAmount: gross,
        platformFee,
      },
      type: "transfer_in",
    });
  }

  if (billTx) {
    billTx.meta = { ...(billTx.meta || {}), settlement: settlementSummary };
    await billTx.save();
  }

  return settlementSummary;
}

/**
 * Refund a successful bill_payment to the patient. If settlement already ran, claw back provider net first.
 */
async function refundBillPayment(billReference, { reason = "" } = {}) {
  const orig = await Transaction.findOne({
    reference: billReference,
    type: "bill_payment",
    status: "success",
  });
  if (!orig) return { skipped: true, reason: "no_payment" };

  const refundRef = `REFUND_${billReference}`;
  if (await Transaction.findOne({ reference: refundRef })) {
    return { alreadyRefunded: true };
  }

  const gross = Number(orig.amount) || 0;
  const settlement = orig.meta?.settlement;

  if (
    settlement?.settled &&
    settlement.providerNet > 0 &&
    settlement.providerUserId
  ) {
    await debitWallet(
      settlement.providerUserId,
      Number(settlement.providerNet),
      {
        reference: `CLAWBACK_${billReference}`,
        meta: { clawbackFor: billReference, reason },
        ledgerType: "transfer_out",
      },
    );
  }

  await creditWallet(orig.user, gross, {
    reference: refundRef,
    type: "refund",
    meta: {
      originalReference: billReference,
      reason: String(reason).slice(0, 500),
    },
  });

  return { refunded: gross };
}

async function getPlatformReconciliation({ limit = 100 } = {}) {
  const recentSettlements = await Transaction.find({
    type: "bill_payment",
    "meta.settlement.settled": true,
  })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .select("reference amount meta.settlement createdAt user")
    .lean();

  const agg = await Transaction.aggregate([
    {
      $match: {
        type: "bill_payment",
        "meta.settlement.platformFee": { $exists: true },
      },
    },
    {
      $group: {
        _id: null,
        totalPlatformFees: { $sum: "$meta.settlement.platformFee" },
        totalGross: { $sum: "$meta.settlement.gross" },
        settledCount: { $sum: 1 },
      },
    },
  ]);

  const totals = agg[0] || {
    totalPlatformFees: 0,
    totalGross: 0,
    settledCount: 0,
  };

  return {
    platformFeeBps: env.platformFeeBps,
    totals: {
      platformFeesNGN: totals.totalPlatformFees || 0,
      grossVolumeNGN: totals.totalGross || 0,
      settledTransactions: totals.settledCount || 0,
    },
    recentSettlements,
  };
}

module.exports = {
  getWalletSummary,
  listTransactions,
  getTransactionById,
  initFundWallet,
  applySuccessfulFunding,
  verifyFunding,
  handleQuicktellerWebhookPayload,
  debitWallet,
  creditWallet,
  settleProviderEarnings,
  refundBillPayment,
  getPlatformReconciliation,
};
