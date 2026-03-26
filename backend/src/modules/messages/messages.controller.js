const { success, fail } = require('../../utils/responses');
const messagesService = require('./messages.service');

async function sendToProvider(req, res) {
  try {
    const { providerId, body } = req.body;
    if (!providerId || !body) return fail(res, 'providerId and body are required', 400);
    const result = await messagesService.sendToProvider({
      senderUserId: req.user.id,
      providerId,
      body,
    });
    return success(res, result, 'Message sent', 201);
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function listConversations(req, res) {
  try {
    const data = await messagesService.listMyConversations(req.user.id);
    return success(res, data);
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function listMessages(req, res) {
  try {
    const data = await messagesService.listConversationMessages({
      userId: req.user.id,
      conversationId: req.params.conversationId,
    });
    return success(res, data);
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function reply(req, res) {
  try {
    const { body } = req.body;
    const data = await messagesService.replyToConversation({
      userId: req.user.id,
      conversationId: req.params.conversationId,
      body,
    });
    return success(res, data, 'Message sent', 201);
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function startMeddie(req, res) {
  try {
    const data = await messagesService.startMeddieConversation(req.user.id);
    return success(res, data);
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

module.exports = {
  sendToProvider,
  listConversations,
  listMessages,
  reply,
  startMeddie,
};
