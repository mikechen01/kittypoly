export type SpaceKind =
  | "go"
  | "territory"
  | "catTree"
  | "scratch"
  | "teaser"
  | "cage"
  | "goToCage"
  | "rest";

export type ColorGroup =
  | "brown"
  | "lightBlue"
  | "pink"
  | "orange"
  | "red"
  | "yellow"
  | "green"
  | "darkBlue";

export interface TerritorySpace {
  kind: "territory";
  id: string;
  name: string;
  index: number;
  group: ColorGroup;
  price: number;
  rents: [number, number, number, number, number, number]; // bare..villa
  houseCost: number;
}

export interface CatTreeSpace {
  kind: "catTree";
  id: string;
  name: string;
  index: number;
  price: number;
}

export interface SimpleSpace {
  kind: "go" | "scratch" | "teaser" | "cage" | "goToCage" | "rest";
  id: string;
  name: string;
  index: number;
}

export type BoardSpace = TerritorySpace | CatTreeSpace | SimpleSpace;

export type CatAvatarId = "tabby" | "calico" | "black" | "white";

export interface PlayerPublic {
  id: string;
  nickname: string;
  avatar: CatAvatarId;
  food: number;
  position: number;
  inCage: boolean;
  cageTurnsSkipped: number;
  bankrupt: boolean;
  connected: boolean;
}

export type BuildingLevel = 0 | 1 | 2 | 3 | 4 | 5; // 5 = 貓別墅

export interface MatchPublic {
  phase: "lobby" | "playing" | "finished";
  boardId: "standard40";
  currentPlayerId: string | null;
  turnDeadlineMs: number | null;
  awaiting: "roll" | "buyOrSkip" | "buildOrEnd" | "end";
  ownership: Record<string, { ownerId: string; buildings: BuildingLevel }>;
  lastDice: [number, number] | null;
  winnerId: string | null;
  events: GameEvent[];
}

export interface GameEvent {
  id: string;
  at: number;
  message: string;
}

export interface RoomPublic {
  code: string;
  hostId: string;
  players: PlayerPublic[];
  match: MatchPublic;
}
