import type { CatAvatarId, RoomPublic } from "@kittypoly/game";

export type ClientMessage =
  | { type: "createRoom"; nickname: string; avatar: CatAvatarId }
  | { type: "joinRoom"; code: string; nickname: string; avatar: CatAvatarId }
  | { type: "reconnect"; code: string; reconnectToken: string }
  | { type: "kick"; playerId: string }
  | { type: "setAvatar"; avatar: CatAvatarId }
  | { type: "startGame" }
  | {
      type: "intent";
      intent: "rollDice" | "buyTerritory" | "skipBuy" | "buildHouse" | "payCageFine" | "endTurn";
      spaceId?: string;
    };

export type ServerMessage =
  | { type: "welcome"; playerId: string; reconnectToken: string; room: RoomPublic }
  | { type: "snapshot"; room: RoomPublic }
  | { type: "error"; code: string; message: string };
