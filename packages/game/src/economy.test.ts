import { describe, expect, it } from "vitest";
import { BOARD } from "./board.js";
import { rentDue } from "./economy.js";

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
});
