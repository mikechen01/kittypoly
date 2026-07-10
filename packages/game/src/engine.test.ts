import { describe, expect, it } from "vitest";
import { createMatch, applyIntent } from "./engine.js";
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
});
