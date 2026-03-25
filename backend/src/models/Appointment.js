const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema(
  {
    patientUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    provider: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider', required: true, index: true },
    providerOwnerUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'rejected', 'cancelled'],
      default: 'pending',
      index: true,
    },
    requestedStart: { type: Date, required: true },
    requestedEnd: { type: Date, required: true },
    confirmedStart: { type: Date },
    confirmedEnd: { type: Date },
    rejectReason: { type: String, trim: true },
    patientNote: { type: String, trim: true, maxlength: 500 },
    providerNote: { type: String, trim: true, maxlength: 500 },
    cancelledBy: { type: String, enum: ['patient', 'provider'] },
    cancelReason: { type: String, trim: true },
    reminderSentAt: { type: Date },
    /** Set when a confirmed visit is moved back to pending for re-confirmation */
    rescheduledFromId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
    /** Consultation fee (typically matches provider hourlyRate); charged when the patient books */
    consultationFee: { type: Number, default: 0, min: 0 },
    consultationPaymentRef: { type: String, trim: true },
  },
  { timestamps: true }
);

appointmentSchema.index({ patientUser: 1, status: 1, createdAt: -1 });
appointmentSchema.index({ providerOwnerUser: 1, status: 1, createdAt: -1 });
appointmentSchema.index({ confirmedStart: 1, status: 1, reminderSentAt: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);
