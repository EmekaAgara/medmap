const express = require('express');
const { auth } = require('../../middlewares/auth');
const { writeLimiter } = require('../../config/rateLimiter');
const upload = require('../../config/multer');
const orderController = require('./order.controller');

const router = express.Router();

router.use(auth());

router.post('/prescriptions', writeLimiter, upload.single('file'), orderController.uploadPrescription);
router.post('/', writeLimiter, orderController.create);
router.post('/:id/pay', writeLimiter, orderController.completePay);
router.get('/mine/buyer', orderController.listBuyer);
router.get('/mine/seller', orderController.listSeller);
router.post('/:id/cancel', writeLimiter, orderController.cancel);
router.post('/:id/fulfill', writeLimiter, orderController.fulfill);
router.post('/:id/status', writeLimiter, orderController.updateStatus);
router.get('/:id', orderController.getOne);

module.exports = router;
