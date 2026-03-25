const mongoose = require('mongoose');

const providerSchema = new mongoose.Schema(
  {
    ownerUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    providerType: {
      type: String,
      enum: ['doctor', 'pharmacy', 'hospital'],
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, index: true },
    description: { type: String, trim: true, maxlength: 500 },
    /** How much the provider charges per hour for bookings (NGN). */
    hourlyRate: { type: Number, default: 0, min: 0 },
    /** Public-facing profile image URL for listing cards */
    imageUrl: { type: String, trim: true },
    services: [{ type: String, trim: true }],
    /** Catalog items: { name, price } (price 0 = free). Legacy string entries are normalized in API layer. */
    products: [{ type: mongoose.Schema.Types.Mixed }],
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
    city: { type: String, trim: true, index: true },
    country: { type: String, trim: true, index: true },
    isOpenNow: { type: Boolean, default: true, index: true },
    /** Human-readable schedule, e.g. Mon–Fri 8am–6pm */
    workingHours: { type: String, trim: true, maxlength: 500 },
    availabilityText: { type: String, trim: true, default: 'Open daily' },
    chatEnabled: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false, index: true },
    isActive: { type: Boolean, default: true, index: true },
    moderationStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    moderationReason: { type: String, trim: true },
    moderatedAt: { type: Date },
    moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    claimRequestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    claimRequestedAt: { type: Date },
    location: {
      type: { type: String, enum: ['Point'], required: true },
      coordinates: { type: [Number], required: true },
    },
  },
  { timestamps: true }
);

providerSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Provider', providerSchema);
