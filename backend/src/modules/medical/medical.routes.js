const express = require('express');
const { auth } = require('../../middlewares/auth');
const medicalController = require('./medical.controller');

const router = express.Router();

router.use(auth());

router.get('/profile', medicalController.getMyProfile);
router.put('/profile', medicalController.upsertMyProfile);
router.get('/timeline', medicalController.getMyTimeline);

module.exports = router;

