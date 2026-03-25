const express = require('express');
const { auth } = require('../../middlewares/auth');
const walletController = require('./wallet.controller');

const router = express.Router();

router.post('/webhooks/interswitch', walletController.interswitchWebhook);

router.use(auth());

router.get('/me', walletController.getWallet);
router.get('/me/transactions', walletController.getTransactions);
router.post('/me/fund', walletController.fundWallet);
router.post('/me/fund/verify', walletController.verifyFundWallet);

module.exports = router;

