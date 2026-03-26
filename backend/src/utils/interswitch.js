/**
 * Interswitch Web Checkout integration.
 * @see https://docs.interswitchgroup.com/docs/web-checkout — Web Redirect, redirect notification, gettransaction
 */
const crypto = require("crypto");
const env = require("../config/env");
const fetch = (() => {
  const mod = require("node-fetch");
  return typeof mod === "function" ? mod : mod.default;
})();
const logger = require("../config/logger");

/** Merchant + pay item + site_redirect_url (required for Web Redirect). */
function hasWebRedirectConfig() {
  return !!(
    env.interswitch.merchantCode &&
    env.interswitch.payableCode &&
    env.interswitch.redirectUrl
  );
}

/** @deprecated Use hasWebRedirectConfig */
function hasQuickstartRedirectFields() {
  return hasWebRedirectConfig();
}

function hasWebCheckoutCredentials() {
  return hasWebRedirectConfig();
}

function sha512HexUpper(s) {
  return crypto
    .createHash("sha512")
    .update(String(s), "utf8")
    .digest("hex")
    .toUpperCase();
}

function escapeHtmlAttr(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

/**
 * Option 2 — Web Redirect: POST to newwebpay …/collections/w/pay
 * Amount in minor units (kobo). currency 566 = NGN.
 */
function buildWebRedirectAutoSubmitHtml({
  actionUrl,
  merchantCode,
  payItemId,
  siteRedirectUrl,
  txnRef,
  amountKobo,
  currencyNumeric,
  custEmail,
  custName,
  custId,
  payItemName,
}) {
  const action = escapeHtmlAttr(actionUrl);
  const mc = escapeHtmlAttr(merchantCode);
  const pi = escapeHtmlAttr(payItemId);
  const redir = escapeHtmlAttr(siteRedirectUrl);
  const ref = escapeHtmlAttr(txnRef);
  const amt = escapeHtmlAttr(String(amountKobo));
  const cur = escapeHtmlAttr(String(currencyNumeric));
  const mail = escapeHtmlAttr(custEmail);
  const cname = custName ? escapeHtmlAttr(custName) : "";
  const cid = custId != null && String(custId).trim() ? escapeHtmlAttr(custId) : "";
  const piname = escapeHtmlAttr(payItemName || "MedMap");

  const nameInput = custName
    ? `<input type="hidden" name="cust_name" value="${cname}" />`
    : "";
  const idInput = cid
    ? `<input type="hidden" name="cust_id" value="${cid}" />`
    : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>
<form id="pay" method="post" action="${action}">
<input type="hidden" name="merchant_code" value="${mc}" />
<input type="hidden" name="pay_item_id" value="${pi}" />
<input type="hidden" name="site_redirect_url" value="${redir}" />
<input type="hidden" name="txn_ref" value="${ref}" />
<input type="hidden" name="amount" value="${amt}" />
<input type="hidden" name="currency" value="${cur}" />
<input type="hidden" name="cust_email" value="${mail}" />
${nameInput}
${idInput}
<input type="hidden" name="pay_item_name" value="${piname}" />
</form>
<script>document.getElementById('pay').submit();</script>
</body></html>`;
}

function amountNgnToKobo(amountNgn) {
  const n = Number(amountNgn);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.max(1, Math.round(n * 100));
}

/**
 * Confirming transaction status — GET gettransaction.json
 * @see https://docs.interswitchgroup.com/docs/web-checkout
 */
async function requeryWebCheckoutTransaction({
  merchantCode,
  transactionRef,
  amountKobo,
}) {
  if (!merchantCode || !transactionRef || amountKobo == null) {
    return { ok: false, amountMatches: false, data: null };
  }

  const base =
    env.interswitch.webPayMode === "LIVE"
      ? env.interswitch.requeryBaseUrlLive
      : env.interswitch.requeryBaseUrlTest;
  const path = env.interswitch.getTransactionPath;
  const qs = new URLSearchParams({
    merchantcode: merchantCode,
    transactionreference: transactionRef,
    amount: String(amountKobo),
  });
  const url = `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}?${qs.toString()}`;

  const expectedKobo = Number(amountKobo);
  const expectedMajor = Math.round(expectedKobo / 100);

  function parseResult(data) {
    const code = String(data?.ResponseCode ?? data?.responseCode ?? "").trim();
    const desc =
      data?.responseDescription ||
      data?.ResponseDescription ||
      data?.message ||
      "";
    // Web Checkout docs: only confirm completion server-side; do not treat other "success" messages
    // (e.g. token/session generation) as payment completion.
    const approved = code === "00";
    const apiAmount = Number(data?.Amount ?? data?.amount ?? 0);
    const amountOk =
      apiAmount === expectedKobo ||
      apiAmount === expectedMajor ||
      Math.abs(apiAmount - expectedKobo) <= 2;
    return { approved, amountOk, code, apiAmount, desc };
  }

  function outcome(res, data) {
    const p = parseResult(data);
    const ok =
      res.ok && p.approved && p.amountOk && Number.isFinite(p.apiAmount);
    return { ok, amountMatches: p.amountOk, data };
  }

  async function getPlain() {
    const res = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json().catch(() => ({}));
    return outcome(res, data);
  }

  const plain = await getPlain();
  if (plain.ok) return plain;

  const mac = env.interswitch.macKey;
  const productId = env.interswitch.payableCode;
  const hashCandidates = mac
    ? [
        `${productId}${transactionRef}${amountKobo}${mac}`,
        `${merchantCode}${transactionRef}${amountKobo}${mac}`,
        `${productId}${transactionRef}${mac}`,
        `${merchantCode}${transactionRef}${mac}`,
        `${productId}&${transactionRef}&${amountKobo}&${mac}`,
      ]
    : [];

  for (const hs of hashCandidates) {
    const hash = sha512HexUpper(hs);
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Hash: hash,
      },
    });
    const data = await res.json().catch(() => ({}));
    const o = outcome(res, data);
    if (o.ok) return o;
  }

  return plain;
}

/** Optional Pay Bill link API (QuickStart Path C). */
async function initializePayBillCheckout({
  transactionRef,
  amountKobo,
  customerEmail,
}) {
  const path = env.interswitch.payBillPath || "/collections/api/v1/pay-bill";
  const url = `${env.interswitch.baseUrl}${path}`;
  const email = String(customerEmail || "").trim();
  if (!email.includes("@")) {
    throw Object.assign(
      new Error("A valid customer email is required for Interswitch checkout"),
      { status: 400 },
    );
  }

  const payload = {
    merchantCode: env.interswitch.merchantCode,
    payableCode: env.interswitch.payableCode,
    amount: String(amountKobo),
    redirectUrl: env.interswitch.redirectUrl,
    customerId: email,
    currencyCode: "566",
    customerEmail: email,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    logger.error("Interswitch pay-bill error", { status: res.status, data });
    throw Object.assign(
      new Error(data.message || data.error || "Pay Bill failed"),
      { status: res.status },
    );
  }

  const paymentLink =
    data.paymentUrl ||
    data.paymentLink ||
    data.url ||
    data.checkoutUrl ||
    data.redirectUrl;
  if (!paymentLink) {
    logger.warn("Pay Bill response missing paymentUrl", data);
    throw Object.assign(new Error("Pay Bill did not return a payment URL"), {
      status: 502,
    });
  }

  const gatewayRef =
    data.reference ||
    data.transactionReference ||
    data.merchantReference ||
    transactionRef;

  return {
    paymentLink,
    paymentHtml: null,
    providerReference: gatewayRef,
    checkoutMode: "web_checkout_pay_bill",
    txMeta: {
      checkoutMode: "web_checkout_pay_bill",
      amountKobo,
      merchantCode: env.interswitch.merchantCode,
      payItemId: env.interswitch.payableCode,
      verifyReference: gatewayRef,
      gatewayReference: data.reference || null,
    },
    raw: data,
  };
}

/**
 * Start wallet top-up: Web Redirect (default) or Pay Bill when INTERSWITCH_USE_PAY_BILL=true.
 */
async function createWalletHostedCheckout({
  transactionRef,
  amountNgn,
  customerEmail,
  customerName,
  customerId,
}) {
  if (!hasWebRedirectConfig()) {
    throw Object.assign(
      new Error(
        "Interswitch Web Checkout is not configured. Set INTERSWITCH_MERCHANT_CODE, INTERSWITCH_PAYABLE_CODE, and INTERSWITCH_REDIRECT_URL.",
      ),
      { status: 503 },
    );
  }

  const amountKobo = amountNgnToKobo(amountNgn);
  const email = String(customerEmail || "").trim();
  if (!email.includes("@")) {
    throw Object.assign(
      new Error("A valid user email is required for Interswitch Web Checkout (cust_email)."),
      { status: 400 },
    );
  }

  if (env.interswitch.usePayBill) {
    return initializePayBillCheckout({
      transactionRef,
      amountKobo,
      customerEmail: email,
    });
  }

  const actionUrl =
    env.interswitch.webPayMode === "LIVE"
      ? env.interswitch.webPayActionUrlLive
      : env.interswitch.webPayActionUrlTest;

  const html = buildWebRedirectAutoSubmitHtml({
    actionUrl,
    merchantCode: env.interswitch.merchantCode,
    payItemId: env.interswitch.payableCode,
    siteRedirectUrl: env.interswitch.redirectUrl,
    txnRef: transactionRef,
    amountKobo,
    currencyNumeric: 566,
    custEmail: email,
    custName: customerName,
    custId: customerId,
    payItemName: "MedMap wallet top-up",
  });

  return {
    paymentHtml: html,
    paymentLink: null,
    providerReference: transactionRef,
    checkoutMode: "web_checkout_redirect",
    txMeta: {
      checkoutMode: "web_checkout_redirect",
      amountKobo,
      merchantCode: env.interswitch.merchantCode,
      payItemId: env.interswitch.payableCode,
      verifyReference: transactionRef,
    },
    raw: null,
  };
}

/** OPay collections status — only for legacy pending txs. */
async function queryCollectionsStatus(transactionReference) {
  const path =
    env.interswitch.collectionsStatusPath ||
    "/collections/api/v1/opay/status";
  const url = `${env.interswitch.baseUrl}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reference: transactionReference }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    logger.warn("Interswitch OPay status HTTP error", {
      status: res.status,
      data,
    });
    return { ok: false, data };
  }
  const code = String(
    data.responseCode ?? data.ResponseCode ?? data.response_code ?? "",
  ).toUpperCase();
  const desc =
    data.responseDescription || data.ResponseDescription || data.message || "";
  const ok =
    code === "00" || code === "10" || /success|approved|completed/i.test(desc);
  return { ok, responseCode: code, data };
}

function hasCollectionsWallet() {
  return !!(env.interswitch.merchantCode && env.interswitch.payableCode);
}

function isWebCheckoutRequeryMode(checkoutMode) {
  return (
    checkoutMode === "web_checkout_redirect" ||
    checkoutMode === "web_checkout_pay_bill" ||
    checkoutMode === "quickstart_web_redirect" ||
    checkoutMode === "quickstart_pay_bill" ||
    checkoutMode === "interswitch_web_checkout"
  );
}

async function verifyRemotePayment(reference, txLean) {
  const metaInterswitch = txLean?.meta?.interswitch || {};
  const checkoutMode = metaInterswitch.checkoutMode;
  const amountKobo =
    metaInterswitch.amountKobo ?? amountNgnToKobo(txLean?.amount);
  const merchant = metaInterswitch.merchantCode || env.interswitch.merchantCode;
  const verifyRef =
    metaInterswitch.verifyReference ||
    metaInterswitch.gatewayReference ||
    reference;

  const tryGetTransaction = async (txnRef) => {
    if (!merchant || !txnRef || !amountKobo) return { ok: false, data: null };
    const r = await requeryWebCheckoutTransaction({
      merchantCode: merchant,
      transactionRef: txnRef,
      amountKobo,
    });
    return { ok: r.ok, data: r.data };
  };

  if (isWebCheckoutRequeryMode(checkoutMode)) {
    const refs = [...new Set([verifyRef, reference].filter(Boolean))];
    for (const ref of refs) {
      const r = await tryGetTransaction(ref);
      if (r.ok) return r;
    }
    return { ok: false, data: null };
  }

  if (checkoutMode === "interswitch_opay") {
    return queryCollectionsStatus(reference);
  }

  if (merchant && amountKobo) {
    const refs = [...new Set([verifyRef, reference].filter(Boolean))];
    for (const ref of refs) {
      const r = await tryGetTransaction(ref);
      if (r.ok) return { ok: true, data: r.data };
    }
  }

  if (hasCollectionsWallet()) {
    return queryCollectionsStatus(reference);
  }

  return { ok: false, data: null };
}

function verifyInterswitchWebhookSignature(rawBody, signatureHeader) {
  if (!env.interswitch.webhookSecret) {
    logger.warn(
      "Interswitch webhooks are not signature-verified (set INTERSWITCH_WEBHOOK_SECRET in production)",
    );
    return true;
  }
  if (signatureHeader == null || rawBody == null) return false;
  const signature = String(signatureHeader).trim();
  if (!signature) return false;

  const raw = Buffer.isBuffer(rawBody)
    ? rawBody.toString("utf8")
    : String(rawBody);
  const expectedHex = crypto
    .createHmac("sha512", env.interswitch.webhookSecret)
    .update(raw, "utf8")
    .digest("hex");

  const sigHex = signature.toLowerCase();
  const exp = expectedHex.toLowerCase();
  if (!/^[0-9a-f]+$/i.test(sigHex) || sigHex.length !== exp.length) {
    return false;
  }
  try {
    return crypto.timingSafeEqual(
      Buffer.from(sigHex, "hex"),
      Buffer.from(exp, "hex"),
    );
  } catch {
    return false;
  }
}

function extractQuicktellerWebhookReference(body) {
  if (!body || typeof body !== "object") return null;
  const data = body.data && typeof body.data === "object" ? body.data : {};
  const tryStr = (v) => (v != null && String(v).trim() ? String(v).trim() : "");

  const direct = [
    tryStr(data.merchantReference),
    tryStr(data.MerchantReference),
    tryStr(data.merchant_reference),
    tryStr(body.merchantReference),
  ].find(Boolean);
  if (direct) return direct;

  const nested = JSON.stringify(body).match(/NEARME_FUND_[0-9a-f-]{36}/i);
  if (nested) return nested[0];

  const uuid = tryStr(body.uuid);
  if (uuid.startsWith("NEARME_FUND_")) return uuid;

  const payRef = tryStr(data.paymentReference);
  if (payRef.startsWith("NEARME_FUND_")) return payRef;

  return null;
}

function isQuicktellerWebhookPaymentSuccess(body) {
  if (!body || typeof body !== "object") return false;
  const data = body.data && typeof body.data === "object" ? body.data : {};
  const event = String(body.event || "").trim();
  const upper = event.toUpperCase();

  if (
    /_FAILURE$/i.test(event) ||
    /TRANSACTION_FAILURE/i.test(upper) ||
    /CANCELLED$/i.test(event)
  ) {
    return false;
  }

  if (/TRANSACTION_SUCCESSFUL$/i.test(event)) {
    return true;
  }

  if (upper === "TRANSACTION.CREATED") {
    return false;
  }

  const respCode = String(
    data.responseCode ??
      data.ResponseCode ??
      body.responseCode ??
      body.ResponseCode ??
      "",
  ).trim();
  const okCode = respCode === "00";

  if (upper === "TRANSACTION.COMPLETED" || upper === "TRANSACTION.UPDATED") {
    return okCode;
  }

  return okCode;
}

module.exports = {
  hasWebRedirectConfig,
  hasWebCheckoutCredentials,
  hasQuickstartRedirectFields,
  hasCollectionsWallet,
  createWalletHostedCheckout,
  verifyRemotePayment,
  verifyInterswitchWebhookSignature,
  extractQuicktellerWebhookReference,
  isQuicktellerWebhookPaymentSuccess,
  amountNgnToKobo,
  requeryWebCheckoutTransaction,
};
