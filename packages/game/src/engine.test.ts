import { describe, expect, it } from "vitest";
import { createMatch, applyIntent } from "./engine.js";
import type { CardDef } from "./cards.js";
import type { MatchState } from "./engine.js";

function twoPlayerMatch(): MatchState {
  return createMatch({
    playerIds: ["p1", "p2"],
    nicknames: { p1: "A", p2: "B" },
    avatars: { p1: "tabby", p2: "calico" },
    nowMs: 1_000,
    rng: () => 0.1,
  });
}

describe("GameEngine move", () => {
  it("pays GO salary when passing index 0", () => {
    let m = twoPlayerMatch();
    m = { ...m, players: m.players.map((p) => (p.id === "p1" ? { ...p, position: 38, food: 1500 } : p)) };
    const { state, error } = applyIntent(m, {
      type: "rollDice",
      playerId: "p1",
      nowMs: 1_001,
      dice: [1, 1],
    });
    expect(error).toBeUndefined();
    const p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.position).toBe(0);
    expect(p1.food).toBe(1700);
  });

  it("rejects roll from non-current player", () => {
    const m = twoPlayerMatch();
    const { error } = applyIntent(m, {
      type: "rollDice",
      playerId: "p2",
      nowMs: 1_001,
      dice: [2, 3],
    });
    expect(error).toBeDefined();
  });

  it("auto-rolls and skips buy when turn deadline passes", () => {
    let m = twoPlayerMatch();
    m = { ...m, players: m.players.map((p) => (p.id === "p1" ? { ...p, position: 39 } : p)) };

    const { state, error } = applyIntent(m, { type: "tick", nowMs: m.turnDeadlineMs! + 1 });

    expect(error).toBeUndefined();
    expect(state.events.some((e) => e.message.includes("系統代行"))).toBe(true);
    expect(state.players.find((p) => p.id === "p1")!.position).toBe(1);
    expect(state.ownership["sunny-window"]).toBeUndefined();
    expect(state.currentPlayerId).toBe("p2");
    expect(state.awaiting).toBe("roll");
  });

  it("buys unowned territory and charges rent to visitor", () => {
    let m = twoPlayerMatch();
    m = { ...m, players: m.players.map((p) => ({ ...p, position: 39 })) };

    let result = applyIntent(m, {
      type: "rollDice",
      playerId: "p1",
      nowMs: 1_001,
      dice: [1, 1],
    });
    expect(result.error).toBeUndefined();
    expect(result.state.awaiting).toBe("buyOrSkip");

    result = applyIntent(result.state, { type: "buyTerritory", playerId: "p1", nowMs: 1_002 });
    expect(result.error).toBeUndefined();
    expect(result.state.ownership["sunny-window"]).toEqual({ ownerId: "p1", buildings: 0 });
    expect(result.state.players.find((p) => p.id === "p1")!.food).toBe(1640);

    result = applyIntent(result.state, { type: "endTurn", playerId: "p1", nowMs: 1_003 });
    expect(result.error).toBeUndefined();
    expect(result.state.currentPlayerId).toBe("p2");

    result = applyIntent(result.state, {
      type: "rollDice",
      playerId: "p2",
      nowMs: 1_004,
      dice: [1, 1],
    });
    expect(result.error).toBeUndefined();
    expect(result.state.players.find((p) => p.id === "p1")!.food).toBe(1642);
    expect(result.state.players.find((p) => p.id === "p2")!.food).toBe(1698);
    expect(result.state.awaiting).toBe("end");
  });

  it("scales cat tree rent by the owner's cat tree count when landed on", () => {
    let m = twoPlayerMatch();
    m = {
      ...m,
      currentPlayerId: "p2",
      ownership: {
        "cat-tree-1": { ownerId: "p1", buildings: 0 },
        "cat-tree-2": { ownerId: "p1", buildings: 0 },
        "cat-tree-3": { ownerId: "p1", buildings: 0 },
      },
      players: m.players.map((p) =>
        p.id === "p2" ? { ...p, position: 22, food: 1500 } : { ...p, position: 0, food: 1500 },
      ),
    };

    const { state, error } = applyIntent(m, {
      type: "rollDice",
      playerId: "p2",
      nowMs: 1_001,
      dice: [1, 2],
    });

    expect(error).toBeUndefined();
    expect(state.players.find((p) => p.id === "p1")!.food).toBe(1600);
    expect(state.players.find((p) => p.id === "p2")!.food).toBe(1400);
  });

  it("allows one house only on a later visit to owned territory, not right after buying", () => {
    let m = twoPlayerMatch();
    m = { ...m, players: m.players.map((p) => ({ ...p, position: 39 })) };

    let result = applyIntent(m, {
      type: "rollDice",
      playerId: "p1",
      nowMs: 1_001,
      dice: [1, 1],
    });
    result = applyIntent(result.state, { type: "buyTerritory", playerId: "p1", nowMs: 1_002 });
    expect(result.state.awaiting).toBe("end");
    expect(
      applyIntent(result.state, {
        type: "buildHouse",
        playerId: "p1",
        spaceId: "sunny-window",
        nowMs: 1_003,
      }).error,
    ).toBeDefined();

    m = {
      ...result.state,
      awaiting: "roll",
      players: result.state.players.map((p) => (p.id === "p1" ? { ...p, position: 39 } : p)),
    };
    result = applyIntent(m, {
      type: "rollDice",
      playerId: "p1",
      nowMs: 1_006,
      dice: [1, 1],
    });
    expect(result.state.awaiting).toBe("buildOrEnd");

    result = applyIntent(result.state, {
      type: "buildHouse",
      playerId: "p1",
      spaceId: "sunny-window",
      nowMs: 1_007,
    });
    expect(result.error).toBeUndefined();
    expect(result.state.ownership["sunny-window"]!.buildings).toBe(1);
    expect(result.state.awaiting).toBe("end");
    expect(
      applyIntent(result.state, {
        type: "buildHouse",
        playerId: "p1",
        spaceId: "sunny-window",
        nowMs: 1_008,
      }).error,
    ).toBeDefined();
  });

  it("builds on the owned territory the player is standing on", () => {
    let m = twoPlayerMatch();
    m = {
      ...m,
      awaiting: "buildOrEnd",
      ownership: { "sunny-window": { ownerId: "p1", buildings: 0 } },
      players: m.players.map((p) => (p.id === "p1" ? { ...p, position: 1, food: 500 } : p)),
    };

    let result = applyIntent(m, {
      type: "buildHouse",
      playerId: "p1",
      spaceId: "cardboard-castle",
      nowMs: 1_001,
    });
    expect(result.error).toBeDefined();

    result = applyIntent(m, {
      type: "buildHouse",
      playerId: "p1",
      spaceId: "sunny-window",
      nowMs: 1_002,
    });
    expect(result.error).toBeUndefined();
    expect(result.state.ownership["sunny-window"]!.buildings).toBe(1);
    expect(result.state.players.find((p) => p.id === "p1")!.food).toBe(450);
    expect(result.state.awaiting).toBe("end");
  });

  it("sends a player to cage without GO salary when landing on go to cage", () => {
    let m = twoPlayerMatch();
    m = { ...m, players: m.players.map((p) => (p.id === "p1" ? { ...p, position: 28, food: 1500 } : p)) };

    const { state, error } = applyIntent(m, {
      type: "rollDice",
      playerId: "p1",
      nowMs: 1_001,
      dice: [1, 1],
    });

    expect(error).toBeUndefined();
    const p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.position).toBe(10);
    expect(p1.inCage).toBe(true);
    expect(p1.food).toBe(1500);
    expect(state.awaiting).toBe("end");
  });

  it("leaves cage with doubles or by paying the fine before rolling", () => {
    let m = twoPlayerMatch();
    m = {
      ...m,
      players: m.players.map((p) =>
        p.id === "p1" ? { ...p, position: 10, inCage: true, cageTurnsSkipped: 0, food: 1500 } : p,
      ),
    };

    let result = applyIntent(m, {
      type: "rollDice",
      playerId: "p1",
      nowMs: 1_001,
      dice: [2, 2],
    });
    expect(result.error).toBeUndefined();
    expect(result.state.players.find((p) => p.id === "p1")!).toMatchObject({
      position: 14,
      inCage: false,
      cageTurnsSkipped: 0,
    });

    m = {
      ...m,
      players: m.players.map((p) =>
        p.id === "p1" ? { ...p, position: 10, inCage: true, cageTurnsSkipped: 1, food: 1500 } : p,
      ),
    };
    result = applyIntent(m, { type: "payCageFine", playerId: "p1", nowMs: 1_002 });
    expect(result.error).toBeUndefined();
    expect(result.state.awaiting).toBe("roll");
    expect(result.state.players.find((p) => p.id === "p1")!).toMatchObject({
      position: 10,
      inCage: false,
      cageTurnsSkipped: 0,
      food: 1450,
    });
  });

  it("auto-pays cage fine and leaves after a third failed non-doubles roll", () => {
    let m = twoPlayerMatch();
    m = {
      ...m,
      players: m.players.map((p) =>
        p.id === "p1" ? { ...p, position: 10, inCage: true, cageTurnsSkipped: 2, food: 1500 } : p,
      ),
    };

    const { state, error } = applyIntent(m, {
      type: "rollDice",
      playerId: "p1",
      nowMs: 1_001,
      dice: [1, 2],
    });

    expect(error).toBeUndefined();
    expect(state.players.find((p) => p.id === "p1")!).toMatchObject({
      position: 13,
      inCage: false,
      cageTurnsSkipped: 0,
      food: 1450,
    });
  });

  it("bankrupts player who cannot pay rent and awards victory to last survivor", () => {
    let m = twoPlayerMatch();
    m = {
      ...m,
      currentPlayerId: "p2",
      ownership: { "sunny-window": { ownerId: "p1", buildings: 5 } },
      players: m.players.map((p) =>
        p.id === "p2" ? { ...p, position: 39, food: 1 } : { ...p, position: 0, food: 1500 },
      ),
    };

    const { state, error } = applyIntent(m, {
      type: "rollDice",
      playerId: "p2",
      nowMs: 1_001,
      dice: [1, 1],
    });

    expect(error).toBeUndefined();
    expect(state.players.find((p) => p.id === "p1")!.food).toBe(1701);
    expect(state.players.find((p) => p.id === "p2")!.food).toBe(0);
    expect(state.players.find((p) => p.id === "p2")!.bankrupt).toBe(true);
    expect(state.ownership["sunny-window"]).toEqual({ ownerId: "p1", buildings: 5 });
    expect(state.winnerId).toBe("p1");
    expect(state.phase).toBe("finished");

    const blocked = applyIntent(state, {
      type: "rollDice",
      playerId: "p1",
      nowMs: 1_002,
      dice: [1, 1],
    });
    expect(blocked.error).toBeDefined();
    expect(blocked.state.phase).toBe("finished");
  });

  it("draws a scratch card, advances the deck, and applies gain food", () => {
    const gainCard: CardDef = {
      id: "test-gain-food",
      deck: "scratch",
      text: "在貓抓板底下翻到一包小魚乾。",
      effect: { type: "gainFood", amount: 25 },
    };
    const nextCard: CardDef = {
      id: "test-lose-food",
      deck: "scratch",
      text: "抓壞沙發，被扣零食。",
      effect: { type: "loseFood", amount: 10 },
    };
    let m = twoPlayerMatch();
    m = {
      ...m,
      decks: { ...m.decks, scratch: [nextCard, gainCard], scratchIndex: 1 },
    };

    const { state, error } = applyIntent(m, {
      type: "rollDice",
      playerId: "p1",
      nowMs: 1_001,
      dice: [1, 1],
    });

    expect(error).toBeUndefined();
    expect(state.decks.scratchIndex).toBe(0);
    expect(state.players.find((p) => p.id === "p1")!.food).toBe(1525);
    expect(state.events.at(-1)?.message).toContain("抽到貓抓板");
    expect(state.events.at(-1)?.message).toContain(gainCard.text);
    expect(state.events.at(-1)?.message).toContain(state.players.find((p) => p.id === "p1")!.nickname);
  });

  it("draws a teaser go-to-cage card and sends the player to cage", () => {
    const cageCard: CardDef = {
      id: "test-go-to-cage",
      deck: "teaser",
      text: "追逗貓棒追到鑽進貓籠。",
      effect: { type: "goToCage" },
    };
    let m = twoPlayerMatch();
    m = {
      ...m,
      players: m.players.map((p) => (p.id === "p1" ? { ...p, position: 5 } : p)),
      decks: { ...m.decks, teaser: [cageCard], teaserIndex: 0 },
    };

    const { state, error } = applyIntent(m, {
      type: "rollDice",
      playerId: "p1",
      nowMs: 1_001,
      dice: [1, 1],
    });

    expect(error).toBeUndefined();
    expect(state.decks.teaserIndex).toBe(0);
    expect(state.players.find((p) => p.id === "p1")!).toMatchObject({
      position: 10,
      inCage: true,
    });
    expect(state.events.at(-1)?.message).toContain(cageCard.text);
  });

  it("charges repair cards with buildings 1-4 as houses and 5 as a villa", () => {
    const repairCard: CardDef = {
      id: "test-repair",
      deck: "teaser",
      text: "檢修所有貓屋與貓別墅。",
      effect: { type: "repair", perHouse: 10, perVilla: 100 },
    };
    let m = twoPlayerMatch();
    m = {
      ...m,
      ownership: {
        "sunny-window": { ownerId: "p1", buildings: 5 },
        "cardboard-castle": { ownerId: "p1", buildings: 2 },
      },
      players: m.players.map((p) => (p.id === "p1" ? { ...p, position: 5 } : p)),
      decks: { ...m.decks, teaser: [repairCard], teaserIndex: 0 },
    };

    const { state, error } = applyIntent(m, {
      type: "rollDice",
      playerId: "p1",
      nowMs: 1_001,
      dice: [1, 1],
    });

    expect(error).toBeUndefined();
    expect(state.players.find((p) => p.id === "p1")!.food).toBe(1380);
  });
});
