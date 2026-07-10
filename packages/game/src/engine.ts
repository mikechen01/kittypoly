import { BOARD, BOARD_SIZE } from "./board.js";
import { rentDue } from "./economy.js";
import type { BoardSpace, CatAvatarId, GameEvent, MatchPublic, PlayerPublic } from "./types.js";

export const STARTING_FOOD = 1500;
export const GO_SALARY = 200;
export const TURN_TIMER_MS = 45_000;

export interface MatchState extends MatchPublic {
  phase: "playing" | "finished";
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

export type GameIntent =
  | {
      type: "rollDice";
      playerId: string;
      nowMs: number;
      dice?: [number, number];
    }
  | { type: "buyTerritory"; playerId: string; nowMs: number }
  | { type: "skipBuy"; playerId: string; nowMs: number }
  | { type: "endTurn"; playerId: string; nowMs: number };

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
  if (state.winnerId || state.phase === "finished") {
    return { state, error: "對局已結束" };
  }

  switch (intent.type) {
    case "rollDice":
      return applyRollDice(state, intent);
    case "buyTerritory":
      return applyBuyTerritory(state, intent);
    case "skipBuy":
      return applySkipBuy(state, intent);
    case "endTurn":
      return applyEndTurn(state, intent);
  }
}

function applyRollDice(
  state: MatchState,
  intent: Extract<GameIntent, { type: "rollDice" }>,
): ApplyIntentResult {
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

  const movedState: MatchState = {
    ...state,
    players,
    awaiting: isUnownedBuyable(state, landed.id) ? "buyOrSkip" : "end",
    lastDice: dice,
    events: [...state.events, event],
  };

  if (movedState.awaiting === "buyOrSkip") {
    return { state: movedState };
  }

  return { state: chargeRentIfNeeded(movedState, player.id, landed, intent.nowMs) };
}

function applyBuyTerritory(
  state: MatchState,
  intent: Extract<GameIntent, { type: "buyTerritory" }>,
): ApplyIntentResult {
  if (state.awaiting !== "buyOrSkip") {
    return { state, error: "目前不能購買" };
  }
  if (state.currentPlayerId !== intent.playerId) {
    return { state, error: "不是目前玩家的回合" };
  }

  const player = state.players.find((p) => p.id === intent.playerId);
  if (!player || player.bankrupt) {
    return { state, error: "玩家不能行動" };
  }

  const space = BOARD[player.position];
  if (!space || !isBuyableSpace(space) || state.ownership[space.id]) {
    return { state, error: "這格不能購買" };
  }
  if (player.food < space.price) {
    return { state, error: "食物不足" };
  }

  return {
    state: {
      ...state,
      awaiting: "end",
      ownership: { ...state.ownership, [space.id]: { ownerId: player.id, buildings: 0 } },
      players: state.players.map((p) => (p.id === player.id ? { ...p, food: p.food - space.price } : p)),
      events: [...state.events, makeEvent(state, intent.nowMs, `${player.nickname} 買下 ${space.name}。`)],
    },
  };
}

function applySkipBuy(
  state: MatchState,
  intent: Extract<GameIntent, { type: "skipBuy" }>,
): ApplyIntentResult {
  if (state.awaiting !== "buyOrSkip") {
    return { state, error: "目前不能略過購買" };
  }
  if (state.currentPlayerId !== intent.playerId) {
    return { state, error: "不是目前玩家的回合" };
  }

  return {
    state: {
      ...state,
      awaiting: "end",
      events: [...state.events, makeEvent(state, intent.nowMs, "略過購買。")],
    },
  };
}

function applyEndTurn(
  state: MatchState,
  intent: Extract<GameIntent, { type: "endTurn" }>,
): ApplyIntentResult {
  if (state.awaiting !== "end") {
    return { state, error: "目前不能結束回合" };
  }
  if (state.currentPlayerId !== intent.playerId) {
    return { state, error: "不是目前玩家的回合" };
  }

  const nextPlayerId = nextNonBankruptPlayerId(state);
  return {
    state: {
      ...state,
      currentPlayerId: nextPlayerId,
      awaiting: nextPlayerId ? "roll" : "end",
      turnDeadlineMs: nextPlayerId ? intent.nowMs + TURN_TIMER_MS : null,
    },
  };
}

function rollDie(rng: () => number): number {
  return Math.floor(rng() * 6) + 1;
}

function isUnownedBuyable(state: MatchState, spaceId: string): boolean {
  const space = BOARD.find((s) => s.id === spaceId);
  return !!space && isBuyableSpace(space) && !state.ownership[spaceId];
}

function isBuyableSpace(space: BoardSpace): space is Extract<BoardSpace, { kind: "territory" | "catTree" }> {
  return space.kind === "territory" || space.kind === "catTree";
}

function chargeRentIfNeeded(state: MatchState, visitorId: string, space: BoardSpace, nowMs: number): MatchState {
  if (!isBuyableSpace(space)) {
    return state;
  }

  const owner = state.ownership[space.id];
  if (!owner || owner.ownerId === visitorId) {
    return state;
  }

  const rent = rentDue({
    space,
    buildings: owner.buildings,
    ownerCatTreeCount: countOwnedCatTrees(state, owner.ownerId),
  });
  const visitor = state.players.find((p) => p.id === visitorId);
  const creditor = state.players.find((p) => p.id === owner.ownerId);
  if (!visitor || !creditor || visitor.bankrupt || creditor.bankrupt) {
    return state;
  }

  if (visitor.food >= rent) {
    return {
      ...state,
      players: state.players.map((p) => {
        if (p.id === visitor.id) return { ...p, food: p.food - rent };
        if (p.id === creditor.id) return { ...p, food: p.food + rent };
        return p;
      }),
      events: [...state.events, makeEvent(state, nowMs, `${visitor.nickname} 支付 ${rent} 份租金給 ${creditor.nickname}。`)],
    };
  }

  const transferredFood = visitor.food;
  const ownership = Object.fromEntries(
    Object.entries(state.ownership).map(([spaceId, owned]) => [
      spaceId,
      owned.ownerId === visitor.id ? { ...owned, ownerId: creditor.id } : owned,
    ]),
  );
  const players = state.players.map((p) => {
    if (p.id === visitor.id) return { ...p, food: 0, bankrupt: true };
    if (p.id === creditor.id) return { ...p, food: p.food + transferredFood };
    return p;
  });
  const winnerId = winnerFromPlayers(players);

  return {
    ...state,
    ownership,
    players,
    winnerId,
    phase: winnerId ? "finished" : state.phase,
    events: [
      ...state.events,
      makeEvent(
        state,
        nowMs,
        `${visitor.nickname} 無法支付 ${rent} 份租金，破產並將資產轉給 ${creditor.nickname}。`,
      ),
    ],
  };
}

function countOwnedCatTrees(state: MatchState, ownerId: string): number {
  return BOARD.filter((space) => space.kind === "catTree" && state.ownership[space.id]?.ownerId === ownerId).length;
}

function winnerFromPlayers(players: PlayerPublic[]): string | null {
  const survivors = players.filter((p) => !p.bankrupt);
  return survivors.length === 1 ? survivors[0]!.id : null;
}

function nextNonBankruptPlayerId(state: MatchState): string | null {
  if (!state.currentPlayerId) return null;

  const currentIndex = state.players.findIndex((p) => p.id === state.currentPlayerId);
  if (currentIndex === -1) return null;

  for (let offset = 1; offset <= state.players.length; offset++) {
    const candidate = state.players[(currentIndex + offset) % state.players.length]!;
    if (!candidate.bankrupt) return candidate.id;
  }

  return null;
}

function makeEvent(state: MatchState, nowMs: number, message: string): GameEvent {
  return {
    id: `event-${nowMs}-${state.events.length + 1}`,
    at: nowMs,
    message,
  };
}
