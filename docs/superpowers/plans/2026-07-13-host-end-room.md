# Host End Room Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 房主可在 lobby／playing／finished 確認後解散房間，全員收到 `roomEnded` 並回 Home。

**Architecture:** `RoomManager.endRoom` 驗證 host 後刪房；WS 層對該房 sockets 廣播 `{ type: "roomEnded", reason: "hostEnded" }` 並清 session。Web 三畫面加確認＋解散按鈕；`App` 處理 `roomEnded`。

**Tech Stack:** TypeScript、Vitest、既有 WS protocol、React screens

**Spec:** `docs/superpowers/specs/2026-07-13-host-end-room-design.md`

---

### Task 1: RoomManager.endRoom + protocol

**Files:**
- Modify: `apps/server/src/protocol.ts`
- Modify: `apps/server/src/room-manager.ts`
- Modify: `apps/server/src/room-manager.test.ts`
- Modify: `apps/server/src/index.ts`
- Modify: `apps/web/src/ws/client.ts`

- [x] 失敗測試：host endRoom 刪房；非 host 丟錯；lobby/playing 皆可
- [x] 實作 `endRoom`、協議型別、`index` 廣播 `roomEnded` 並清 sessions
- [x] 測試通過

### Task 2: Web UI + App 處理

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/screens/Lobby.tsx`
- Modify: `apps/web/src/screens/Match.tsx`
- Modify: `apps/web/src/screens/Results.tsx`

- [x] `roomEnded` → clearSession、回 Home、提示
- [x] 三畫面僅 host 顯示「解散房間」+ `confirm`
- [x] `handleMessage` 勿假設所有訊息都有 `room`

### Task 3: 驗收

- [x] `pnpm --filter @kittypoly/server test`（12 passed）
- [x] `pnpm --filter @kittypoly/web` typecheck（`tsc -b`）
