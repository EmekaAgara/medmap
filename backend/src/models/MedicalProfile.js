const mongoose = require('mongoose');

const medicalProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },

    consent: {
      /** Patient consent for AI assistant to use their medical context. */
      aiAssistant: { type: Boolean, default: false },
      aiConsentAt: { type: Date },
    },

    vitals: {
      heightCm: { type: Number, min: 0 },
      weightKg: { type: Number, min: 0 },
      bloodGroup: { type: String, trim: true }, // e.g. O+, A-
    },

    allergies: [{ type: String, trim: true }],
    conditions: [{ type: String, trim: true }],
    medications: [{ type: String, trim: true }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('MedicalProfile', medicalProfileSchema);

