const express = require('express');
const { auth } = require('../../middlewares/auth');
const loanController = require('./loan.controller');

const router = express.Router();

router.use(auth());

router.post('/offers', loanController.createOffer);
router.get('/offers', loanController.listOffers);
router.post('/requests', loanController.requestLoan);
router.post('/requests/approve', loanController.approveRequest);
router.post('/disburse', loanController.disburseLoan);

module.exports = router;

