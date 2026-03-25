const express = require('express');
const { auth } = require('../../middlewares/auth');
const creditController = require('./credit.controller');

const router = express.Router();

router.use(auth());

router.get('/score', creditController.getScore);

module.exports = router;

