import { describe, expect, it } from "vitest";
import { BOARD } from "./board.js";
import { getBuildableTerritories, rentDue } from "./economy.js";

describe("economy", () => {
  it("uses territory rent for the current building level", () => {
    const sunnyWindow = BOARD[1];
    if (sunnyWindow?.kind !== "territory") throw new Error("BOARD[1] must be a territory");

    expect(rentDue({ space: sunnyWindow, buildings: 3, ownerCatTreeCount: 1 })).toBe(90);
  });

  it("uses clamped cat tree count for rent", () => {
    const catTree = BOARD[5];
    if (catTree?.kind !== "catTree") throw new Error("BOARD[5] must be a cat tree");

    expect(rentDue({ space: catTree, buildings: 0, ownerCatTreeCount: 0 })).toBe(25);
    expect(rentDue({ space: catTree, buildings: 0, ownerCatTreeCount: 3 })).toBe(100);
    expect(rentDue({ space: catTree, buildings: 0, ownerCatTreeCount: 5 })).toBe(200);
  });

  it("lists only the owned territory the player is standing on", () => {
    const sunny = BOARD[1];
    if (sunny?.kind !== "territory") throw new Error("BOARD[1] must be a territory");

    const buildables = getBuildableTerritories({
      playerId: "p1",
      food: 1500,
      position: 1,
      ownership: { [sunny.id]: { ownerId: "p1", buildings: 0 } },
    });

    expect(buildables).toHaveLength(1);
    expect(buildables[0]?.id).toBe("sunny-window");

    expect(
      getBuildableTerritories({
        playerId: "p1",
        food: 1500,
        position: 0,
        ownership: { [sunny.id]: { ownerId: "p1", buildings: 0 } },
      }),
    ).toHaveLength(0);
  });
});
