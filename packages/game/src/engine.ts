import { BOARD, BOARD_SIZE } from "./board.js";
import { rentDue } from "./economy.js";
import type { BoardSpace, CatAvatarId, GameEvent, MatchPublic, PlayerPublic } from "./types.js";

export const STARTING_FOOD = 1500;
export const GO_SALARY = 200;
export const TURN_TIMER_MS = 45_000;
export const CAGE_FINE = 50;

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
  | { type: "buildHouse"; playerId: string; spaceId: string; nowMs: number }
  | { type: "payCageFine"; playerId: string; nowMs: number }
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
    case "buildHouse":
      return applyBuildHouse(state, intent);
    case "payCageFine":
      return applyPayCageFine(state, intent);
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
  if (player.inCage) {
    return applyCageRoll(state, player, dice, intent.nowMs);
  }

  return movePlayerByDice(state, player.id, dice, intent.nowMs);
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
      awaiting: "buildOrEnd",
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
      awaiting: "buildOrEnd",
      events: [...state.events, makeEvent(state, intent.nowMs, "略過購買。")],
    },
  };
}

function applyBuildHouse(
  state: MatchState,
  intent: Extract<GameIntent, { type: "buildHouse" }>,
): ApplyIntentResult {
  if (state.awaiting !== "buildOrEnd" && state.awaiting !== "end") {
    return { state, error: "目前不能建造" };
  }
  if (state.currentPlayerId !== intent.playerId) {
    return { state, error: "不是目前玩家的回合" };
  }

  const player = state.players.find((p) => p.id === intent.playerId);
  const space = BOARD.find((s) => s.id === intent.spaceId);
  if (!player || player.bankrupt) return { state, error: "玩家不能行動" };
  if (!space || space.kind !== "territory") return { state, error: "這格不能建造" };

  const owner = state.ownership[space.id];
  if (!owner || owner.ownerId !== player.id) {
    return { state, error: "尚未擁有這格" };
  }

  const groupSpaces = BOARD.filter(
    (candidate): candidate is Extract<BoardSpace, { kind: "territory" }> =>
      candidate.kind === "territory" && candidate.group === space.group,
  );
  const groupOwnership = groupSpaces.map((groupSpace) => state.ownership[groupSpace.id]);
  if (groupOwnership.some((owned) => owned?.ownerId !== player.id)) {
    return { state, error: "需要擁有整組顏色" };
  }
  if (owner.buildings >= 5) {
    return { state, error: "已達建造上限" };
  }
  if (player.food < space.houseCost) {
    return { state, error: "食物不足" };
  }

  const minBuildings = Math.min(...groupOwnership.map((owned) => owned?.buildings ?? 0));
  const nextBuildings = owner.buildings + 1;
  if (nextBuildings > minBuildings + 1) {
    return { state, error: "建築需要平均分配" };
  }

  return {
    state: {
      ...state,
      awaiting: "buildOrEnd",
      ownership: {
        ...state.ownership,
        [space.id]: { ...owner, buildings: nextBuildings as 1 | 2 | 3 | 4 | 5 },
      },
      players: state.players.map((p) => (p.id === player.id ? { ...p, food: p.food - space.houseCost } : p)),
      events: [
        ...state.events,
        makeEvent(state, intent.nowMs, `${player.nickname} 在 ${space.name} 建造${nextBuildings === 5 ? "貓別墅" : "貓屋"}。`),
      ],
    },
  };
}

function applyPayCageFine(
  state: MatchState,
  intent: Extract<GameIntent, { type: "payCageFine" }>,
): ApplyIntentResult {
  if (state.awaiting !== "roll") {
    return { state, error: "目前不能支付罰金" };
  }
  if (state.currentPlayerId !== intent.playerId) {
    return { state, error: "不是目前玩家的回合" };
  }

  const player = state.players.find((p) => p.id === intent.playerId);
  if (!player || player.bankrupt) return { state, error: "玩家不能行動" };
  if (!player.inCage) return { state, error: "玩家不在貓籠" };
  if (player.food < CAGE_FINE) {
    return bankruptPlayer(state, player.id, intent.nowMs, `${player.nickname} 無法支付貓籠罰金，破產。`);
  }

  return {
    state: {
      ...state,
      awaiting: "roll",
      players: state.players.map((p) =>
        p.id === player.id ? { ...p, food: p.food - CAGE_FINE, inCage: false, cageTurnsSkipped: 0 } : p,
      ),
      events: [...state.events, makeEvent(state, intent.nowMs, `${player.nickname} 支付 ${CAGE_FINE} 份食物離開貓籠。`)],
    },
  };
}

function applyEndTurn(
  state: MatchState,
  intent: Extract<GameIntent, { type: "endTurn" }>,
): ApplyIntentResult {
  if (state.awaiting !== "end" && state.awaiting !== "buildOrEnd") {
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

function applyCageRoll(state: MatchState, player: PlayerPublic, dice: [number, number], nowMs: number): ApplyIntentResult {
  if (dice[0] === dice[1]) {
    const freedState: MatchState = {
      ...state,
      players: state.players.map((p) => (p.id === player.id ? { ...p, inCage: false, cageTurnsSkipped: 0 } : p)),
    };
    return movePlayerByDice(freedState, player.id, dice, nowMs, "離開貓籠，");
  }

  const skippedTurns = player.cageTurnsSkipped + 1;
  if (skippedTurns < 3) {
    return {
      state: {
        ...state,
        awaiting: "buildOrEnd",
        lastDice: dice,
        players: state.players.map((p) => (p.id === player.id ? { ...p, cageTurnsSkipped: skippedTurns } : p)),
        events: [
          ...state.events,
          makeEvent(state, nowMs, `${player.nickname} 沒有擲出雙骰，留在貓籠（第 ${skippedTurns} 次）。`),
        ],
      },
    };
  }

  if (player.food < CAGE_FINE) {
    return bankruptPlayer(state, player.id, nowMs, `${player.nickname} 無法支付貓籠罰金，破產。`);
  }

  const paidState: MatchState = {
    ...state,
    players: state.players.map((p) =>
      p.id === player.id ? { ...p, food: p.food - CAGE_FINE, inCage: false, cageTurnsSkipped: 0 } : p,
    ),
  };
  return movePlayerByDice(paidState, player.id, dice, nowMs, `支付 ${CAGE_FINE} 份食物離開貓籠，`);
}

function movePlayerByDice(
  state: MatchState,
  playerId: string,
  dice: [number, number],
  nowMs: number,
  messagePrefix = "",
): ApplyIntentResult {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return { state, error: "玩家不能行動" };

  const moveBy = dice[0] + dice[1];
  const nextPosition = (player.position + moveBy) % BOARD_SIZE;
  const collectsGo = player.position + moveBy >= BOARD_SIZE;
  const landed = BOARD[nextPosition]!;
  const cageSpace = BOARD.find((space) => space.kind === "cage")!;
  const sentToCage = landed.kind === "goToCage";
  const food = player.food + (collectsGo ? GO_SALARY : 0);
  const players = state.players.map((p) =>
    p.id === player.id
      ? {
          ...p,
          position: sentToCage ? cageSpace.index : nextPosition,
          food,
          inCage: sentToCage ? true : p.inCage,
          cageTurnsSkipped: sentToCage ? 0 : p.cageTurnsSkipped,
        }
      : p,
  );
  const event: GameEvent = {
    id: `event-${nowMs}-${state.events.length + 1}`,
    at: nowMs,
    message: `${player.nickname} 擲出 ${dice[0]} + ${dice[1]}，${messagePrefix}移動到 ${landed.name}${
      collectsGo ? `，獲得 ${GO_SALARY} 份食物` : ""
    }${sentToCage ? `，被送到${cageSpace.name}` : ""}。`,
  };

  const movedState: MatchState = {
    ...state,
    players,
    awaiting: isUnownedBuyable(state, landed.id) ? "buyOrSkip" : "buildOrEnd",
    lastDice: dice,
    events: [...state.events, event],
  };

  if (movedState.awaiting === "buyOrSkip" || sentToCage) {
    return { state: movedState };
  }

  return { state: chargeRentIfNeeded(movedState, player.id, landed, nowMs) };
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

function bankruptPlayer(state: MatchState, playerId: string, nowMs: number, message: string): ApplyIntentResult {
  const players = state.players.map((p) =>
    p.id === playerId ? { ...p, food: 0, bankrupt: true, inCage: false, cageTurnsSkipped: 0 } : p,
  );
  const winnerId = winnerFromPlayers(players);
  return {
    state: {
      ...state,
      awaiting: "buildOrEnd",
      players,
      winnerId,
      phase: winnerId ? "finished" : state.phase,
      events: [...state.events, makeEvent(state, nowMs, message)],
    },
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
