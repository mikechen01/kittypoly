# KittyPoly

貓咪主題的線上大富翁式**派對遊戲**：朋友開房一起玩，可愛與趣味優先於競技。2–4 人遠端加入同一房間，擲骰走格、累積貓糧、建造貓屋，直到最後一位未破產的玩家獲勝。

## 前置需求

- [Node.js](https://nodejs.org/) **>= 20**
- [pnpm](https://pnpm.io/)

## 安裝

```bash
pnpm install
```

## 本機執行

需要**兩個終端機**，分別啟動遊戲伺服器與前端：

**終端 1 — 伺服器（WebSocket，預設 `http://localhost:8787`）**

```bash
pnpm dev:server
```

**終端 2 — 前端（Vite，預設 `http://localhost:5173`）**

```bash
pnpm dev:web
```

### 試玩流程

1. 在瀏覽器開啟 `http://localhost:5173`
2. 建立房間，記下房間碼
3. 用**第二個瀏覽器分頁、無痕視窗或不同瀏覽器設定檔**再次開啟同一網址
4. 輸入房間碼加入，房主開始遊戲

對局畫面：左側棋盤；右側上方是**自己的狀態卡**（含與自己有關的事件、操作），其下是其他玩家。事件中的收入金額為藍色、支出為紅色。

## 其他指令

```bash
pnpm test    # 執行各套件測試
pnpm build   # 建置所有套件
```

## 進一步閱讀

- [CONTEXT.md](./CONTEXT.md) — 領域語言與產品邊界
- [設計規格](./docs/superpowers/specs/2026-07-10-kittypoly-design.md) — MVP 功能與規則決策
- [ADR 0001](./docs/adr/0001-react-node-websocket-authoritative.md) — React + Node WebSocket 權威伺服器架構

## MVP 範圍外

以下功能**不在**目前 MVP 內：

- 遊戲內聊天
- 帳號註冊／登入
- 玩家間資產交易
