import { STARTING_FOOD, applyIntent, createMatch } from "@kittypoly/game";
import type { CatAvatarId, GameIntent, MatchPublic, MatchState, PlayerPublic, RoomPublic } from "@kittypoly/game";
import { generateReconnectToken } from "./session.js";

export const RECONNECT_GRACE_MS = 120_000;

const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_CODE_LENGTH = 6;
const MAX_PLAYERS = 4;

interface RoomPlayer extends PlayerPublic {
  reconnectToken: string;
  disconnectedAtMs: number | null;
}

interface RoomState {
  code: string;
  hostId: string;
  players: RoomPlayer[];
  match: MatchState | null;
}

export class RoomManager {
  private readonly rooms = new Map<string, RoomState>();
  private nextPlayerNumber = 1;

  constructor(private rng: () => number = Math.random) {}

  createRoom(input: {
    nickname: string;
    avatar: CatAvatarId;
    nowMs: number;
  }): { room: RoomPublic; playerId: string; reconnectToken: string } {
    const player = this.createPlayer(input);
    const room: RoomState = {
      code: this.generateRoomCode(),
      hostId: player.id,
      players: [player],
      match: null,
    };

    this.rooms.set(room.code, room);
    return { room: toPublicRoom(room), playerId: player.id, reconnectToken: player.reconnectToken };
  }

  joinRoom(input: {
    code: string;
    nickname: string;
    avatar: CatAvatarId;
    nowMs: number;
  }): { room: RoomPublic; playerId: string; reconnectToken: string } {
    const room = this.requireRoom(input.code);
    if (room.match) throw new Error("遊戲已開始");
    if (room.players.length >= MAX_PLAYERS) throw new Error("房間已滿");

    const player = this.createPlayer(input);
    room.players.push(player);
    return { room: toPublicRoom(room), playerId: player.id, reconnectToken: player.reconnectToken };
  }

  kick(code: string, hostId: string, targetPlayerId: string): RoomPublic {
    const room = this.requireRoom(code);
    if (room.hostId !== hostId) throw new Error("只有房主可以踢人");
    if (targetPlayerId === room.hostId) throw new Error("不能踢出房主");
    if (room.match) throw new Error("遊戲已開始");

    const nextPlayers = room.players.filter((player) => player.id !== targetPlayerId);
    if (nextPlayers.length === room.players.length) throw new Error("找不到玩家");
    room.players = nextPlayers;
    return toPublicRoom(room);
  }

  setAvatar(code: string, playerId: string, avatar: CatAvatarId): RoomPublic {
    const room = this.requireRoom(code);
    this.updatePlayer(room, playerId, { avatar });
    return toPublicRoom(room);
  }

  startGame(code: string, hostId: string, nowMs: number): RoomPublic {
    const room = this.requireRoom(code);
    if (room.hostId !== hostId) throw new Error("只有房主可以開始遊戲");
    if (room.match) throw new Error("遊戲已開始");
    if (room.players.length < 2) throw new Error("至少需要 2 位玩家");
    if (room.players.length > MAX_PLAYERS) throw new Error("最多 4 位玩家");

    const playerIds = room.players.map((player) => player.id);
    room.match = createMatch({
      playerIds,
      nicknames: Object.fromEntries(room.players.map((player) => [player.id, player.nickname])),
      avatars: Object.fromEntries(room.players.map((player) => [player.id, player.avatar])),
      nowMs,
      rng: this.rng,
    });
    room.match.players = room.match.players.map((player) => ({
      ...player,
      connected: room.players.find((roomPlayer) => roomPlayer.id === player.id)?.connected ?? player.connected,
    }));
    return toPublicRoom(room);
  }

  disconnect(code: string, playerId: string, nowMs: number): void {
    const room = this.requireRoom(code);
    this.updatePlayer(room, playerId, { connected: false, disconnectedAtMs: nowMs });
  }

  reconnect(input: {
    code: string;
    reconnectToken: string;
    nowMs: number;
  }): { room: RoomPublic; playerId: string; reconnectToken: string } {
    const room = this.requireRoom(input.code);
    const player = room.players.find((candidate) => candidate.reconnectToken === input.reconnectToken);
    if (!player) throw new Error("無效的重連 token");

    this.updatePlayer(room, player.id, { connected: true, disconnectedAtMs: null });
    return { room: toPublicRoom(room), playerId: player.id, reconnectToken: player.reconnectToken };
  }

  handleIntent(code: string, playerId: string, intentType: string, nowMs: number, extra?: { spaceId?: string }): RoomPublic {
    const room = this.requireRoom(code);
    if (!room.match) throw new Error("遊戲尚未開始");

    const result = applyIntent(room.match, this.toGameIntent(playerId, intentType, nowMs, extra));
    if (result.error) throw new Error(result.error);

    room.match = result.state;
    return toPublicRoom(room);
  }

  tickRoom(code: string, nowMs: number): RoomPublic | null {
    const room = this.rooms.get(code);
    if (!room) return null;
    if (!room.match) return toPublicRoom(room);

    const result = applyIntent(room.match, { type: "tick", nowMs });
    if (result.error) throw new Error(result.error);

    room.match = result.state;
    return toPublicRoom(room);
  }

  getRoom(code: string): RoomPublic | null {
    const room = this.rooms.get(code);
    return room ? toPublicRoom(room) : null;
  }

  playingRoomCodes(): string[] {
    return [...this.rooms.values()].filter((room) => room.match?.phase === "playing").map((room) => room.code);
  }

  private createPlayer(input: { nickname: string; avatar: CatAvatarId }): RoomPlayer {
    return {
      id: `player-${this.nextPlayerNumber++}`,
      nickname: input.nickname,
      avatar: input.avatar,
      food: STARTING_FOOD,
      position: 0,
      inCage: false,
      cageTurnsSkipped: 0,
      bankrupt: false,
      connected: true,
      reconnectToken: generateReconnectToken(),
      disconnectedAtMs: null,
    };
  }

  private generateRoomCode(): string {
    for (let attempt = 0; attempt < 100; attempt++) {
      let code = "";
      for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
        code += ROOM_CODE_CHARS[Math.floor(this.rng() * ROOM_CODE_CHARS.length)]!;
      }
      if (!this.rooms.has(code)) return code;
    }

    throw new Error("無法產生房間代碼");
  }

  private requireRoom(code: string): RoomState {
    const room = this.rooms.get(code);
    if (!room) throw new Error("找不到房間");
    return room;
  }

  private updatePlayer(room: RoomState, playerId: string, patch: Partial<RoomPlayer>): void {
    let found = false;
    room.players = room.players.map((player) => {
      if (player.id !== playerId) return player;
      found = true;
      return { ...player, ...patch };
    });
    if (!found) throw new Error("找不到玩家");

    if (room.match) {
      room.match = {
        ...room.match,
        players: room.match.players.map((player) =>
          player.id === playerId ? { ...player, ...publicPlayerPatch(patch) } : player,
        ),
      };
    }
  }

  private toGameIntent(
    playerId: string,
    intentType: string,
    nowMs: number,
    extra?: { spaceId?: string },
  ): GameIntent {
    switch (intentType) {
      case "rollDice":
        return { type: "rollDice", playerId, nowMs };
      case "buyTerritory":
        return { type: "buyTerritory", playerId, nowMs };
      case "skipBuy":
        return { type: "skipBuy", playerId, nowMs };
      case "buildHouse":
        if (!extra?.spaceId) throw new Error("缺少 spaceId");
        return { type: "buildHouse", playerId, spaceId: extra.spaceId, nowMs };
      case "payCageFine":
        return { type: "payCageFine", playerId, nowMs };
      case "endTurn":
        return { type: "endTurn", playerId, nowMs };
      default:
        throw new Error("未知的遊戲動作");
    }
  }
}

function toPublicRoom(room: RoomState): RoomPublic {
  return {
    code: room.code,
    hostId: room.hostId,
    players: room.match ? room.match.players.map(copyPublicPlayer) : room.players.map(copyPublicPlayer),
    match: room.match ? toPublicMatch(room.match) : lobbyMatch(),
  };
}

function lobbyMatch(): MatchPublic {
  return {
    phase: "lobby",
    boardId: "standard40",
    currentPlayerId: null,
    turnDeadlineMs: null,
    awaiting: "roll",
    ownership: {},
    winnerId: null,
    events: [],
  };
}

function toPublicMatch(match: MatchState): MatchPublic {
  return {
    phase: match.phase,
    boardId: match.boardId,
    currentPlayerId: match.currentPlayerId,
    turnDeadlineMs: match.turnDeadlineMs,
    awaiting: match.awaiting,
    ownership: { ...match.ownership },
    winnerId: match.winnerId,
    events: [...match.events],
  };
}

function copyPublicPlayer(player: PlayerPublic): PlayerPublic {
  return {
    id: player.id,
    nickname: player.nickname,
    avatar: player.avatar,
    food: player.food,
    position: player.position,
    inCage: player.inCage,
    cageTurnsSkipped: player.cageTurnsSkipped,
    bankrupt: player.bankrupt,
    connected: player.connected,
  };
}

function publicPlayerPatch(patch: Partial<RoomPlayer>): Partial<PlayerPublic> {
  const publicPatch: Partial<PlayerPublic> = {};
  if (patch.nickname !== undefined) publicPatch.nickname = patch.nickname;
  if (patch.avatar !== undefined) publicPatch.avatar = patch.avatar;
  if (patch.food !== undefined) publicPatch.food = patch.food;
  if (patch.position !== undefined) publicPatch.position = patch.position;
  if (patch.inCage !== undefined) publicPatch.inCage = patch.inCage;
  if (patch.cageTurnsSkipped !== undefined) publicPatch.cageTurnsSkipped = patch.cageTurnsSkipped;
  if (patch.bankrupt !== undefined) publicPatch.bankrupt = patch.bankrupt;
  if (patch.connected !== undefined) publicPatch.connected = patch.connected;
  return publicPatch;
}
