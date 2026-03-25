const { Server } = require('socket.io');
const { verifyAccessToken } = require('../utils/jwt');
const Message = require('../models/Message');
const User = require('../models/User');
const logger = require('../config/logger');
const { setIO } = require('./emit');

async function canAccessConversation(userId, conversationId) {
  const found = await Message.findOne({ conversationId }).lean();
  if (!found) return false;
  return String(found.from) === String(userId) || String(found.to) === String(userId);
}

function attachSocketIo(httpServer) {
  const io = new Server(httpServer, {
    path: '/socket.io',
    cors: { origin: true, credentials: true },
    transports: ['websocket', 'polling'],
  });
  setIO(io);

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) return next(new Error('Unauthorized'));
      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.sub).select('isBanned isDeactivated').lean();
      if (!user || user.isBanned || user.isDeactivated) return next(new Error('Unauthorized'));
      socket.userId = String(decoded.sub);
      next();
    } catch (e) {
      logger.warn('Socket auth failed', { error: e.message });
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.userId}`);

    socket.on('conversation:join', async (conversationId, cb) => {
      try {
        if (!conversationId || typeof conversationId !== 'string') {
          if (typeof cb === 'function') cb({ ok: false });
          return;
        }
        const ok = await canAccessConversation(socket.userId, conversationId);
        if (!ok) {
          if (typeof cb === 'function') cb({ ok: false });
          return;
        }
        socket.join(`conv:${conversationId}`);
        if (typeof cb === 'function') cb({ ok: true });
      } catch {
        if (typeof cb === 'function') cb({ ok: false });
      }
    });

    socket.on('conversation:leave', (conversationId) => {
      if (conversationId && typeof conversationId === 'string') {
        socket.leave(`conv:${conversationId}`);
      }
    });
  });

  logger.info('Socket.IO attached');
  return io;
}

module.exports = { attachSocketIo };
