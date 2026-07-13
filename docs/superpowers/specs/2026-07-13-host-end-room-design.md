# 房主解散房間（Host End Room）

**日期：** 2026-07-13  
**狀態：** 待實作

## 問題

派對局中途或結束後，房主沒有辦法結束整場並讓所有人離開。自然破產結束後房間停在 `finished`，Results 的清除 session 只影響本機；其他人仍卡在舊房間，也無法用同一房間碼乾淨地重開。

## 目標

- 房主可**解散整個房間**：所有人回到首頁，需重新開房／輸入房間碼才能再玩。
- 大廳（lobby）、對局中（playing）、結算（finished）皆可操作。
- 按解散前需**確認**，避免誤觸。

## 非目標

- 回大廳再開一局（rematch／reset match）
- 立刻開新局而不解散
- 非房主主動離開房間（可之後另做）
- 轉移房主
- 持久化房間或解散歷史

## 決策摘要

| 項目 | 選擇 |
|------|------|
| 結束後去向 | 解散房間 → 全員 Home（非回大廳） |
| 可用階段 | lobby / playing / finished |
| 誤觸防護 | 確認對話 |
| 協議 | 新訊息 `endRoom`（client）+ `roomEnded`（server） |

## 協議

### Client → Server

```ts
{ type: "endRoom" }
```

- 僅當連線 session 已綁定房間，且 `playerId === room.hostId` 時接受。
- 否則回 `error`（例如 `notHost` / `notInRoom`）。

### Server → Client（該房所有連線）

```ts
{ type: "roomEnded", reason: "hostEnded" }
```

- 在刪除房間**之前**先對該房所有 open socket 送出。
- 然後自 `RoomManager` 移除該房間（之後 `getRoom` 為空；舊 reconnect token 失效）。

不借用 `kicked`：避免與「被踢」語意混淆。

## 伺服器行為

新增 `RoomManager.endRoom(code, hostId)`（名稱可微調）：

1. 房間必須存在。
2. `hostId` 必須等於 `room.hostId`。
3. 回傳需通知的 player／由呼叫端對該房 sockets 廣播 `roomEnded`。
4. 刪除房間狀態（含 `match`、players、tokens）。

`apps/server/src/index.ts`：處理 `endRoom` → 廣播 → 清該房相關 `sessions` 的 code/playerId（或等 client 關線後自然清）。

## 客戶端行為

1. **UI：** Lobby、Match、Results 僅當本機 `playerId === room.hostId` 顯示「解散房間」。
2. **確認文案：**「確定解散房間？所有人都會回到首頁。」（確定／取消）
3. **送出：** `client.send({ type: "endRoom" })`
4. **收到 `roomEnded`：** 清除 localStorage session、清空本機 room／player 狀態 → 顯示 Home；可短暫提示「房主已解散房間」（可選，建議有）。
5. Results 既有「清除 session／離開」可保留：只影響自己，**不**解散房間。

## 驗收

- [ ] 房主在 lobby 確認後解散 → 全員（含房主）回 Home；再 join 舊房間碼應失敗。
- [ ] 房主在 playing 解散 → 同上；對局狀態不再 tick。
- [ ] 房主在 finished 解散 → 同上。
- [ ] 非房主看不到解散按鈕；若手動送 `endRoom` 被拒。
- [ ] 取消確認不送訊息、房間不變。
- [ ] 自然破產進 Results 的流程不變。

## 實作觸及（預期）

- `apps/server/src/protocol.ts`、`room-manager.ts`、`index.ts`（+ 測試）
- `apps/web/src/ws/client.ts`
- `apps/web/src/App.tsx`（處理 `roomEnded`）
- `apps/web/src/screens/Lobby.tsx`、`Match.tsx`、`Results.tsx`
