import { BOARD, BOARD_SIZE } from "./board.js";
import { SCRATCH_DECK, TEASER_DECK } from "./cards.js";
import { rentDue } from "./economy.js";
import type { CardDef, CardEffect } from "./cards.js";
import type { BoardSpace, CatAvatarId, GameEvent, MatchPublic, PlayerPublic } from "./types.js";

export const STARTING_FOOD = 1500;
export const GO_SALARY = 200;
export const TURN_TIMER_MS = 45_000;
export const CAGE_FINE = 50;

export interface MatchState extends MatchPublic {
  phase: "playing" | "finished";
  players: PlayerPublic[];
  decks: {
    scratch: CardDef[];
    teaser: CardDef[];
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
  | { type: "endTurn"; playerId: string; nowMs: number }
  | { type: "tick"; nowMs: number };

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
    decks: {
      scratch: shuffleDeck(SCRATCH_DECK, input.rng),
      teaser: shuffleDeck(TEASER_DECK, input.rng),
      scratchIndex: 0,
      teaserIndex: 0,
    },
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
    case "tick":
      return applyTick(state, intent);
  }
}

function applyTick(state: MatchState, intent: Extract<GameIntent, { type: "tick" }>): ApplyIntentResult {
  let current = state;

  for (let i = 0; i < 20; i++) {
    if (current.phase !== "playing" || current.winnerId || current.turnDeadlineMs === null) break;
    if (intent.nowMs < current.turnDeadlineMs) break;

    const playerId = current.currentPlayerId;
    if (!playerId) break;

    let result: ApplyIntentResult;
    switch (current.awaiting) {
      case "roll":
        result = applyRollDice(addSystemEvent(current, intent.nowMs, "系統代行：逾時自動擲骰。"), {
          type: "rollDice",
          playerId,
          nowMs: intent.nowMs,
        });
        break;
      case "buyOrSkip":
        result = applySkipBuy(current, { type: "skipBuy", playerId, nowMs: intent.nowMs });
        break;
      case "buildOrEnd":
      case "end":
        result = applyEndTurn(current, { type: "endTurn", playerId, nowMs: intent.nowMs });
        break;
    }

    if (result.error) return result;
    current = result.state;
  }

  return { state: current };
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

function shuffleDeck(deck: CardDef[], rng: () => number): CardDef[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
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

  if (landed.kind === "scratch" || landed.kind === "teaser") {
    return { state: drawCardAndResolve(movedState, player.id, landed.kind, nowMs) };
  }

  if (movedState.awaiting === "buyOrSkip" || sentToCage) {
    return { state: movedState };
  }

  return { state: chargeRentIfNeeded(movedState, player.id, landed, nowMs) };
}

function drawCardAndResolve(
  state: MatchState,
  playerId: string,
  deckKind: "scratch" | "teaser",
  nowMs: number,
): MatchState {
  const deck = state.decks[deckKind];
  if (deck.length === 0) return finishCardLanding(state, playerId, nowMs);

  const indexKey = deckKind === "scratch" ? "scratchIndex" : "teaserIndex";
  const cardIndex = state.decks[indexKey] % deck.length;
  const card = deck[cardIndex]!;
  const nextState: MatchState = {
    ...state,
    decks: { ...state.decks, [indexKey]: (cardIndex + 1) % deck.length },
    events: [...state.events, makeEvent(state, nowMs, card.text)],
  };

  return applyCardEffect(nextState, playerId, card.effect, nowMs);
}

function applyCardEffect(state: MatchState, playerId: string, effect: CardEffect, nowMs: number): MatchState {
  const player = state.players.find((p) => p.id === playerId);
  if (!player || player.bankrupt) return state;

  switch (effect.type) {
    case "gainFood":
      return finishCardLanding(
        {
          ...state,
          players: state.players.map((p) => (p.id === player.id ? { ...p, food: p.food + effect.amount } : p)),
        },
        player.id,
        nowMs,
      );
    case "loseFood":
      return finishCardLanding(chargeBank(state, player.id, effect.amount, nowMs), player.id, nowMs);
    case "moveTo": {
      const targetIndex = clampBoardIndex(effect.index);
      const collectsGo = effect.collectGo && targetIndex <= player.position;
      return movePlayerFromCard(state, player.id, targetIndex, collectsGo, nowMs);
    }
    case "moveRelative": {
      const rawIndex = player.position + effect.steps;
      const targetIndex = clampBoardIndex(rawIndex);
      const collectsGo = effect.steps > 0 && rawIndex >= BOARD_SIZE;
      return movePlayerFromCard(state, player.id, targetIndex, collectsGo, nowMs);
    }
    case "goToCage":
      return sendPlayerToCageFromCard(state, player.id, nowMs);
    case "repair":
      return finishCardLanding(chargeBank(state, player.id, repairCost(state, player.id, effect), nowMs), player.id, nowMs);
  }
}

function movePlayerFromCard(state: MatchState, playerId: string, targetIndex: number, collectsGo: boolean, nowMs: number): MatchState {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return state;
  const movedState: MatchState = {
    ...state,
    players: state.players.map((p) =>
      p.id === player.id
        ? { ...p, position: targetIndex, food: p.food + (collectsGo ? GO_SALARY : 0), inCage: false, cageTurnsSkipped: 0 }
        : p,
    ),
  };
  return finishCardLanding(movedState, player.id, nowMs);
}

function sendPlayerToCageFromCard(state: MatchState, playerId: string, nowMs: number): MatchState {
  const cageSpace = BOARD.find((space) => space.kind === "cage")!;
  const cagedState: MatchState = {
    ...state,
    players: state.players.map((p) =>
      p.id === playerId ? { ...p, position: cageSpace.index, inCage: true, cageTurnsSkipped: 0 } : p,
    ),
  };
  return finishCardLanding(cagedState, playerId, nowMs);
}

function finishCardLanding(state: MatchState, playerId: string, nowMs: number): MatchState {
  if (state.phase === "finished") return state;

  const player = state.players.find((p) => p.id === playerId);
  if (!player || player.bankrupt) return state;

  const landed = BOARD[player.position]!;
  const landedState: MatchState = {
    ...state,
    awaiting: isUnownedBuyable(state, landed.id) ? "buyOrSkip" : "buildOrEnd",
  };
  if (landedState.awaiting === "buyOrSkip" || player.inCage || !isBuyableSpace(landed)) {
    return landedState;
  }

  return chargeRentIfNeeded(landedState, player.id, landed, nowMs);
}

function chargeBank(state: MatchState, playerId: string, amount: number, nowMs: number): MatchState {
  const player = state.players.find((p) => p.id === playerId);
  if (!player || amount <= 0) return state;
  if (player.food >= amount) {
    return {
      ...state,
      players: state.players.map((p) => (p.id === player.id ? { ...p, food: p.food - amount } : p)),
    };
  }

  const players = state.players.map((p) =>
    p.id === player.id ? { ...p, food: 0, bankrupt: true, inCage: false, cageTurnsSkipped: 0 } : p,
  );
  const ownership = Object.fromEntries(Object.entries(state.ownership).filter(([, owned]) => owned.ownerId !== player.id));
  const winnerId = winnerFromPlayers(players);
  return {
    ...state,
    ownership,
    players,
    winnerId,
    phase: winnerId ? "finished" : state.phase,
    events: [...state.events, makeEvent(state, nowMs, `${player.nickname} 無法支付 ${amount} 份食物給銀行，破產。`)],
  };
}

function repairCost(state: MatchState, playerId: string, effect: Extract<CardEffect, { type: "repair" }>): number {
  return Object.values(state.ownership).reduce((total, owned) => {
    if (owned.ownerId !== playerId) return total;
    const houses = owned.buildings === 5 ? 0 : owned.buildings;
    const villas = owned.buildings === 5 ? 1 : 0;
    return total + houses * effect.perHouse + villas * effect.perVilla;
  }, 0);
}

function clampBoardIndex(index: number): number {
  return ((index % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE;
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

function addSystemEvent(state: MatchState, nowMs: number, message: string): MatchState {
  return {
    ...state,
    events: [...state.events, makeEvent(state, nowMs, message)],
  };
}
