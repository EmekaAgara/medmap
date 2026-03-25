const cron = require('node-cron');
const Appointment = require('../models/Appointment');
const { notifyUserPush } = require('../utils/push');
const logger = require('../config/logger');

/**
 * ~24h before confirmed start, send one reminder push (patient + provider).
 */
function scheduleAppointmentReminders() {
  cron.schedule('*/15 * * * *', async () => {
    try {
      const now = Date.now();
      const from = new Date(now + 23 * 60 * 60 * 1000);
      const to = new Date(now + 24 * 60 * 60 * 1000);

      const appts = await Appointment.find({
        status: 'confirmed',
        confirmedStart: { $gte: from, $lt: to },
        $or: [{ reminderSentAt: null }, { reminderSentAt: { $exists: false } }],
      }).lean();

      for (const a of appts) {
        const when = a.confirmedStart
          ? new Date(a.confirmedStart).toISOString().slice(0, 16).replace('T', ' ')
          : 'soon';
        await notifyUserPush({
          userId: a.patientUser,
          title: 'Appointment reminder',
          body: `Visit coming up around ${when}.`,
          data: { type: 'appointment_reminder', appointmentId: String(a._id) },
        });
        await notifyUserPush({
          userId: a.providerOwnerUser,
          title: 'Appointment reminder',
          body: `Confirmed visit in ~24h (${when}).`,
          data: { type: 'appointment_reminder', appointmentId: String(a._id) },
        });
        await Appointment.updateOne({ _id: a._id }, { reminderSentAt: new Date() });
      }
    } catch (e) {
      logger.error('Appointment reminder job failed', { error: e.message });
    }
  });
  logger.info('Appointment reminder cron scheduled (every 15 min)');
}

module.exports = { scheduleAppointmentReminders };
