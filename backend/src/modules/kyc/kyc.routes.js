const express = require('express');
const { auth } = require('../../middlewares/auth');
const upload = require('../../config/multer');
const kycController = require('./kyc.controller');

const router = express.Router();
router.use(auth());

router.get('/',                              kycController.getStatus);
router.post('/bvn',                          kycController.submitBvn);
router.post('/skip-bvn',                     kycController.skipBvn);
router.post('/identity',                     kycController.submitIdentity);
router.post('/id-document', upload.single('document'), kycController.uploadIdDocument);
router.post('/selfie',      upload.single('selfie'),   kycController.uploadSelfie);
router.post('/bank',                         kycController.addBankAccount);
router.post('/submit',                       kycController.submitForReview);

module.exports = router;
