import { describe, expect, it } from "vitest";
import { RoomManager } from "./room-manager.js";

describe("RoomManager", () => {
  it("creates room with a host and join code", () => {
    const manager = new RoomManager(() => 0);

    const { room, playerId, reconnectToken } = manager.createRoom({
      nickname: "Mochi",
      avatar: "tabby",
      nowMs: 1_000,
    });

    expect(room.code).toMatch(/^[A-Z2-9]{6}$/);
    expect(room.hostId).toBe(playerId);
    expect(room.players).toEqual([
      {
        id: playerId,
        nickname: "Mochi",
        avatar: "tabby",
        food: 1500,
        position: 0,
        inCage: false,
        cageTurnsSkipped: 0,
        bankrupt: false,
        connected: true,
      },
    ]);
    expect(room.match.phase).toBe("lobby");
    expect(reconnectToken).toHaveLength(64);
  });

  it("reconnect restores the same seat", () => {
    const manager = new RoomManager(() => 0);
    const created = manager.createRoom({ nickname: "Mochi", avatar: "tabby", nowMs: 1_000 });

    manager.disconnect(created.room.code, created.playerId, 2_000);
    const reconnected = manager.reconnect({
      code: created.room.code,
      reconnectToken: created.reconnectToken,
      nowMs: 3_000,
    });

    expect(reconnected.playerId).toBe(created.playerId);
    expect(reconnected.reconnectToken).toBe(created.reconnectToken);
    expect(reconnected.room.players.find((p) => p.id === created.playerId)?.connected).toBe(true);
  });

  it("starts a playing match after a second player joins", () => {
    const manager = new RoomManager(() => 0);
    const created = manager.createRoom({ nickname: "Mochi", avatar: "tabby", nowMs: 1_000 });
    const joined = manager.joinRoom({
      code: created.room.code,
      nickname: "Luna",
      avatar: "calico",
      nowMs: 2_000,
    });

    const room = manager.startGame(created.room.code, created.playerId, 3_000);

    expect(joined.playerId).not.toBe(created.playerId);
    expect(room.match.phase).toBe("playing");
    expect(room.match.currentPlayerId).toBe(created.playerId);
    expect(room.players.map((p) => p.nickname)).toEqual(["Mochi", "Luna"]);
  });
});
