const express = require('express');
const { auth } = require('../../middlewares/auth');
const requireAdmin = require('../../middlewares/requireAdmin');
const { writeLimiter } = require('../../config/rateLimiter');
const upload = require('../../config/multer');
const providerController = require('./provider.controller');

const router = express.Router();

router.get('/', providerController.list);
router.get('/mine', auth(), providerController.getMyProvider);
router.get('/mine/products', auth(), providerController.getMyProducts);
router.put('/mine/products', auth(), writeLimiter, providerController.updateMyProducts);
router.post('/mine/avatar', auth(), upload.single('avatar'), providerController.uploadMyProviderAvatar);
router.get('/admin/pending', auth(), requireAdmin, providerController.listPendingModeration);
router.post('/admin/:id/moderate', auth(), requireAdmin, providerController.moderate);
router.post('/:id/claim', auth(), writeLimiter, providerController.claim);
router.post('/mine', auth(), writeLimiter, providerController.upsertMyProvider);
router.get('/:id', providerController.getOne);

module.exports = router;
