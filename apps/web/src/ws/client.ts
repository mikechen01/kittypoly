import type { CatAvatarId, RoomPublic } from "@kittypoly/game";
import { loadSession, saveSession } from "../state/session";

export type ClientMessage =
  | { type: "createRoom"; nickname: string }
  | { type: "joinRoom"; code: string; nickname: string }
  | { type: "reconnect"; code: string; reconnectToken: string }
  | { type: "kick"; playerId: string }
  | { type: "setAvatar"; avatar: CatAvatarId }
  | { type: "startGame" }
  | { type: "endRoom" }
  | {
      type: "intent";
      intent: "rollDice" | "buyTerritory" | "skipBuy" | "buildHouse" | "payCageFine" | "endTurn";
      spaceId?: string;
    };

export type ServerMessage =
  | { type: "welcome"; playerId: string; reconnectToken: string; room: RoomPublic }
  | { type: "snapshot"; room: RoomPublic }
  | { type: "roomEnded"; reason: "hostEnded" }
  | { type: "error"; code: string; message: string };

type Listener = (message: ServerMessage) => void;
type StatusListener = (status: "connecting" | "open" | "closed") => void;

const WS_URL = import.meta.env.VITE_WS_URL ?? "ws://localhost:8787";

export class KittyPolyClient {
  private socket: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private readonly listeners = new Set<Listener>();
  private readonly statusListeners = new Set<StatusListener>();

  connect(): void {
    if (this.socket && this.socket.readyState < WebSocket.CLOSING) return;

    this.emitStatus("connecting");
    this.socket = new WebSocket(WS_URL);
    this.socket.addEventListener("open", () => {
      this.emitStatus("open");
      const session = loadSession();
      if (session) this.send({ type: "reconnect", code: session.code, reconnectToken: session.reconnectToken });
    });
    this.socket.addEventListener("message", (event) => this.handleMessage(event.data));
    this.socket.addEventListener("close", () => {
      this.emitStatus("closed");
      this.scheduleReconnect();
    });
  }

  send(message: ClientMessage): void {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify(message));
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  subscribeStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  private handleMessage(data: unknown): void {
    const message = JSON.parse(String(data)) as ServerMessage;
    if (message.type === "welcome") {
      saveSession({
        code: message.room.code,
        playerId: message.playerId,
        reconnectToken: message.reconnectToken,
      });
    }
    this.listeners.forEach((listener) => listener(message));
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 1_000);
  }

  private emitStatus(status: "connecting" | "open" | "closed"): void {
    this.statusListeners.forEach((listener) => listener(status));
  }
}
