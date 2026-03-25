let io;

function setIO(instance) {
  io = instance;
}

function roomConv(conversationId) {
  return `conv:${conversationId}`;
}

function emitToConversation(conversationId, event, payload) {
  if (!io) return;
  io.to(roomConv(conversationId)).emit(event, payload);
}

function emitToUser(userId, event, payload) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, payload);
}

module.exports = {
  setIO,
  emitToConversation,
  emitToUser,
  roomConv,
};
