const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    conversationId: { type: String, required: true, index: true },
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    provider: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider' },
    loanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Loan' },
    body: { type: String, required: true },
    attachments: [{ type: String }],
    readAt: { type: Date },
  },
  { timestamps: true }
);

messageSchema.index({ 'from': 1, 'to': 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);

