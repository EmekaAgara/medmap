const { success, fail } = require('../../utils/responses');
const appointmentService = require('./appointment.service');

async function create(req, res) {
  try {
    const data = await appointmentService.createRequest(req.user.id, req.body);
    return success(res, data, 'Appointment request sent', 201);
  } catch (err) {
    return fail(res, err.message, err.status || 500, err.details ?? null);
  }
}

async function listPatient(req, res) {
  try {
    const data = await appointmentService.listAsPatient(req.user.id);
    return success(res, data);
  } catch (err) {
    return fail(res, err.message, err.status || 500, err.details ?? null);
  }
}

async function listProvider(req, res) {
  try {
    const data = await appointmentService.listAsProvider(req.user.id);
    return success(res, data);
  } catch (err) {
    return fail(res, err.message, err.status || 500, err.details ?? null);
  }
}

async function getOne(req, res) {
  try {
    const data = await appointmentService.getOneForUser(req.params.id, req.user.id);
    return success(res, data);
  } catch (err) {
    return fail(res, err.message, err.status || 500, err.details ?? null);
  }
}

async function confirm(req, res) {
  try {
    const data = await appointmentService.confirmAppointment(req.user.id, req.params.id, req.body);
    return success(res, data, 'Appointment confirmed');
  } catch (err) {
    return fail(res, err.message, err.status || 500, err.details ?? null);
  }
}

async function reject(req, res) {
  try {
    const data = await appointmentService.rejectAppointment(req.user.id, req.params.id, req.body);
    return success(res, data, 'Appointment rejected');
  } catch (err) {
    return fail(res, err.message, err.status || 500, err.details ?? null);
  }
}

async function cancel(req, res) {
  try {
    const data = await appointmentService.cancelAppointment(req.user.id, req.params.id, req.body);
    return success(res, data, 'Appointment cancelled');
  } catch (err) {
    return fail(res, err.message, err.status || 500, err.details ?? null);
  }
}

async function reschedule(req, res) {
  try {
    const data = await appointmentService.rescheduleAppointment(req.user.id, req.params.id, req.body);
    return success(res, data, 'Reschedule proposed');
  } catch (err) {
    return fail(res, err.message, err.status || 500, err.details ?? null);
  }
}

module.exports = {
  create,
  listPatient,
  listProvider,
  getOne,
  confirm,
  reject,
  cancel,
  reschedule,
};
