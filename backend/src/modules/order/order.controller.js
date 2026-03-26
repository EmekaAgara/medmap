const { success, fail } = require('../../utils/responses');
const orderService = require('./order.service');

async function uploadPrescription(req, res) {
  try {
    const { providerId } = req.body || {};
    if (!providerId) return fail(res, 'providerId is required', 400);
    if (!req.file) return fail(res, 'No file uploaded', 400);
    const data = await orderService.uploadPrescription({
      buyerUserId: req.user.id,
      providerId,
      file: req.file,
    });
    return success(res, data, 'Prescription uploaded', 201);
  } catch (err) {
    return fail(res, err.message, err.status || 500, err.details ?? null);
  }
}

async function create(req, res) {
  try {
    const data = await orderService.createOrder(req.user.id, req.body);
    return success(res, data, data.payment ? 'Order created' : 'Order completed');
  } catch (err) {
    return fail(res, err.message, err.status || 500, err.details ?? null);
  }
}

async function completePay(req, res) {
  try {
    const data = await orderService.completeOrderPayment(req.user.id, req.params.id);
    return success(res, data, 'Payment status');
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function listBuyer(req, res) {
  try {
    const items = await orderService.listAsBuyer(req.user.id);
    return success(res, items);
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function listSeller(req, res) {
  try {
    const items = await orderService.listAsSeller(req.user.id);
    return success(res, items);
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function getOne(req, res) {
  try {
    const order = await orderService.getOneForUser(req.params.id, req.user.id);
    return success(res, order);
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function cancel(req, res) {
  try {
    const order = await orderService.cancelByBuyer(req.user.id, req.params.id);
    return success(res, order, 'Order cancelled');
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function fulfill(req, res) {
  try {
    const order = await orderService.markFulfilled(req.user.id, req.params.id);
    return success(res, order, 'Order fulfilled');
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function updateStatus(req, res) {
  try {
    const { status, note } = req.body || {};
    const order = await orderService.updateStatusBySeller(req.user.id, req.params.id, {
      status,
      note,
    });
    return success(res, order, 'Order updated');
  } catch (err) {
    return fail(res, err.message, err.status || 500, err.details ?? null);
  }
}

module.exports = {
  uploadPrescription,
  create,
  completePay,
  listBuyer,
  listSeller,
  getOne,
  cancel,
  fulfill,
  updateStatus,
};
