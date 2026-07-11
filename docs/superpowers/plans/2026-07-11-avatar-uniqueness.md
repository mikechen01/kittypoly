# Avatar Uniqueness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make room avatars unique — server auto-assigns on join/create; lobby picker disables taken cats.

**Architecture:** Server-authoritative uniqueness in `RoomManager` (`assignFreeAvatar`, `setAvatar` reject duplicates). Home drops avatar UI; Lobby gains picker. Protocol makes `avatar` optional on create/join (ignored if sent).

**Tech Stack:** TypeScript, Vitest, React (existing KittyPoly monorepo)

---

### Task 1: Export avatar list + RoomManager uniqueness

**Files:**
- Modify: `packages/game/src/types.ts`
- Modify: `apps/server/src/room-manager.ts`
- Modify: `apps/server/src/room-manager.test.ts`
- Modify: `apps/server/src/protocol.ts`
- Modify: `apps/server/src/index.ts`
- Modify: `apps/web/src/ws/client.ts`

- [ ] **Step 1: Failing tests** in `room-manager.test.ts` for auto-assign, duplicate reject, kick frees avatar, setAvatar blocked when playing
- [ ] **Step 2: Implement** `CAT_AVATARS`, `assignFreeAvatar`, update create/join/setAvatar; drop required avatar from create/join inputs
- [ ] **Step 3: Run** `cd apps/server && npx vitest run src/room-manager.test.ts` — expect PASS

### Task 2: Home + Lobby UI

**Files:**
- Modify: `apps/web/src/screens/Home.tsx` — remove avatar picker; create/join without avatar
- Modify: `apps/web/src/screens/Lobby.tsx` — avatar picker; disable taken
- Modify: `apps/web/src/App.tsx` — wire `onSetAvatar` → `setAvatar`

- [ ] **Step 1: Home** remove avatar UI and props
- [ ] **Step 2: Lobby** picker with taken disabled; call `onSetAvatar`
- [ ] **Step 3: App** pass handlers; update client message types

### Task 3: Verify

- [ ] Run server + game package tests
- [ ] Manual: create room, join second client, confirm different auto avatars; try selecting taken → disabled / error
