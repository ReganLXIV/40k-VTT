import { io, Socket } from 'socket.io-client';
import type { ClientToServer, ServerToClient } from '@shared/types';

// Same-origin: dev uses the Vite proxy for /socket.io, prod is the Node server.
export const socket: Socket<ServerToClient, ClientToServer> = io({
  autoConnect: true,
  transports: ['websocket', 'polling'],
});

socket.on('connect', () => console.log('[socket] connected', socket.id));
socket.on('disconnect', (r) => console.log('[socket] disconnected', r));
