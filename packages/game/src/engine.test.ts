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
});
