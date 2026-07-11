# Avatar uniqueness (lobby)

**Date:** 2026-07-11  
**Status:** Approved  
**Related:** [KittyPoly design](./2026-07-10-kittypoly-design.md)

## Goal

Room avatars must be unique so each player is visually distinct. Selection happens in the lobby after joining; the server is authoritative.

## Decisions

| Topic | Decision |
|-------|----------|
| Where to pick | Lobby only (not Home) |
| On create / join | Server auto-assigns the first free avatar |
| Changing | Player may change own avatar in lobby via `setAvatar` |
| Taken avatars | Disabled in UI; server rejects if another player holds it |
| After kick / leave | Avatar becomes free again |
| After game start | `setAvatar` rejected (lobby-only) |
| Pool | Existing four: `tabby`, `calico`, `black`, `white` (matches max 4 players) |

## Behavior

1. **Create room / join room**  
   - Client no longer sends a chosen avatar (or server ignores any provided value).  
   - Server assigns `first(CAT_AVATARS \ taken)`.  
   - If none free (should not happen at ≤4 players): reject join with a clear error.

2. **Lobby UI**  
   - Show avatar picker for the local player.  
   - Avatars held by others: disabled / greyed (e.g. label「已選」).  
   - Current own avatar remains selectable (no-op or confirm same).  
   - On click of a free avatar: send `setAvatar`.

3. **`setAvatar`**  
   - Allowed only while `match == null` (lobby).  
   - If `avatar` is used by another `playerId` → error「這隻貓已被選走」.  
   - Otherwise update and broadcast snapshot.

4. **Home**  
   - Remove avatar row from create/join form.  
   - Protocol: `createRoom` / `joinRoom` drop required `avatar` (or keep optional for backward compat and ignore).

## Non-goals

- In-match avatar changes  
- Extra avatars beyond the four  
- Showing other players’ picker state beyond “taken vs free”

## Test plan

- Two players cannot hold the same avatar via `setAvatar`  
- Third joiner receives an unused auto-assigned avatar  
- After kick, the freed avatar can be selected  
- `setAvatar` fails once the match has started  
- Lobby UI disables taken options (manual / component check)
