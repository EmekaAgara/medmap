const express = require('express');
const { auth } = require('../../middlewares/auth');
const requireAdmin = require('../../middlewares/requireAdmin');
const adminController = require('./admin.controller');

const router = express.Router();
router.use(auth(), requireAdmin);

router.get('/dashboard',              adminController.getDashboard);
router.get('/users',                  adminController.listUsers);
router.get('/users/:id',              adminController.getUserDetail);
router.put('/users/:id/kyc-status',   adminController.setKycStatus);
router.get('/users/account-type/pending', adminController.listPendingAccountTypeChanges);
router.post('/users/:id/account-type/review', adminController.reviewAccountTypeChange);
router.post('/users/:id/ban',         adminController.banUser);
router.post('/users/:id/unban',       adminController.unbanUser);
router.get('/kyc/pending',            adminController.listPendingKyc);
router.get('/activity',               adminController.getActivity);

module.exports = router;
