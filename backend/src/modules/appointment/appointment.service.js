const Appointment = require('../../models/Appointment');
const Provider = require('../../models/Provider');
const walletService = require('../wallet/wallet.service');
const { notifyUserPush } = require('../../utils/push');
const { emitToUser } = require('../../realtime/emit');
const notificationsService = require('../notifications/notifications.service');
const { notifyUser } = require('../../utils/notify');

const DEFAULT_SLOT_MS = 30 * 60 * 1000;

function endOrDefault(start, end) {
  if (end && end > start) return end;
  return new Date(start.getTime() + DEFAULT_SLOT_MS);
}

async function assertProviderBookable(providerId) {
  const provider = await Provider.findOne({
    _id: providerId,
    isActive: true,
    moderationStatus: 'approved',
  }).lean();
  if (!provider) throw Object.assign(new Error('Provider not found'), { status: 404 });
  if (!provider.ownerUser) {
    throw Object.assign(new Error('This provider is not accepting bookings yet'), { status: 400 });
  }
  return provider;
}

async function createRequest(patientUserId, { providerId, requestedStart, requestedEnd, patientNote }) {
  const provider = await assertProviderBookable(providerId);
  const start = new Date(requestedStart);
  if (Number.isNaN(start.getTime())) {
    throw Object.assign(new Error('Invalid requestedStart'), { status: 400 });
  }
  const end = endOrDefault(start, requestedEnd ? new Date(requestedEnd) : null);

  const fee = Math.max(0, Number(provider.hourlyRate) || 0);
  let consultationPaymentRef;

  if (fee > 0) {
    const wallet = await walletService.getWalletSummary(patientUserId);
    const balance = Number(wallet.availableBalance) || 0;
    if (balance >= fee) {
      const { reference } = await walletService.debitWallet(patientUserId, fee, {
        meta: { type: 'appointment_booking', providerId: String(provider._id) },
      });
      consultationPaymentRef = reference;
    } else {
      const shortfall = fee - balance;
      const fund = await walletService.initFundWallet(patientUserId, shortfall, {
        intent: 'appointment_topup',
        providerId: String(provider._id),
      });
      throw Object.assign(new Error('Add funds to your wallet to book this visit'), {
        status: 402,
        details: {
          payment: {
            method: 'interswitch',
            shortfall,
            walletBalance: balance,
            requiredTotal: fee,
            ...fund,
          },
        },
      });
    }
  }

  const appt = await Appointment.create({
    patientUser: patientUserId,
    provider: provider._id,
    providerOwnerUser: provider.ownerUser,
    requestedStart: start,
    requestedEnd: end,
    patientNote: patientNote ? String(patientNote).trim() : undefined,
    status: 'pending',
    consultationFee: fee,
    consultationPaymentRef,
  });

  const populated = await Appointment.findById(appt._id)
    .populate('provider', 'name providerType city')
    .populate('patientUser', 'fullName')
    .lean();
  const patientName = populated.patientUser?.fullName || 'A patient';

  await notifyUserPush({
    userId: provider.ownerUser,
    title: 'New appointment request',
    body: `${patientName} requested a visit — open MedMap to respond.`,
    data: { type: 'appointment', appointmentId: String(appt._id), status: 'pending' },
  });
  await notificationsService.createNotification({
    userId: provider.ownerUser,
    type: 'appointment',
    title: 'New appointment request',
    body: `${patientName} requested a visit — open MedMap to respond.`,
    data: { appointmentId: String(appt._id), status: 'pending' },
  });
  emitToUser(String(provider.ownerUser), 'appointment:updated', { appointment: populated });

  return populated;
}

async function listAsPatient(patientUserId) {
  return Appointment.find({ patientUser: patientUserId })
    .sort({ createdAt: -1 })
    .populate('provider', 'name providerType city phone')
    .lean();
}

async function listAsProvider(ownerUserId) {
  return Appointment.find({ providerOwnerUser: ownerUserId })
    .sort({ createdAt: -1 })
    .populate('provider', 'name providerType city')
    .populate('patientUser', 'fullName phone')
    .lean();
}

async function getOneForUser(appointmentId, userId) {
  const appt = await Appointment.findById(appointmentId)
    .populate('provider', 'name providerType city phone address')
    .populate('patientUser', 'fullName phone email')
    .lean();
  if (!appt) throw Object.assign(new Error('Appointment not found'), { status: 404 });
  const uid = String(userId);
  const patientId =
    appt.patientUser && typeof appt.patientUser === 'object'
      ? String(appt.patientUser._id)
      : String(appt.patientUser);
  if (patientId !== uid && String(appt.providerOwnerUser) !== uid) {
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  }
  return appt;
}

async function confirmAppointment(ownerUserId, appointmentId, { confirmedStart, confirmedEnd, providerNote }) {
  const appt = await Appointment.findById(appointmentId);
  if (!appt) throw Object.assign(new Error('Appointment not found'), { status: 404 });
  if (String(appt.providerOwnerUser) !== String(ownerUserId)) {
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  }
  if (appt.status !== 'pending') {
    throw Object.assign(new Error('Only pending requests can be confirmed'), { status: 400 });
  }

  const start = confirmedStart ? new Date(confirmedStart) : appt.requestedStart;
  const end = confirmedEnd
    ? new Date(confirmedEnd)
    : endOrDefault(start, null);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    throw Object.assign(new Error('Invalid confirmed time range'), { status: 400 });
  }

  appt.status = 'confirmed';
  appt.confirmedStart = start;
  appt.confirmedEnd = end;
  appt.reminderSentAt = undefined;
  if (providerNote) appt.providerNote = String(providerNote).trim();
  await appt.save();

  if (Number(appt.consultationFee) > 0 && appt.consultationPaymentRef) {
    await walletService.settleProviderEarnings({
      providerUserId: appt.providerOwnerUser,
      grossAmount: Number(appt.consultationFee),
      patientPaymentReference: appt.consultationPaymentRef,
      meta: { kind: 'appointment', appointmentId: String(appt._id) },
    });
  }

  const lean = await Appointment.findById(appt._id).populate('provider', 'name').lean();

  await notifyUserPush({
    userId: appt.patientUser,
    title: 'Appointment confirmed',
    body: `Your visit was confirmed for ${start.toISOString().slice(0, 16).replace('T', ' ')}.`,
    data: { type: 'appointment', appointmentId: String(appt._id), status: 'confirmed' },
  });
  await notifyUser({
    userId: appt.patientUser,
    type: 'appointment',
    title: 'Appointment confirmed',
    body: `Your visit was confirmed for ${start.toISOString().slice(0, 16).replace('T', ' ')}.`,
    data: { type: 'appointment', appointmentId: String(appt._id), status: 'confirmed' },
    push: true,
    email: true,
    emailSubject: 'Your appointment is confirmed',
  });
  emitToUser(String(appt.patientUser), 'appointment:updated', { appointment: lean });

  return lean;
}

async function rejectAppointment(ownerUserId, appointmentId, { rejectReason }) {
  const appt = await Appointment.findById(appointmentId);
  if (!appt) throw Object.assign(new Error('Appointment not found'), { status: 404 });
  if (String(appt.providerOwnerUser) !== String(ownerUserId)) {
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  }
  if (appt.status !== 'pending') {
    throw Object.assign(new Error('Only pending requests can be rejected'), { status: 400 });
  }
  const reason = String(rejectReason || '').trim();
  if (!reason) throw Object.assign(new Error('Rejection reason is required'), { status: 400 });

  if (Number(appt.consultationFee) > 0 && appt.consultationPaymentRef) {
    await walletService.refundBillPayment(appt.consultationPaymentRef, { reason: 'appointment_rejected' });
  }

  appt.status = 'rejected';
  appt.rejectReason = reason;
  await appt.save();

  const lean = await Appointment.findById(appt._id).populate('provider', 'name').lean();

  await notifyUserPush({
    userId: appt.patientUser,
    title: 'Appointment declined',
    body: reason.slice(0, 120),
    data: { type: 'appointment', appointmentId: String(appt._id), status: 'rejected' },
  });
  await notifyUser({
    userId: appt.patientUser,
    type: 'appointment',
    title: 'Appointment declined',
    body: reason.slice(0, 120),
    data: { type: 'appointment', appointmentId: String(appt._id), status: 'rejected' },
    push: true,
    email: true,
    emailSubject: 'Appointment update',
  });
  emitToUser(String(appt.patientUser), 'appointment:updated', { appointment: lean });

  return lean;
}

async function cancelAppointment(userId, appointmentId, { cancelReason }) {
  const appt = await Appointment.findById(appointmentId);
  if (!appt) throw Object.assign(new Error('Appointment not found'), { status: 404 });
  const uid = String(userId);
  const isPatient = String(appt.patientUser) === uid;
  const isProvider = String(appt.providerOwnerUser) === uid;
  if (!isPatient && !isProvider) throw Object.assign(new Error('Forbidden'), { status: 403 });
  if (!['pending', 'confirmed'].includes(appt.status)) {
    throw Object.assign(new Error('This appointment cannot be cancelled'), { status: 400 });
  }

  const payRef = appt.consultationPaymentRef;
  const consultFee = Number(appt.consultationFee) || 0;

  if (consultFee > 0 && payRef) {
    await walletService.refundBillPayment(payRef, {
      reason: isPatient ? 'appointment_cancelled_by_patient' : 'appointment_cancelled_by_provider',
    });
  }

  appt.status = 'cancelled';
  appt.cancelledBy = isPatient ? 'patient' : 'provider';
  appt.cancelReason = cancelReason ? String(cancelReason).trim() : undefined;
  await appt.save();

  const lean = await Appointment.findById(appt._id).populate('provider', 'name').lean();

  const otherId = isPatient ? appt.providerOwnerUser : appt.patientUser;
  await notifyUserPush({
    userId: otherId,
    title: 'Appointment cancelled',
    body: isPatient ? 'The patient cancelled the visit.' : 'The provider cancelled the visit.',
    data: { type: 'appointment', appointmentId: String(appt._id), status: 'cancelled' },
  });
  await notifyUser({
    userId: otherId,
    type: 'appointment',
    title: 'Appointment cancelled',
    body: isPatient ? 'The patient cancelled the visit.' : 'The provider cancelled the visit.',
    data: { type: 'appointment', appointmentId: String(appt._id), status: 'cancelled' },
    push: true,
    email: false,
  });
  emitToUser(String(otherId), 'appointment:updated', { appointment: lean });

  return lean;
}

async function rescheduleAppointment(userId, appointmentId, { requestedStart, requestedEnd, note }) {
  const appt = await Appointment.findById(appointmentId);
  if (!appt) throw Object.assign(new Error('Appointment not found'), { status: 404 });
  const uid = String(userId);
  const isPatient = String(appt.patientUser) === uid;
  const isProvider = String(appt.providerOwnerUser) === uid;
  if (!isPatient && !isProvider) throw Object.assign(new Error('Forbidden'), { status: 403 });
  if (appt.status !== 'confirmed') {
    throw Object.assign(new Error('Only confirmed appointments can be rescheduled this way'), { status: 400 });
  }

  const start = new Date(requestedStart);
  if (Number.isNaN(start.getTime())) {
    throw Object.assign(new Error('Invalid requestedStart'), { status: 400 });
  }
  const end = endOrDefault(start, requestedEnd ? new Date(requestedEnd) : null);

  appt.status = 'pending';
  appt.requestedStart = start;
  appt.requestedEnd = end;
  appt.confirmedStart = undefined;
  appt.confirmedEnd = undefined;
  if (note) {
    if (isPatient) appt.patientNote = String(note).trim();
    else appt.providerNote = String(note).trim();
  }
  await appt.save();

  const lean = await Appointment.findById(appt._id).populate('provider', 'name').lean();

  const notifyId = isPatient ? appt.providerOwnerUser : appt.patientUser;
  await notifyUserPush({
    userId: notifyId,
    title: 'Appointment reschedule requested',
    body: 'New times were proposed. Please confirm in MedMap.',
    data: { type: 'appointment', appointmentId: String(appt._id), status: 'pending' },
  });
  await notifyUser({
    userId: notifyId,
    type: 'appointment',
    title: 'Appointment reschedule requested',
    body: 'New times were proposed. Please confirm in MedMap.',
    data: { type: 'appointment', appointmentId: String(appt._id), status: 'pending' },
    push: true,
    email: false,
  });
  emitToUser(String(notifyId), 'appointment:updated', { appointment: lean });

  return lean;
}

async function addVisitSummary(providerOwnerUserId, appointmentId, { providerNote } = {}) {
  const note = String(providerNote || '').trim();
  if (!note) throw Object.assign(new Error('providerNote is required'), { status: 400 });

  const appt = await Appointment.findById(appointmentId);
  if (!appt) throw Object.assign(new Error('Appointment not found'), { status: 404 });
  if (String(appt.providerOwnerUser) !== String(providerOwnerUserId)) {
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  }
  if (appt.status !== 'confirmed') {
    throw Object.assign(new Error('Only confirmed appointments can be summarized'), { status: 400 });
  }
  appt.providerNote = note.slice(0, 500);
  await appt.save();
  return Appointment.findById(appt._id).populate('provider', 'name').lean();
}

module.exports = {
  createRequest,
  listAsPatient,
  listAsProvider,
  getOneForUser,
  confirmAppointment,
  rejectAppointment,
  cancelAppointment,
  rescheduleAppointment,
  addVisitSummary,
};
