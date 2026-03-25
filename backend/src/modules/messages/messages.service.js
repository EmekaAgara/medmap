const Message = require('../../models/Message');
const Provider = require('../../models/Provider');
const User = require('../../models/User');
const mongoose = require('mongoose');
const { emitToConversation } = require('../../realtime/emit');
const { notifyUserPush } = require('../../utils/push');
const notificationsService = require('../notifications/notifications.service');

function serializeMessage(doc) {
  const o = doc.toObject ? doc.toObject() : { ...doc };
  return {
    _id: String(o._id),
    conversationId: o.conversationId,
    from: String(o.from),
    to: String(o.to),
    provider: o.provider ? String(o.provider) : undefined,
    body: o.body,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

function makeConversationId(userA, userB, providerId) {
  const [a, b] = [String(userA), String(userB)].sort();
  return providerId ? `${a}:${b}:${providerId}` : `${a}:${b}`;
}

async function sendToProvider({ senderUserId, providerId, body }) {
  const provider = await Provider.findOne({
    _id: providerId,
    isActive: true,
    moderationStatus: 'approved',
  }).lean();
  if (!provider) throw Object.assign(new Error('Provider not found'), { status: 404 });
  if (!provider.ownerUser) throw Object.assign(new Error('Provider owner is not set'), { status: 400 });

  const text = String(body || '').trim();
  if (!text) throw Object.assign(new Error('Message body is required'), { status: 400 });

  const conversationId = makeConversationId(senderUserId, provider.ownerUser, provider._id);
  const message = await Message.create({
    conversationId,
    from: senderUserId,
    to: provider.ownerUser,
    provider: provider._id,
    body: text,
  });

  const payload = serializeMessage(message);
  emitToConversation(conversationId, 'message:new', { message: payload });
  await notifyUserPush({
    userId: provider.ownerUser,
    title: 'New message',
    body: text.length > 100 ? `${text.slice(0, 97)}...` : text,
    data: { type: 'message', conversationId },
  });

  await notificationsService.createNotification({
    userId: provider.ownerUser,
    type: 'message',
    title: 'New message',
    body: text.length > 100 ? `${text.slice(0, 97)}...` : text,
    data: { conversationId },
  });

  return { message, conversationId };
}

async function listMyConversations(userId) {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const rows = await Message.aggregate([
    { $match: { $or: [{ from: userObjectId }, { to: userObjectId }] } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$conversationId',
        latest: { $first: '$$ROOT' },
      },
    },
    { $sort: { 'latest.createdAt': -1 } },
  ]);

  const enriched = await Promise.all(
    rows.map(async (row) => {
      const latest = row.latest;
      const peerUserId = String(latest.from) === String(userId) ? latest.to : latest.from;
      const peer = await User.findById(peerUserId).select('fullName').lean();
      let provider = null;
      if (latest.provider) {
        provider = await Provider.findById(latest.provider).select('name providerType').lean();
      }
      return {
        conversationId: row._id,
        peerUserId,
        peerName: peer?.fullName || 'Unknown user',
        provider: provider || null,
        latestMessage: latest.body,
        latestMessageAt: latest.createdAt,
      };
    })
  );

  return enriched;
}

async function listConversationMessages({ userId, conversationId }) {
  const messages = await Message.find({ conversationId })
    .sort({ createdAt: 1 })
    .lean();

  if (!messages.length) return [];
  const isParticipant = messages.some(
    (msg) => String(msg.from) === String(userId) || String(msg.to) === String(userId)
  );
  if (!isParticipant) throw Object.assign(new Error('Forbidden'), { status: 403 });

  return messages;
}

async function replyToConversation({ userId, conversationId, body }) {
  const text = String(body || '').trim();
  if (!text) throw Object.assign(new Error('Message body is required'), { status: 400 });

  const latest = await Message.findOne({ conversationId }).sort({ createdAt: -1 }).lean();
  if (!latest) throw Object.assign(new Error('Conversation not found'), { status: 404 });

  const isParticipant =
    String(latest.from) === String(userId) || String(latest.to) === String(userId);
  if (!isParticipant) throw Object.assign(new Error('Forbidden'), { status: 403 });

  const toUserId = String(latest.from) === String(userId) ? latest.to : latest.from;
  const created = await Message.create({
    conversationId,
    from: userId,
    to: toUserId,
    provider: latest.provider,
    body: text,
  });

  const payload = serializeMessage(created);
  emitToConversation(conversationId, 'message:new', { message: payload });
  await notifyUserPush({
    userId: toUserId,
    title: 'New message',
    body: text.length > 100 ? `${text.slice(0, 97)}...` : text,
    data: { type: 'message', conversationId },
  });

  await notificationsService.createNotification({
    userId: toUserId,
    type: 'message',
    title: 'New message',
    body: text.length > 100 ? `${text.slice(0, 97)}...` : text,
    data: { conversationId },
  });

  return created;
}

module.exports = {
  sendToProvider,
  listMyConversations,
  listConversationMessages,
  replyToConversation,
};
