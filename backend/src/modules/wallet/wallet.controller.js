const logger = require("../../config/logger");
const env = require("../../config/env");
const { success, fail } = require("../../utils/responses");
const walletService = require("./wallet.service");
const { verifyInterswitchWebhookSignature } = require("../../utils/interswitch");

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
    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "20", 10);
    const result = await walletService.listTransactions(req.user.id, {
      page,
      limit,
    });
    return success(res, result);
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function getTransaction(req, res) {
  try {
    const data = await walletService.getTransactionById(
      req.user.id,
      req.params.id,
    );
    return success(res, data);
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function fundWallet(req, res) {
  try {
    const { amount, meta } = req.body;
    if (!amount || amount <= 0) return fail(res, "Invalid amount", 400);
    const extraMeta =
      meta && typeof meta === "object" && !Array.isArray(meta) ? meta : {};
    const init = await walletService.initFundWallet(
      req.user.id,
      amount,
      extraMeta,
    );
    return success(res, init, "Funding initialized");
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function verifyFundWallet(req, res) {
  try {
    const { reference } = req.body;
    if (!reference) return fail(res, "reference is required", 400);
    const data = await walletService.verifyFunding(reference);
    return success(res, data, "Funding verification completed");
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function interswitchWebhook(req, res) {
  const signature =
    req.headers["x-interswitch-signature"] || req.headers["x-signature"];

  // Exact raw JSON string per https://docs.interswitchgroup.com/docs/webhooks
  const rawBody =
    req.rawBody != null
      ? req.rawBody.toString("utf8")
      : JSON.stringify(req.body || {});

  try {
    const valid = verifyInterswitchWebhookSignature(rawBody, signature);
    if (!valid) {
      return res.status(401).end();
    }

    const body = req.body || {};

    // Respond with 200 and no body *before* DB work — docs: slow responses cause duplicate deliveries.
    res.status(200).end();

    setImmediate(() => {
      walletService.handleQuicktellerWebhookPayload(body).catch((err) => {
        logger.error("Interswitch webhook async handler", {
          error: err.message,
        });
      });
    });
  } catch (err) {
    logger.error("Interswitch webhook handler error", { error: err.message });
    if (!res.headersSent) {
      return res.status(500).end();
    }
  }
}

/**
 * Web Checkout redirect notification — gateway POSTs txnref, amount, resp, etc.
 * Do not trust resp for value; we requery via gettransaction when the app polls /fund/verify.
 * @see https://docs.interswitchgroup.com/docs/web-checkout — Redirect Notification
 */
async function webpayRedirectNotification(req, res) {
  try {
    const reference =
      req.body?.txnref ||
      req.body?.txn_ref ||
      req.body?.transactionRef ||
      req.body?.tx_ref ||
      req.body?.reference;

    if (reference && env.interswitch.enableServerRequery) {
      await walletService.verifyFunding(reference);
    }

    return success(res, { processed: true });
  } catch (err) {
    return success(res, { processed: false, error: err.message }, 200);
  }
}

module.exports = {
  getWallet,
  getTransactions,
  getTransaction,
  fundWallet,
  verifyFundWallet,
  interswitchWebhook,
  webpayRedirectNotification,
};
