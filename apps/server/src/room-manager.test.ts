import { describe, expect, it } from "vitest";
import { RoomManager } from "./room-manager.js";

describe("RoomManager", () => {
  it("creates room with a host and join code", () => {
    const manager = new RoomManager(() => 0);

    const { room, playerId, reconnectToken } = manager.createRoom({
      nickname: "Mochi",
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
    const created = manager.createRoom({ nickname: "Mochi", nowMs: 1_000 });

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
    const created = manager.createRoom({ nickname: "Mochi", nowMs: 1_000 });
    const joined = manager.joinRoom({
      code: created.room.code,
      nickname: "Luna",
      nowMs: 2_000,
    });

    const room = manager.startGame(created.room.code, created.playerId, 3_000);

    expect(joined.playerId).not.toBe(created.playerId);
    expect(room.match.phase).toBe("playing");
    expect(room.match.currentPlayerId).toBe(created.playerId);
    expect(room.players.map((p) => p.nickname)).toEqual(["Mochi", "Luna"]);
  });

  it("lists only rooms with an active match for ticking", () => {
    let next = 0;
    const manager = new RoomManager(() => (next++ % 16) / 16);
    const lobby = manager.createRoom({ nickname: "Mochi", nowMs: 1_000 });
    const playing = manager.createRoom({ nickname: "Luna", nowMs: 2_000 });
    manager.joinRoom({
      code: playing.room.code,
      nickname: "Kiki",
      nowMs: 3_000,
    });

    manager.startGame(playing.room.code, playing.playerId, 4_000);

    expect(manager.playingRoomCodes()).toEqual([playing.room.code]);
    expect(manager.playingRoomCodes()).not.toContain(lobby.room.code);
  });

  it("auto-assigns distinct avatars on create and join", () => {
    const manager = new RoomManager(() => 0);
    const created = manager.createRoom({ nickname: "Mochi", nowMs: 1_000 });
    const joined = manager.joinRoom({
      code: created.room.code,
      nickname: "Luna",
      nowMs: 2_000,
    });

    const roomAvatars = joined.room.players.map((player) => player.avatar);
    expect(new Set(roomAvatars).size).toBe(2);
    expect(roomAvatars[0]).toBe("tabby");
    expect(roomAvatars[1]).toBe("calico");
  });

  it("rejects setAvatar when another player already holds that cat", () => {
    const manager = new RoomManager(() => 0);
    const created = manager.createRoom({ nickname: "Mochi", nowMs: 1_000 });
    const joined = manager.joinRoom({
      code: created.room.code,
      nickname: "Luna",
      nowMs: 2_000,
    });

    expect(() => manager.setAvatar(created.room.code, joined.playerId, "tabby")).toThrow("這隻貓已被選走");
  });

  it("allows setAvatar to a free avatar and frees previous on change", () => {
    const manager = new RoomManager(() => 0);
    const created = manager.createRoom({ nickname: "Mochi", nowMs: 1_000 });
    const joined = manager.joinRoom({
      code: created.room.code,
      nickname: "Luna",
      nowMs: 2_000,
    });

    const room = manager.setAvatar(created.room.code, joined.playerId, "black");
    expect(room.players.find((p) => p.id === joined.playerId)?.avatar).toBe("black");

    const hostSwitched = manager.setAvatar(created.room.code, created.playerId, "calico");
    expect(hostSwitched.players.find((p) => p.id === created.playerId)?.avatar).toBe("calico");
  });

  it("frees avatar after kick so another player can take it", () => {
    const manager = new RoomManager(() => 0);
    const created = manager.createRoom({ nickname: "Mochi", nowMs: 1_000 });
    const joined = manager.joinRoom({
      code: created.room.code,
      nickname: "Luna",
      nowMs: 2_000,
    });
    const lunaAvatar = joined.room.players.find((p) => p.id === joined.playerId)!.avatar;

    manager.kick(created.room.code, created.playerId, joined.playerId);
    const again = manager.joinRoom({
      code: created.room.code,
      nickname: "Kiki",
      nowMs: 3_000,
    });
    expect(again.room.players.find((p) => p.id === again.playerId)?.avatar).toBe(lunaAvatar);
  });

  it("rejects setAvatar after the match has started", () => {
    const manager = new RoomManager(() => 0);
    const created = manager.createRoom({ nickname: "Mochi", nowMs: 1_000 });
    manager.joinRoom({ code: created.room.code, nickname: "Luna", nowMs: 2_000 });
    manager.startGame(created.room.code, created.playerId, 3_000);

    expect(() => manager.setAvatar(created.room.code, created.playerId, "black")).toThrow("遊戲已開始");
  });
});
