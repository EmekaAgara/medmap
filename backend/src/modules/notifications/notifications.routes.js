const express = require('express');
const { auth } = require('../../middlewares/auth');
const notificationsController = require('./notifications.controller');

const router = express.Router();

router.use(auth());
router.get('/mine', notificationsController.listMine);
router.get('/mine/unread-count', notificationsController.unreadCount);
router.post('/mine/read-all', notificationsController.markAllRead);
router.post('/mine/:id/read', notificationsController.markRead);

module.exports = router;

