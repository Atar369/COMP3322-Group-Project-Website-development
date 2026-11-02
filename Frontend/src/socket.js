import { io } from 'socket.io-client';

// Cookie-based auth: the socket handshake must include credentials.
export const socket = io(import.meta.env.VITE_SOCKET_URL || '/', {
  withCredentials: true,
  autoConnect: false,
  transports: ['websocket', 'polling'],
});