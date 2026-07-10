import { describe, expect, it } from "vitest";
import { BOARD, BOARD_SIZE } from "./board.js";

describe("board", () => {
  it("has exactly 40 spaces", () => {
    expect(BOARD_SIZE).toBe(40);
    expect(BOARD).toHaveLength(40);
  });

  it("starts with go and includes cage + both card types + four cat trees", () => {
    expect(BOARD[0]?.kind).toBe("go");
    expect(BOARD.filter((s) => s.kind === "scratch").length).toBeGreaterThanOrEqual(2);
    expect(BOARD.filter((s) => s.kind === "teaser").length).toBeGreaterThanOrEqual(2);
    expect(BOARD.filter((s) => s.kind === "cage").length).toBe(1);
    expect(BOARD.filter((s) => s.kind === "goToCage").length).toBe(1);
    expect(BOARD.filter((s) => s.kind === "catTree")).toHaveLength(4);
    expect(BOARD.filter((s) => s.kind === "territory").length).toBeGreaterThanOrEqual(22);
  });
});
