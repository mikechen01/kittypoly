import { BOARD } from "./board.js";
import type { BuildingLevel, CatTreeSpace, TerritorySpace } from "./types.js";

const CAT_TREE_RENTS = [25, 50, 100, 200] as const;

export function rentDue(args: {
  space: TerritorySpace | CatTreeSpace;
  buildings: BuildingLevel;
  ownerCatTreeCount: number;
}): number {
  if (args.space.kind === "territory") {
    return args.space.rents[args.buildings];
  }

  const clampedCount = Math.min(4, Math.max(1, args.ownerCatTreeCount));
  return CAT_TREE_RENTS[clampedCount - 1];
}

export interface BuildableTerritory {
  id: string;
  name: string;
  buildings: BuildingLevel;
  houseCost: number;
  nextLabel: "貓屋" | "貓別墅";
}

/**
 * Party rule: you may upgrade the territory you are currently standing on,
 * if you own it. No full-color-set requirement.
 */
export function getBuildableTerritories(args: {
  playerId: string;
  food: number;
  position: number;
  ownership: Record<string, { ownerId: string; buildings: BuildingLevel }>;
}): BuildableTerritory[] {
  const space = BOARD[args.position];
  if (!space || space.kind !== "territory") return [];

  const owner = args.ownership[space.id];
  if (!owner || owner.ownerId !== args.playerId) return [];
  if (owner.buildings >= 5 || args.food < space.houseCost) return [];

  const nextBuildings = (owner.buildings + 1) as BuildingLevel;
  return [
    {
      id: space.id,
      name: space.name,
      buildings: owner.buildings,
      houseCost: space.houseCost,
      nextLabel: nextBuildings === 5 ? "貓別墅" : "貓屋",
    },
  ];
}
