# React + Node WebSocket 權威伺服器

派對局需要伺服器裁定擲骰、貓糧與破產，且房間是短暫的 2–4 人場次。我們採用 Vite/React 前端＋ Node WebSocket 權威遊戲伺服器（房間狀態先放記憶體），而非 Next.js 全端或 PartyKit／Durable Objects——前者在常見託管上不好掛長連線，後者過早綁平台。

**Considered Options**
- Vite/React + Node WebSocket（採用）
- Next.js + Socket.io
- PartyKit / Cloudflare Durable Objects
