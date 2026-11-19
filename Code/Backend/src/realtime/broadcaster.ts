import type { WebSocket, WebSocketServer } from "ws";

export type LiveSocket = WebSocket & { isAlive?: boolean };

let webSockets: WebSocketServer | null = null;

export function attachWebSocketServer(server: WebSocketServer) {
  webSockets = server;
}

export function detachWebSocketServer() {
  webSockets = null;
}

export function broadcast(payload: unknown) {
  if (!webSockets) return;
  const message = JSON.stringify(payload);
  webSockets.clients.forEach((socket: LiveSocket) => {
    if (socket.readyState === socket.OPEN) socket.send(message);
  });
}
