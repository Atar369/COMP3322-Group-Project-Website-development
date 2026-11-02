const jwt = require('jsonwebtoken');

function parseCookieHeader(header) {
  if (!header || typeof header !== 'string') return {};
  return header.split(';').reduce((acc, part) => {
    const index = part.indexOf('=');
    if (index === -1) return acc;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!key) return acc;
    try {
      acc[key] = decodeURIComponent(value);
    } catch {
      acc[key] = value;
    }
    return acc;
  }, {});
}

function extractToken(socket) {
  // 1) Legacy: client passed token via handshake auth
  const authToken = socket.handshake?.auth?.token;
  if (authToken) return authToken;

  // 2) Cookie-based auth
  const cookies = parseCookieHeader(socket.handshake?.headers?.cookie);
  if (cookies.token) return cookies.token;

  // 3) Authorization header (non-browser clients)
  const header = socket.handshake?.headers?.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7);

  return null;
}

function attachQueueSocket(io) {
  io.use((socket, next) => {
    const token = extractToken(socket);
    if (!token) {
      socket.user = null;
      return next();
    }
    try {
      socket.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      socket.user = null;
    }
    return next();
  });

  io.on('connection', socket => {
    socket.join('queue:public');

    if (socket.user?.role === 'customer') {
      socket.join(`queue:user:${socket.user.user_id}`);
    }

    if (socket.user?.role === 'manager') {
      socket.join('queue:manager');
    }

    socket.on('disconnect', () => {
    });
  });
}

function emitQueueUpdate(io, payload = {}) {
  if (!io) return;
  io.to('queue:public').emit('queue:update', payload);

  if (payload.calledUserId) {
    io.to(`queue:user:${payload.calledUserId}`).emit('queue:called', {
      queueId: payload.calledQueueId,
      queueNumber: payload.calledQueueNumber,
      message: 'You are being called. Please proceed to the host stand.',
      calledAt: payload.calledAt || new Date().toISOString(),
    });
  }

  io.to('queue:manager').emit('queue:manager-update', payload);
}

module.exports = { attachQueueSocket, emitQueueUpdate };