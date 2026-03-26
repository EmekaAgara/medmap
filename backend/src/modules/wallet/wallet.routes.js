const express = require("express");
const { auth } = require("../../middlewares/auth");
const walletController = require("./wallet.controller");

const router = express.Router();

router.post("/webhooks/interswitch", walletController.interswitchWebhook);
// Dashboard reachability checks; avoid falling through to JWT middleware.
router.head("/webhooks/interswitch", (req, res) => res.status(200).end());
router.get("/webhooks/interswitch", (req, res) =>
  res.status(200).json({ ok: true, message: "POST required" }),
);
router.options("/webhooks/interswitch", (req, res) => res.sendStatus(204));

router.post("/webpay/redirect", walletController.webpayRedirectNotification);
router.options("/webpay/redirect", (req, res) => res.sendStatus(204));

router.use(auth());

router.get("/me", walletController.getWallet);
router.get("/me/transactions/:id", walletController.getTransaction);
router.get("/me/transactions", walletController.getTransactions);
router.post("/me/fund", walletController.fundWallet);
router.post("/me/fund/verify", walletController.verifyFundWallet);

module.exports = router;
