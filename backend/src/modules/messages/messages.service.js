const Message = require('../../models/Message');
const Provider = require('../../models/Provider');
const User = require('../../models/User');
const mongoose = require('mongoose');
const { emitToConversation } = require('../../realtime/emit');
const { notifyUserPush } = require('../../utils/push');
const notificationsService = require('../notifications/notifications.service');
const logger = require('../../config/logger');
const MedicalProfile = require('../../models/MedicalProfile');
const { getTimeline } = require('../medical/medical.service');
const env = require('../../config/env');
const { generateMeddieReply } = require('../../utils/meddie');

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

async function getOrCreateMeddieUser() {
  const email = 'meddie@medmap.ai';
  let user = await User.findOne({ email }).lean();
  if (user) return user;
  // Minimal required user fields for existing schema; passwordHash is unused for Meddie.
  const created = await User.create({
    email,
    phone: `MEDDIE_${Date.now()}`,
    passwordHash: 'meddie',
    fullName: 'Meddie AI',
    accountType: 'doctor',
    roles: ['user'],
  });
  return created.toObject();
}

async function maybeAutoReplyFromMeddie({ conversationId, fromUserId, toUserId, userText }) {
  if (!env.meddie?.enabled) return null;
  const meddie = await getOrCreateMeddieUser();
  if (String(toUserId) !== String(meddie._id)) return null;

  const profile = await MedicalProfile.findOne({ user: fromUserId }).lean();
  if (!profile?.consent?.aiAssistant) {
    const msg = await Message.create({
      conversationId,
      from: meddie._id,
      to: fromUserId,
      body:
        'Before I can help, please enable AI consent in your Medical Profile. I can only use your medical info with consent.',
    });
    const payload = serializeMessage(msg);
    emitToConversation(conversationId, 'message:new', { message: payload });
    return msg;
  }

  const timeline = await getTimeline(fromUserId, { limit: 20 }).catch(() => ({ timeline: [] }));
  const replyText = await generateMeddieReply({
    userMessage: userText,
    medicalProfile: profile,
    recentTimeline: timeline.timeline || [],
  });

  const msg = await Message.create({
    conversationId,
    from: meddie._id,
    to: fromUserId,
    body: replyText,
  });
  const payload = serializeMessage(msg);
  emitToConversation(conversationId, 'message:new', { message: payload });
  return msg;
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
  const sender = await User.findById(senderUserId).select('fullName').lean();
  const senderName = sender?.fullName || 'Someone';
  const preview = text.length > 100 ? `${text.slice(0, 97)}...` : text;
  await notifyUserPush({
    userId: provider.ownerUser,
    title: `New message from ${senderName}`,
    body: preview,
    data: { type: 'message', conversationId, senderName },
  });

  await notificationsService.createNotification({
    userId: provider.ownerUser,
    type: 'message',
    title: `New message from ${senderName}`,
    body: preview,
    data: { conversationId, senderName },
  });

  return { message, conversationId };
}

async function startMeddieConversation(userId) {
  const meddie = await getOrCreateMeddieUser();
  const conversationId = makeConversationId(userId, meddie._id, null);
  // Seed conversation with a greeting if empty.
  const exists = await Message.findOne({ conversationId }).lean();
  if (!exists) {
    const greeting = await Message.create({
      conversationId,
      from: meddie._id,
      to: userId,
      body:
        "Hi, I’m Meddie AI. Tell me what’s going on and I’ll help you decide next steps. If it feels urgent, seek emergency care.",
    });
    emitToConversation(conversationId, 'message:new', { message: serializeMessage(greeting) });
  }
  return { conversationId };
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
      const peer = await User.findById(peerUserId).select('fullName email avatarUrl').lean();
      let provider = null;
      if (latest.provider) {
        provider = await Provider.findById(latest.provider).select('name providerType imageUrl').lean();
      }
      const isMeddie = String(peer?.email || '').toLowerCase() === 'meddie@medmap.ai';
      const unreadCount = await Message.countDocuments({
        conversationId: row._id,
        to: userObjectId,
        readAt: null,
      });
      return {
        conversationId: row._id,
        peerUserId,
        peerName: peer?.fullName || 'Unknown user',
        peerEmail: peer?.email || '',
        peerAvatarUrl: peer?.avatarUrl || '',
        isMeddie,
        provider: provider || null,
        latestMessage: latest.body,
        latestMessageAt: latest.createdAt,
        unreadCount,
        unread: unreadCount > 0,
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

  // Mark inbound unread messages as read when conversation is opened.
  await Message.updateMany(
    {
      conversationId,
      to: new mongoose.Types.ObjectId(userId),
      readAt: null,
    },
    { $set: { readAt: new Date() } }
  );

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
  const sender = await User.findById(userId).select('fullName').lean();
  const senderName = sender?.fullName || 'Someone';
  const preview = text.length > 100 ? `${text.slice(0, 97)}...` : text;
  await notifyUserPush({
    userId: toUserId,
    title: `New message from ${senderName}`,
    body: preview,
    data: { type: 'message', conversationId, senderName },
  });

  await notificationsService.createNotification({
    userId: toUserId,
    type: 'message',
    title: `New message from ${senderName}`,
    body: preview,
    data: { conversationId, senderName },
  });

  // If replying to Meddie, generate an AI response in the same conversation.
  try {
    await maybeAutoReplyFromMeddie({
      conversationId,
      fromUserId: userId,
      toUserId,
      userText: text,
    });
  } catch (e) {
    // Do not fail the user message send if AI fails.
    logger.warn('Meddie auto-reply failed', { err: e.message });
  }

  return created;
}

module.exports = {
  sendToProvider,
  startMeddieConversation,
  listMyConversations,
  listConversationMessages,
  replyToConversation,
};
