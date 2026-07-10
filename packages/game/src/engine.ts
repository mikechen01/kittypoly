import { BOARD, BOARD_SIZE } from "./board.js";
import type { CatAvatarId, GameEvent, MatchPublic, PlayerPublic } from "./types.js";

export const STARTING_FOOD = 1500;
export const GO_SALARY = 200;
export const TURN_TIMER_MS = 45_000;

export interface MatchState extends MatchPublic {
  phase: "playing";
  players: PlayerPublic[];
  decks: {
    scratch: [];
    teaser: [];
    scratchIndex: number;
    teaserIndex: number;
  };
  lastDice: [number, number] | null;
  rng: () => number;
}

export interface CreateMatchInput {
  playerIds: string[];
  nicknames: Record<string, string>;
  avatars: Record<string, CatAvatarId>;
  nowMs: number;
  rng: () => number;
}

export type GameIntent = {
  type: "rollDice";
  playerId: string;
  nowMs: number;
  dice?: [number, number];
};

export interface ApplyIntentResult {
  state: MatchState;
  error?: string;
}

export function createMatch(input: CreateMatchInput): MatchState {
  return {
    phase: "playing",
    boardId: "standard40",
    players: input.playerIds.map((id) => ({
      id,
      nickname: input.nicknames[id] ?? id,
      avatar: input.avatars[id] ?? "tabby",
      food: STARTING_FOOD,
      position: 0,
      inCage: false,
      cageTurnsSkipped: 0,
      bankrupt: false,
      connected: true,
    })),
    ownership: {},
    decks: { scratch: [], teaser: [], scratchIndex: 0, teaserIndex: 0 },
    currentPlayerId: input.playerIds[0] ?? null,
    turnDeadlineMs: input.nowMs + TURN_TIMER_MS,
    awaiting: "roll",
    lastDice: null,
    events: [],
    winnerId: null,
    rng: input.rng,
  };
}

export function applyIntent(state: MatchState, intent: GameIntent): ApplyIntentResult {
  if (intent.type !== "rollDice") {
    return { state, error: "未知動作" };
  }

  if (state.awaiting !== "roll") {
    return { state, error: "目前不能擲骰" };
  }
  if (state.currentPlayerId !== intent.playerId) {
    return { state, error: "不是目前玩家的回合" };
  }

  const player = state.players.find((p) => p.id === intent.playerId);
  if (!player || player.bankrupt) {
    return { state, error: "玩家不能行動" };
  }

  const dice = intent.dice ?? [rollDie(state.rng), rollDie(state.rng)];
  const moveBy = dice[0] + dice[1];
  const nextPosition = (player.position + moveBy) % BOARD_SIZE;
  const collectsGo = player.position + moveBy >= BOARD_SIZE;
  const landed = BOARD[nextPosition]!;
  const awaiting = isUnownedBuyable(state, landed.id) ? "buyOrSkip" : "end";
  const food = player.food + (collectsGo ? GO_SALARY : 0);
  const players = state.players.map((p) =>
    p.id === player.id ? { ...p, position: nextPosition, food } : p,
  );
  const event: GameEvent = {
    id: `event-${intent.nowMs}-${state.events.length + 1}`,
    at: intent.nowMs,
    message: `${player.nickname} 擲出 ${dice[0]} + ${dice[1]}，移動到 ${landed.name}${
      collectsGo ? `，獲得 ${GO_SALARY} 份食物` : ""
    }。`,
  };

  return {
    state: {
      ...state,
      players,
      awaiting,
      lastDice: dice,
      events: [...state.events, event],
    },
  };
}

function rollDie(rng: () => number): number {
  return Math.floor(rng() * 6) + 1;
}

function isUnownedBuyable(state: MatchState, spaceId: string): boolean {
  const space = BOARD.find((s) => s.id === spaceId);
  return (space?.kind === "territory" || space?.kind === "catTree") && !state.ownership[spaceId];
}
