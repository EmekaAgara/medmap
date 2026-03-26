const mongoose = require('mongoose');

const prescriptionUploadSchema = new mongoose.Schema(
  {
    buyerUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    provider: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider', required: true, index: true },
    url: { type: String, required: true, trim: true },
    mimeType: { type: String, trim: true },
    originalName: { type: String, trim: true },
  },
  { timestamps: true }
);

prescriptionUploadSchema.index({ buyerUser: 1, createdAt: -1 });

module.exports = mongoose.model('PrescriptionUpload', prescriptionUploadSchema);

