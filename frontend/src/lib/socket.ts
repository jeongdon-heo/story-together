import { io, Socket } from 'socket.io-client';
import { getBaseURL } from './api';

let socket: Socket | null = null;

function getWsUrl(): string {
  // NEXT_PUBLIC_WS_URL이 명시적으로 설정된 경우 사용
  const explicit = process.env.NEXT_PUBLIC_WS_URL;
  if (explicit && explicit.length > 0) return explicit;

  // 없으면 API base URL 그대로 사용 (Socket.IO는 HTTP에서 자동 업그레이드)
  return getBaseURL();
}

export function getSocket(token: string): Socket {
  if (!socket || !socket.connected) {
    const wsUrl = getWsUrl();
    socket = io(
      `${wsUrl}/story`,
      {
        auth: { token },
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      },
    );
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
