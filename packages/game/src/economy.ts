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

/** Territories the player may legally upgrade by one level right now. */
export function getBuildableTerritories(args: {
  playerId: string;
  food: number;
  ownership: Record<string, { ownerId: string; buildings: BuildingLevel }>;
}): BuildableTerritory[] {
  const ownedTerritories = BOARD.filter(
    (space): space is TerritorySpace =>
      space.kind === "territory" && args.ownership[space.id]?.ownerId === args.playerId,
  );

  return ownedTerritories.flatMap((space) => {
    const owner = args.ownership[space.id];
    if (!owner || owner.buildings >= 5 || args.food < space.houseCost) return [];

    const groupSpaces = BOARD.filter(
      (candidate): candidate is TerritorySpace =>
        candidate.kind === "territory" && candidate.group === space.group,
    );
    const groupOwnership = groupSpaces.map((groupSpace) => args.ownership[groupSpace.id]);
    if (groupOwnership.some((owned) => owned?.ownerId !== args.playerId)) return [];

    const minBuildings = Math.min(...groupOwnership.map((owned) => owned?.buildings ?? 0));
    const nextBuildings = (owner.buildings + 1) as BuildingLevel;
    if (nextBuildings > minBuildings + 1) return [];

    return [
      {
        id: space.id,
        name: space.name,
        buildings: owner.buildings,
        houseCost: space.houseCost,
        nextLabel: nextBuildings === 5 ? "貓別墅" : "貓屋",
      },
    ];
  });
}
