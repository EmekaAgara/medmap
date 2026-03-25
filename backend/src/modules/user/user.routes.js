const express = require('express');
const { auth } = require('../../middlewares/auth');
const upload = require('../../config/multer');
const userController = require('./user.controller');

const router = express.Router();

router.use(auth());

router.get('/me', userController.me);
router.put('/me', userController.updateMe);
router.put('/me/location', userController.updateMyLocation);
router.put('/me/push-token', userController.updateExpoPushToken);
router.get('/me/security', userController.getSecurity);
router.delete('/me/sessions/:deviceId', userController.revokeSession);
router.delete('/me/sessions', userController.revokeOtherSessions);
router.post('/me/kyc', userController.submitKyc);
router.post('/me/avatar', upload.single('avatar'), userController.uploadAvatar);
router.delete('/me/avatar', userController.deleteAvatar);
router.delete('/me', userController.deleteAccount);

router.post('/me/change-email', userController.requestEmailChange);
router.post('/me/change-email/verify-old', userController.verifyOldEmail);
router.post('/me/change-email/verify-new', userController.verifyNewEmail);
router.post('/me/change-phone', userController.requestPhoneChange);
router.post('/me/change-phone/verify', userController.verifyPhoneChange);

module.exports = router;

