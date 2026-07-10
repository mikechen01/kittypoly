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
