const express = require('express');

const router = express.Router();

router.use('/auth',  require('../modules/auth/auth.routes'));
router.use('/users', require('../modules/user/user.routes'));
router.use('/providers', require('../modules/provider/provider.routes'));
router.use('/messages', require('../modules/messages/messages.routes'));
router.use('/appointments', require('../modules/appointment/appointment.routes'));
router.use('/orders', require('../modules/order/order.routes'));
router.use('/notifications', require('../modules/notifications/notifications.routes'));
router.use('/kyc',   require('../modules/kyc/kyc.routes'));
router.use('/admin', require('../modules/admin/admin.routes'));
router.use('/wallets', require('../modules/wallet/wallet.routes'));
router.use('/loans',   require('../modules/loan/loan.routes'));
router.use('/credit',  require('../modules/credit/credit.routes'));

router.get('/', (req, res) => {
  res.json({ message: 'MedMap API v1' });
});

module.exports = router;

