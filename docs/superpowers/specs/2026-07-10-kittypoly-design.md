# KittyPoly Design Spec

**Date:** 2026-07-10  
**Status:** Draft for user review  
**Related:** [CONTEXT.md](../../../CONTEXT.md), [ADR 0001](../../adr/0001-react-node-websocket-authoritative.md)

## Goal

Build **KittyPoly** — a cat-themed, Monopoly-inspired **party game** playable in the browser. Friends create a **room**, share a **room code**, and play remotely (2–4 players) until one **victory** by last survivor (others **bankrupt**). Cute theme and teachable rules beat competitive depth.

## Product decisions (locked)

| Topic | Decision |
|-------|----------|
| Audience | Casual party among friends |
| Gathering | Remote, own devices, room code |
| Platform | Browser (mobile + desktop) |
| Rules fidelity | Themed variant, not official Monopoly |
| Win condition | Last non-bankrupt player |
| Players per room | 2–4 |
| Cat characters | Cosmetic avatars only |
| Event decks | Two decks: **貓抓板** (movement/drama), **逗貓棒** (money/small effects) |
| Currency | **貓糧** |
| MVP systems | Core loop + build **貓屋／貓別墅** + **貓籠** + **貓爬架** set |
| Out of MVP | Trading, mortgage, auction, utilities-like second set, tax spaces, accounts, in-game chat, mid-game host powers |
| Board | Classic **40** spaces; pace via economy numbers, not smaller board |
| Identity | Nickname only (no registration) |
| Host | Create room, start game, kick before start only |
| AFK | Turn timer → server auto-acts required steps, skips optional |
| Disconnect | Reconnect to same seat; timer still runs |
| Visual | Comic line-art (bold outlines, saturated blocks) |
| Architecture | Vite/React + Node WebSocket authoritative server (ADR 0001) |

Domain language lives in `CONTEXT.md` and is authoritative for naming.

## Architecture

```
apps/web (React/Vite)  ←WebSocket→  apps/server (Node)
                                      ├─ RoomManager
                                      ├─ GameEngine
                                      └─ in-memory RoomState (MVP)
```

- Client sends **intents** only (`rollDice`, `buyTerritory`, `buildCatHouse`, `endTurn`, …).
- Server validates, applies rules, broadcasts state.
- Dice, 貓糧, rent, cards, bankruptcy, turn-timer auto-play are **never** trusted from the client.
- Monorepo: `apps/web` + `apps/server`.

## Screens & flow

1. **Home** — create room / join with room code + nickname  
2. **Lobby** — show code, seats, pick cat avatar; host kicks / starts (≥2)  
3. **Match** — 40-space board (comic style), turn UI, 貓糧, actions, event log  
4. **Results** — winner; return home  

Match loop: roll → move → resolve tile (buy / rent / card / cage / …) → optional build → end turn → until one player left.

Mobile: prioritize action panel + focus on current space; full ring board is secondary.

Bankrupt players stay as spectators of the event log (no actions).

## State & sync

**Room phases:** `lobby` → `playing` → `finished`  
Empty rooms (after reconnect grace) are garbage-collected from memory.

**Seat:** server `playerId` + client-stored reconnect token; nickname, avatar, 貓糧, position, owned territories / cat trees, cage flag, bankrupt flag.

**Match:** current player, turn deadline, static board config + dynamic ownership/buildings, two shuffled decks + draw indices, recent events for the log.

**MVP sync:** on every change, broadcast a **full RoomState snapshot** (small 2–4 player state; correctness over diff complexity).

## Turn timer, reconnect, errors

- Server sets turn deadline; UI shows countdown.  
- On timeout: perform required actions (at least roll + resolve tile); skip optional (buy, build). Log as system auto-play.  
- Reconnect with `roomCode + reconnectToken` → same seat + full snapshot.  
- Illegal intents → error code, no state change.  
- No mid-game kicks. Long disconnects keep auto-play via timer rather than freezing the table.

## Testing

**Primary:** unit tests for `GameEngine` (move, economy, cards, cage, turn order, victory, timer auto-play).  
**Secondary:** room join/start/reconnect integration tests.  
**UI:** manual happy path for MVP; no heavy E2E required initially.

## Explicit non-goals (MVP)

- Ranked play, accounts, friends list  
- Player trading, mortgage, auction  
- In-game chat / voice  
- Native apps  
- Official Monopoly rule parity  
- Persistent match history beyond the live room  

## Open parameters (not product forks)

These are tuning knobs for implementation, not unresolved design:

- Exact turn timer seconds  
- Starting 貓糧, prices, rent curves (to keep 40-space bankruptcy games from dragging)  
- Exact card text list  
- Reconnect grace duration  
- Board territory names/flavor copy  

## Success criteria

- Four friends can open a room via code and finish a game in the browser without installing an app.  
- Rules feel like Monopoly with cat theming; teaching time stays short (no trade/mortgage).  
- A distracted player does not freeze the table (timer + reconnect).  
- GameEngine tests cover core economic and win/loss paths before UI polish.
