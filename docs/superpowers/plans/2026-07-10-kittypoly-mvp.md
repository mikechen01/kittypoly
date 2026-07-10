# KittyPoly MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a playable browser KittyPoly party game: room codes, 2–4 players, authoritative turn-based rules (territories, cat trees, buildings, cage, two card decks), turn timer auto-play, reconnect, comic-line-art UI.

**Architecture:** pnpm monorepo with `packages/game` (pure GameEngine + board/cards, Vitest), `apps/server` (RoomManager + `ws` WebSocket, full-snapshot sync), `apps/web` (Vite React UI). Client sends intents only; server owns dice, 貓糧, and bankruptcy.

**Tech Stack:** TypeScript, pnpm workspaces, Vitest, Node `ws`, Vite, React 19, CSS modules (comic line-art tokens).

**Locked tuning (MVP defaults):**
- `STARTING_FOOD = 1500`
- `GO_SALARY = 200`
- `TURN_TIMER_MS = 45_000`
- `RECONNECT_GRACE_MS = 120_000`
- Room code: 6 chars `A-Z0-9` excluding ambiguous `O0I1`

**Spec:** `docs/superpowers/specs/2026-07-10-kittypoly-design.md`  
**Glossary:** `CONTEXT.md`  
**ADR:** `docs/adr/0001-react-node-websocket-authoritative.md`

---

## File structure

```
kittypoly/
├── package.json                 # pnpm workspaces root
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── packages/
│   └── game/                    # Pure rules — no I/O
│       ├── package.json
│       ├── tsconfig.json
│       ├── vitest.config.ts
│       └── src/
│           ├── index.ts
│           ├── types.ts           # Shared domain types
│           ├── board.ts           # 40-space static config
│           ├── cards.ts           # 貓抓板 / 逗貓棒 decks
│           ├── economy.ts         # rent / build cost helpers
│           ├── engine.ts          # GameEngine applyIntent / tick
│           └── engine.test.ts
├── apps/
│   ├── server/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts           # HTTP health + WS upgrade
│   │   │   ├── protocol.ts        # Client/server message types
│   │   │   ├── room-manager.ts
│   │   │   ├── room-manager.test.ts
│   │   │   └── session.ts         # reconnect tokens
│   │   └── vitest.config.ts
│   └── web/
│       ├── package.json
│       ├── vite.config.ts
│       ├── index.html
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── styles/tokens.css  # comic line-art
│           ├── ws/client.ts
│           ├── state/session.ts   # localStorage reconnect
│           └── screens/
│               ├── Home.tsx
│               ├── Lobby.tsx
│               ├── Match.tsx
│               └── Results.tsx
```

---

### Task 1: Monorepo scaffold

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`
- Create: `packages/game/package.json`, `packages/game/tsconfig.json`, `packages/game/vitest.config.ts`, `packages/game/src/index.ts`
- Create: `apps/server/package.json`, `apps/server/tsconfig.json`
- Create: `apps/web/package.json`, `apps/web/vite.config.ts`, `apps/web/index.html`, `apps/web/src/main.tsx`

- [ ] **Step 1: Root workspace files**

`package.json`:
```json
{
  "name": "kittypoly",
  "private": true,
  "scripts": {
    "test": "pnpm -r test",
    "dev:server": "pnpm --filter @kittypoly/server dev",
    "dev:web": "pnpm --filter @kittypoly/web dev",
    "build": "pnpm -r build"
  },
  "engines": { "node": ">=20" }
}
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - "packages/*"
  - "apps/*"
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "declaration": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 2: `packages/game` package**

`packages/game/package.json`:
```json
{
  "name": "@kittypoly/game",
  "version": "0.0.1",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" } },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "typescript": "^5.8.0",
    "vitest": "^3.0.0"
  }
}
```

`packages/game/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

`packages/game/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node" } });
```

`packages/game/src/index.ts`:
```ts
export {};
```

- [ ] **Step 3: Stub server + web packages**

`apps/server/package.json`:
```json
{
  "name": "@kittypoly/server",
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@kittypoly/game": "workspace:*",
    "ws": "^8.18.0"
  },
  "devDependencies": {
    "@types/ws": "^8.5.0",
    "tsx": "^4.19.0",
    "typescript": "^5.8.0",
    "vitest": "^3.0.0"
  }
}
```

`apps/web/package.json`:
```json
{
  "name": "@kittypoly/web",
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@kittypoly/game": "workspace:*",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.8.0",
    "vite": "^6.0.0"
  }
}
```

Minimal `apps/web/index.html` + `apps/web/src/main.tsx` that renders `<div>KittyPoly</div>`.  
Minimal `apps/server/src/index.ts`: `console.log("server stub")`.

- [ ] **Step 4: Install and verify**

Run: `pnpm install` from repo root  
Run: `pnpm --filter @kittypoly/game test`  
Expected: Vitest runs with 0 tests (or pass empty) — if Vitest errors on no tests, add `passWithNoTests: true` in vitest config.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json packages apps pnpm-lock.yaml
git commit -m "chore: scaffold pnpm monorepo for KittyPoly"
```

---

### Task 2: Domain types + board config

**Files:**
- Create: `packages/game/src/types.ts`, `packages/game/src/board.ts`
- Modify: `packages/game/src/index.ts`
- Test: `packages/game/src/board.test.ts`

- [ ] **Step 1: Write failing board test**

```ts
// packages/game/src/board.test.ts
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
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `pnpm --filter @kittypoly/game test`  
Expected: FAIL — cannot find module `./board.js`

- [ ] **Step 3: Implement types + board**

`packages/game/src/types.ts` (core shapes):
```ts
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
  ownership: Record<string, { ownerId: string; buildings: BuildingLevel }>;
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
```

`packages/game/src/board.ts`: export `BOARD_SIZE = 40` and `BOARD: BoardSpace[]` laid out like classic Monopoly positions:
- index 0 `go`
- territories in 8 color groups (2+3+3+3+3+3+3+2 pattern)
- cat trees at indices 5, 15, 25, 35
- scratch/teaser alternating like chance/chest
- cage at 10, goToCage at 30, rest at 20

Use cat-themed names (e.g. 「陽光窗台」「紙箱城堡」). Prices roughly classic-scaled (60–400). Keep rents aggressive enough for party pace (higher end rents).

- [ ] **Step 4: Run test — expect PASS**

Run: `pnpm --filter @kittypoly/game test`  
Expected: PASS

- [ ] **Step 5: Export from index and commit**

```ts
export * from "./types.js";
export * from "./board.js";
```

```bash
git add packages/game
git commit -m "feat(game): add board config and domain types"
```

---

### Task 3: Economy helpers + GameEngine skeleton (create match, roll, move, GO)

**Files:**
- Create: `packages/game/src/economy.ts`, `packages/game/src/engine.ts`
- Modify: `packages/game/src/engine.test.ts` (new), `packages/game/src/index.ts`

- [ ] **Step 1: Failing tests for create + roll past GO**

```ts
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
      dice: [1, 1], // forced dice for tests
    });
    expect(error).toBeUndefined();
    const p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.position).toBe(0);
    expect(p1.food).toBe(1700);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm --filter @kittypoly/game exec vitest run src/engine.test.ts`  
Expected: FAIL — module not found

- [ ] **Step 3: Implement engine skeleton**

Constants in `engine.ts`:
```ts
export const STARTING_FOOD = 1500;
export const GO_SALARY = 200;
export const TURN_TIMER_MS = 45_000;
```

`MatchState` holds players, ownership, decks (empty for now), `currentPlayerId`, `turnDeadlineMs`, `awaiting` (`"roll" | "buyOrSkip" | "buildOrEnd" | "end"`), `lastDice`, events, `winnerId`, `rng`.

`createMatch(...)`: set all players at 0 with `STARTING_FOOD`, phase playing, current = first id, deadline = now + TURN_TIMER_MS, awaiting `"roll"`.

`applyIntent` for `rollDice`:
- Reject if wrong player / wrong awaiting / bankrupt
- Use `dice` if provided (tests only); else `rng` → two ints 1–6
- Move with wrap; if pass or land on 0 from non-zero start of move path, add `GO_SALARY` (standard: salary on pass/land GO except when starting turn on GO without passing — implement classic “collect when landing on or passing GO”)
- After move, set `awaiting` based on tile (Task 4+); for unowned territory → `buyOrSkip`; for now if unknown → `end`

Include `toPublic(state)` later used by server — can stub in Task 6.

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(game): engine createMatch and roll past GO"
```

---

### Task 4: Buy territory, rent, bankruptcy, victory

**Files:**
- Modify: `packages/game/src/engine.ts`, `packages/game/src/economy.ts`, `packages/game/src/engine.test.ts`

- [ ] **Step 1: Failing tests**

```ts
describe("economy", () => {
  it("buys unowned territory and charges rent to visitor", () => {
    let m = twoPlayerMatch();
    // put p1 on a known territory index (e.g. 1), awaiting buyOrSkip
    // apply buyTerritory → ownership[p1], food decreased
    // move p2 onto same tile → p2 food decreases, p1 increases
  });

  it("bankrupts player who cannot pay and awards victory to last survivor", () => {
    // p2 food 10, rent 100 → p2 bankrupt, if only p1 left → winnerId p1
  });
});
```

Fill exact assertions using real `BOARD[1]` price/rent from board.ts.

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement**

`economy.ts`:
```ts
export function rentDue(args: {
  space: TerritorySpace | CatTreeSpace;
  buildings: BuildingLevel;
  ownerCatTreeCount: number;
}): number
```
- Territory: `space.rents[buildings]`
- Cat tree: `[25,50,100,200][ownerCatTreeCount-1]`

Intents: `buyTerritory` | `skipBuy` | `endTurn`  
Payment helper: transfer food; if payer cannot pay full amount → set bankrupt, transfer remaining food + all their properties to creditor (or bank if card — for rent use creditor). Clear ownership of bankrupt. If one non-bankrupt remains → `winnerId`, phase conceptually finished (`winnerId != null`).

- [ ] **Step 4: PASS + commit**

```bash
git commit -am "feat(game): buy, rent, bankruptcy, and victory"
```

---

### Task 5: Cat trees, buildings (貓屋／貓別墅), 貓籠

**Files:**
- Modify: `packages/game/src/engine.ts`, `packages/game/src/engine.test.ts`

- [ ] **Step 1: Failing tests**

1. Landing on owned cat tree pays scaled rent by owner’s tree count.  
2. `buildHouse` only if player owns **entire color group**, even building levels across group, cost `houseCost`; level 5 = villa.  
3. `goToCage` sets `inCage`, position = cage index; leave with doubles **or** pay 50 **or** after 3 turns forced pay 50 (classic-simplified: 3 turns then auto-pay 50 if still in).

- [ ] **Step 2–4: TDD implement + PASS**

Cage turn flow: if `inCage` and awaiting roll → intent `rollDice` checks doubles to leave; intents `payCageFine` (50). Auto-leave rules in `tickTurnTimer` later.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(game): cat trees, buildings, and cage"
```

---

### Task 6: Card decks (貓抓板／逗貓棒)

**Files:**
- Create: `packages/game/src/cards.ts`
- Modify: `packages/game/src/engine.ts`, tests

- [ ] **Step 1: Failing test — draw advances deck and applies effect**

Define card effects as discriminated unions:
```ts
type CardEffect =
  | { type: "gainFood"; amount: number }
  | { type: "loseFood"; amount: number }
  | { type: "moveTo"; index: number; collectGo: boolean }
  | { type: "moveRelative"; steps: number }
  | { type: "goToCage" }
  | { type: "repair"; perHouse: number; perVilla: number };
```

Minimum MVP decks: **8 scratch + 8 teaser** cards (enough variety). Shuffle in `createMatch` via `rng`.

Landing on scratch/teaser → draw → apply → then `buyOrSkip`/`end` as appropriate.

- [ ] **Step 2–4: Implement + PASS**

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(game): scratch and teaser card decks"
```

---

### Task 7: Turn timer auto-play (`tick`)

**Files:**
- Modify: `packages/game/src/engine.ts`, `packages/game/src/engine.test.ts`

- [ ] **Step 1: Failing test**

```ts
it("auto-rolls and skips buy when turn deadline passes", () => {
  let m = twoPlayerMatch();
  const { state } = applyIntent(m, { type: "tick", nowMs: m.turnDeadlineMs! + 1 });
  expect(state.events.some((e) => e.message.includes("系統代行"))).toBe(true);
  expect(state.currentPlayerId).not.toBe("p1"); // advanced after auto skip buy + end
});
```

- [ ] **Step 2–4: Implement `tick`**

While `nowMs >= turnDeadlineMs` and no winner:
- If awaiting `roll` → forced dice via rng, resolve tile  
- If awaiting `buyOrSkip` → skip buy  
- If awaiting `buildOrEnd` → end turn  
- If awaiting `end` → end turn  
Log each auto action. Reset deadline for next player.

Export `applyIntent(state, intent)` handling `tick`.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(game): turn timer auto-play tick"
```

---

### Task 8: RoomManager + reconnect tokens

**Files:**
- Create: `apps/server/src/session.ts`, `apps/server/src/room-manager.ts`, `apps/server/src/room-manager.test.ts`, `apps/server/vitest.config.ts`

- [ ] **Step 1: Failing tests**

```ts
it("creates room with host and join code", () => {
  const rm = new RoomManager(() => 0.5);
  const { room, playerId, reconnectToken } = rm.createRoom({ nickname: "Host", avatar: "tabby", nowMs: 1 });
  expect(room.code).toHaveLength(6);
  expect(room.hostId).toBe(playerId);
  expect(reconnectToken).toBeTruthy();
});

it("reconnect restores same seat", () => {
  const rm = new RoomManager(() => 0.5);
  const created = rm.createRoom({ nickname: "Host", avatar: "tabby", nowMs: 1 });
  rm.disconnect(created.room.code, created.playerId, 2);
  const again = rm.reconnect({
    code: created.room.code,
    reconnectToken: created.reconnectToken,
    nowMs: 3,
  });
  expect(again.playerId).toBe(created.playerId);
});
```

- [ ] **Step 2–4: Implement**

`RoomManager` methods: `createRoom`, `joinRoom`, `kick` (lobby only, host only), `setAvatar`, `startGame` (≥2, ≤4), `disconnect`, `reconnect`, `handleIntent`, `tickRoom`.  
Internal map `code → { seats, matchState | null, tokens: Map<playerId, token> }`.  
On `startGame`, call `createMatch`.  
`handleIntent` maps WS intents into `applyIntent` with server `nowMs` / rng (ignore client dice in production path — only allow forced dice when `process.env.NODE_ENV === 'test'`).

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(server): room manager with reconnect"
```

---

### Task 9: WebSocket server + protocol

**Files:**
- Create: `apps/server/src/protocol.ts`, `apps/server/src/index.ts` (replace stub)

- [ ] **Step 1: Define protocol**

```ts
export type ClientMessage =
  | { type: "createRoom"; nickname: string; avatar: CatAvatarId }
  | { type: "joinRoom"; code: string; nickname: string; avatar: CatAvatarId }
  | { type: "reconnect"; code: string; reconnectToken: string }
  | { type: "kick"; playerId: string }
  | { type: "setAvatar"; avatar: CatAvatarId }
  | { type: "startGame" }
  | { type: "intent"; intent: "rollDice" | "buyTerritory" | "skipBuy" | "buildHouse" | "payCageFine" | "endTurn" };

export type ServerMessage =
  | { type: "welcome"; playerId: string; reconnectToken: string; room: RoomPublic }
  | { type: "snapshot"; room: RoomPublic }
  | { type: "error"; code: string; message: string };
```

Add `toPublicRoom(...)` in game or server that strips decks/rng.

- [ ] **Step 2: Implement WS server**

- Listen `process.env.PORT ?? 8787`  
- On connection, parse JSON messages, call RoomManager, broadcast `snapshot` to all sockets in room  
- Interval 1s: `tick` all playing rooms, broadcast if changed  
- Health: `GET /health` → `ok` (use `http.createServer` + `ws` upgrade)

- [ ] **Step 3: Manual smoke**

Run: `pnpm --filter @kittypoly/server dev`  
Expected: server starts; `/health` returns ok

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(server): websocket protocol and snapshot sync"
```

---

### Task 10: Web client session + Home / Lobby

**Files:**
- Create: `apps/web/src/ws/client.ts`, `apps/web/src/state/session.ts`, `apps/web/src/screens/Home.tsx`, `apps/web/src/screens/Lobby.tsx`, `apps/web/src/App.tsx`, `apps/web/src/styles/tokens.css`

- [ ] **Step 1: tokens.css (comic line-art)**

```css
:root {
  --ink: #1a1a1a;
  --paper: #fffdf7;
  --accent: #ff6b35;
  --accent-2: #ffd166;
  --ok: #06d6a0;
  --info: #118ab2;
  --border: 2px solid var(--ink);
  font-family: "Segoe UI", system-ui, sans-serif;
}
button {
  border: var(--border);
  background: var(--accent-2);
  color: var(--ink);
  font-weight: 800;
  padding: 0.6rem 1rem;
  cursor: pointer;
}
```

- [ ] **Step 2: WS client + session**

`session.ts`: save/load `{ code, reconnectToken, playerId }` in `localStorage` key `kittypoly.session`.  
`client.ts`: connect to `import.meta.env.VITE_WS_URL ?? "ws://localhost:8787"`, send/receive typed messages, expose React-friendly subscribe callback.

- [ ] **Step 3: Home + Lobby UI**

Home: nickname input, avatar select (4 cats), Create / Join code.  
Lobby: show room code (large), player list, host Start / Kick, non-host wait. On `match.phase === "playing"` navigate to Match.

- [ ] **Step 4: Wire App**

`App.tsx` switches Home | Lobby | Match | Results from room snapshot.

- [ ] **Step 5: Manual check + commit**

Run server + `pnpm --filter @kittypoly/web dev` — create room, join second browser profile.  
```bash
git commit -am "feat(web): home and lobby with websocket session"
```

---

### Task 11: Match UI + Results

**Files:**
- Create: `apps/web/src/screens/Match.tsx`, `apps/web/src/screens/Results.tsx`, `apps/web/src/components/Board.tsx`, `apps/web/src/components/EventLog.tsx`, `apps/web/src/components/ActionPanel.tsx`

- [ ] **Step 1: Board component**

Render 40 cells in a CSS grid ring (comic borders). Highlight current player token. Mobile: scroll/zoom container; ActionPanel sticky bottom.

- [ ] **Step 2: ActionPanel**

Based on whether `playerId === currentPlayerId` and awaiting (derive from snapshot events or add `awaiting` to `MatchPublic` — **add `awaiting` to public match state in Task 3/9 if missing**):
- Show Roll / Buy / Skip / Build / Pay fine / End turn  
- Show turn countdown from `turnDeadlineMs - Date.now()`

- [ ] **Step 3: EventLog + Results**

EventLog: last 30 messages.  
Results: when `winnerId` set, show winner nickname + button clear session → Home.

- [ ] **Step 4: Manual 2-player playthrough**

Buy, rent, card, cage path smoke-tested once.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(web): match board, actions, and results"
```

---

### Post-MVP playtest UX (recorded 2026-07-10)

Shipped after Task 11; see design spec **Match layout** / **Buy / build**:

- Self card top-right; other players under it (not full-width under the board).  
- Personal event feed (nickname filter) instead of a global EventLog on Match; card draws include nickname + deck label.  
- Income/expense amount coloring on the self-card feed.  
- Buy on first visit only; build one level on a later visit to owned territory.  
- Show dice + Chinese space names; build via territory dropdown.

---

### Task 12: README + run scripts polish

**Files:**
- Create: `README.md`
- Modify: root `package.json` scripts if needed

- [ ] **Step 1: Write README**

Include: what KittyPoly is, `pnpm install`, `pnpm dev:server`, `pnpm dev:web`, how to open two browsers, link to CONTEXT + spec, MVP non-goals.

- [ ] **Step 2: Commit**

```bash
git commit -am "docs: add README with local run instructions"
```

---

## Spec coverage checklist

| Spec item | Task |
|-----------|------|
| Room create/join + code | 8–10 |
| 2–4 players, host start/kick | 8–10 |
| Cosmetic avatars | 2, 10 |
| 40 board, territories, cat trees | 2, 4–5 |
| 貓屋／貓別墅 | 5 |
| 貓籠 | 5 |
| 貓抓板／逗貓棒 | 6 |
| 貓糧 economy / bankruptcy / victory | 4 |
| Turn timer auto-play | 7, 9 |
| Reconnect | 8–10 |
| Authoritative WS snapshots | 9 |
| Comic UI | 10–11 |
| GameEngine unit tests | 3–7 |
| No chat/trade/mortgage/accounts | honored (not built) |

## Self-review notes

- No TBD steps; tuning constants locked at top.  
- `awaiting` must appear on `MatchPublic` for UI (Tasks 3 + 9 + 11 aligned).  
- Production path must ignore client-supplied `dice`; tests pass `dice` only via engine API used by unit tests, not WS.  
- Commit messages use Conventional Commits (`feat:`, `chore:`, `docs:`) for this repo’s hook.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-10-kittypoly-mvp.md`. Two execution options:

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration  

**2. Inline Execution** — execute tasks in this session using executing-plans, batch with checkpoints  

Which approach?
