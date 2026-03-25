const express = require('express');
const { auth } = require('../../middlewares/auth');
const { chatLimiter } = require('../../config/rateLimiter');
const messagesController = require('./messages.controller');

const router = express.Router();

router.use(auth());
router.get('/conversations', messagesController.listConversations);
router.get('/conversations/:conversationId', messagesController.listMessages);
router.post('/conversations/:conversationId/reply', chatLimiter, messagesController.reply);
router.post('/provider', chatLimiter, messagesController.sendToProvider);

module.exports = router;
