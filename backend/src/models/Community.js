const mongoose = require('mongoose');

const communitySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ['neighborhood', 'university', 'workplace', 'city'],
      required: true,
    },
    metadata: { type: Object },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
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
  { timestamps: true }
);

communitySchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Community', communitySchema);

