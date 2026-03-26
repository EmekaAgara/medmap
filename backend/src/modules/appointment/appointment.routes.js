const express = require('express');
const { auth } = require('../../middlewares/auth');
const { writeLimiter } = require('../../config/rateLimiter');
const appointmentController = require('./appointment.controller');

const router = express.Router();

router.use(auth());

router.post('/', writeLimiter, appointmentController.create);
router.get('/mine/patient', appointmentController.listPatient);
router.get('/mine/provider', appointmentController.listProvider);
router.get('/:id', appointmentController.getOne);
router.post('/:id/confirm', writeLimiter, appointmentController.confirm);
router.post('/:id/reject', writeLimiter, appointmentController.reject);
router.post('/:id/cancel', writeLimiter, appointmentController.cancel);
router.post('/:id/reschedule', writeLimiter, appointmentController.reschedule);
router.post('/:id/summary', writeLimiter, appointmentController.addVisitSummary);

module.exports = router;
