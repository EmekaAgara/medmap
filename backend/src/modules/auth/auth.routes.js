const express = require('express');
const { auth } = require('../../middlewares/auth');
const deviceFingerprint = require('../../middlewares/deviceFingerprint');
const { authLimiter } = require('../../config/rateLimiter');
const authController = require('./auth.controller');

const router = express.Router();

router.use(deviceFingerprint);

router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/login/request-otp', authLimiter, authController.requestLoginOtp);
router.post('/login/otp', authLimiter, authController.loginWithOtp);
router.post('/verify-email', authLimiter, authController.verifyEmail);
router.post('/verify-email/resend', authLimiter, authController.resendVerificationEmail);
router.post('/password/forgot', authLimiter, authController.requestPasswordReset);
router.post('/password/reset', authLimiter, authController.resetPassword);
router.post('/refresh', authController.refresh);
router.post('/logout', auth(), authController.logout);
router.post('/transaction-pin', auth(), authController.setupPin);
router.post('/transaction-pin/change', auth(), authController.changePin);
router.post('/transaction-pin/verify', auth(), authController.verifyPin);
router.post('/change-password', auth(), authController.changePassword);

module.exports = router;

