const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    phone: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    fullName: { type: String, required: true },
    avatarUrl: { type: String },

    emailVerifiedAt: { type: Date },

    bvn: { type: String },
    kycStatus: {
      type: String,
      enum: ['none', 'pending', 'approved', 'rejected'],
      default: 'none',
      index: true,
    },
    // tracks how far through the multi-step KYC the user has got
    kycStep: {
      type: String,
      enum: ['none', 'bvn', 'identity', 'documents', 'bank', 'submitted'],
      default: 'none',
    },
    kycSubmittedAt: { type: Date },
    kycReviewedAt: { type: Date },
    kycReviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    kycRejectionReason: { type: String },

    kycDocuments: {
      // Government ID
      idType: {
        type: String,
        enum: ['national_id', 'passport', 'drivers_license', 'voters_card'],
      },
      idNumber: { type: String },
      idFrontUrl: { type: String },
      idBackUrl: { type: String },
      // Biometric
      selfieUrl: { type: String },
    },

    isBanned: { type: Boolean, default: false, index: true },
    bannedAt: { type: Date },
    bannedReason: { type: String },
    bannedByAdminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    bankAccounts: [
      {
        bankName: String,
        accountNumber: String,
        accountName: String,
        isPrimary: { type: Boolean, default: false },
      },
    ],

    address: { type: String },
    city: { type: String },
    country: { type: String },
    bio: { type: String, maxlength: 300 },
    dateOfBirth: { type: Date },

    pendingEmail: { type: String, lowercase: true },
    pendingPhone: { type: String },

    isDeactivated: { type: Boolean, default: false, index: true },
    deactivatedAt: { type: Date, index: true },

    communities: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Community' }],
    trustedCommunities: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Community' }],

    creditScoreId: { type: mongoose.Schema.Types.ObjectId, ref: 'CreditScore' },

    transactionPinHash: { type: String },

    roles: {
      type: [String],
      enum: ['user', 'admin'],
      default: ['user'],
    },
    accountType: {
      type: String,
      enum: ['patient', 'doctor', 'hospital_admin', 'pharmacy_admin'],
      default: 'patient',
      index: true,
    },
    pendingAccountType: {
      type: String,
      enum: ['patient', 'doctor', 'hospital_admin', 'pharmacy_admin'],
    },
    accountTypeChangeStatus: {
      type: String,
      enum: ['none', 'pending', 'approved', 'rejected'],
      default: 'none',
      index: true,
    },
    accountTypeChangeReason: { type: String },
    accountTypeReviewedAt: { type: Date },
    accountTypeReviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    expoPushToken: { type: String },

    location: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: {
        type: [Number],
      },
    },
  },
  {
    timestamps: true,
  }
);

userSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('User', userSchema);

