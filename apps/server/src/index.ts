import http from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { RoomManager } from "./room-manager.js";
import type { ClientMessage, ServerMessage } from "./protocol.js";
import type { RoomPublic } from "@kittypoly/game";
import type { RawData } from "ws";

const PORT = process.env.PORT ?? 8787;
const manager = new RoomManager();
const sessions = new Map<WebSocket, { code?: string; playerId?: string }>();

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
    return;
  }

  res.writeHead(404, { "content-type": "text/plain" });
  res.end("not found");
});

const wss = new WebSocketServer({ server });

wss.on("connection", (socket) => {
  sessions.set(socket, {});

  socket.on("message", (data) => {
    try {
      handleMessage(socket, parseClientMessage(data));
    } catch (error) {
      sendError(socket, "badRequest", error instanceof Error ? error.message : "Invalid message");
    }
  });

  socket.on("close", () => {
    const session = sessions.get(socket);
    sessions.delete(socket);
    if (!session?.code || !session.playerId) return;

    try {
      manager.disconnect(session.code, session.playerId, Date.now());
      const room = manager.getRoom(session.code);
      if (room) broadcastSnapshot(room);
    } catch (error) {
      console.warn("disconnect failed", error);
    }
  });
});

setInterval(() => {
  for (const code of manager.playingRoomCodes()) {
    const before = manager.getRoom(code);
    const room = manager.tickRoom(code, Date.now());
    if (room && JSON.stringify(before) !== JSON.stringify(room)) broadcastSnapshot(room);
  }
}, 1_000);

server.listen(PORT, () => {
  console.log(`listening on http://localhost:${PORT}`);
});

function handleMessage(socket: WebSocket, message: ClientMessage): void {
  const nowMs = Date.now();

  switch (message.type) {
    case "createRoom": {
      const result = manager.createRoom({ nickname: message.nickname, nowMs });
      setSession(socket, result.room.code, result.playerId);
      send(socket, { type: "welcome", ...result });
      broadcastSnapshot(result.room);
      return;
    }
    case "joinRoom": {
      const result = manager.joinRoom({
        code: normalizeRoomCode(message.code),
        nickname: message.nickname,
        nowMs,
      });
      setSession(socket, result.room.code, result.playerId);
      send(socket, { type: "welcome", ...result });
      broadcastSnapshot(result.room);
      return;
    }
    case "reconnect": {
      const result = manager.reconnect({
        code: normalizeRoomCode(message.code),
        reconnectToken: message.reconnectToken,
        nowMs,
      });
      setSession(socket, result.room.code, result.playerId);
      send(socket, { type: "welcome", ...result });
      broadcastSnapshot(result.room);
      return;
    }
    case "kick": {
      const session = requireRoomSession(socket);
      const room = manager.kick(session.code, session.playerId, message.playerId);
      clearKickedSocket(session.code, message.playerId);
      broadcastSnapshot(room);
      return;
    }
    case "setAvatar": {
      const session = requireRoomSession(socket);
      const room = manager.setAvatar(session.code, session.playerId, message.avatar);
      broadcastSnapshot(room);
      return;
    }
    case "startGame": {
      const session = requireRoomSession(socket);
      const room = manager.startGame(session.code, session.playerId, nowMs);
      broadcastSnapshot(room);
      return;
    }
    case "endRoom": {
      const session = requireRoomSession(socket);
      const code = session.code;
      manager.endRoom(code, session.playerId);
      broadcastRoomEnded(code);
      return;
    }
    case "intent": {
      const session = requireRoomSession(socket);
      const room = manager.handleIntent(session.code, session.playerId, message.intent, nowMs, {
        spaceId: message.spaceId,
      });
      broadcastSnapshot(room);
      return;
    }
  }
}

function parseClientMessage(data: RawData): ClientMessage {
  const value: unknown = JSON.parse(rawDataToString(data));
  if (!isRecord(value) || typeof value.type !== "string") throw new Error("Invalid message");
  return value as ClientMessage;
}

function rawDataToString(data: RawData): string {
  if (Array.isArray(data)) return Buffer.concat(data).toString("utf8");
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString("utf8");
  return data.toString("utf8");
}

function requireRoomSession(socket: WebSocket): { code: string; playerId: string } {
  const session = sessions.get(socket);
  if (!session?.code || !session.playerId) throw new Error("Not joined to a room");
  return { code: session.code, playerId: session.playerId };
}

function setSession(socket: WebSocket, code: string, playerId: string): void {
  sessions.set(socket, { code, playerId });
}

function clearKickedSocket(code: string, playerId: string): void {
  for (const [socket, session] of sessions) {
    if (session.code !== code || session.playerId !== playerId) continue;
    sessions.set(socket, {});
    sendError(socket, "kicked", "You were kicked from the room");
  }
}

function broadcastSnapshot(room: RoomPublic): void {
  const message: ServerMessage = { type: "snapshot", room };
  for (const [socket, session] of sessions) {
    if (session.code === room.code) send(socket, message);
  }
}

function broadcastRoomEnded(code: string): void {
  const message: ServerMessage = { type: "roomEnded", reason: "hostEnded" };
  for (const [socket, session] of sessions) {
    if (session.code !== code) continue;
    sessions.set(socket, {});
    send(socket, message);
  }
}

function send(socket: WebSocket, message: ServerMessage): void {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function sendError(socket: WebSocket, code: string, message: string): void {
  send(socket, { type: "error", code, message });
}

function normalizeRoomCode(code: string): string {
  return code.trim().toUpperCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
