# KittyPoly 線上部署方案

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓朋友用瀏覽器連上公開網址開房、加入、對局，無需本機跑 server。

**Architecture:** 若已有 Linode VPS：同一台機器跑 Node（遊戲 WS）＋ Nginx（靜態前端與 HTTPS）。房間狀態仍在記憶體；重啟會清空房間。建議 `play.` / `api.` 兩個子網域，前端建置時注入 `VITE_WS_URL=wss://api.…`。無 VPS 時改用 Cloudflare Pages + Railway（見下文雲端段落）。

**Tech Stack:** pnpm monorepo、`@kittypoly/server`、`@kittypoly/web`、Linode Ubuntu、Nginx、systemd、Certbot、HTTPS/`wss`

---

## 為什麼選這組

| 選項 | 結論 |
|------|------|
| **你已有 Linode → 單機 Nginx + systemd（本文件主路徑）** | 零額外月費平台、完全可控；要自己管 OS／憑證／更新 |
| 無 VPS：Railway + Cloudflare Pages | 免管機器，見文末雲端段落 |
| 不做：Vercel Serverless 當遊戲服 | 不適合長連線 WebSocket |
| 不做：多實例／負載平衡 | 房間在 RAM，多實例會找不到房 |

**約束（寫進上線說明）：**

- 後端只能 **1 個實例**
- 部署／重啟 → 進行中房間消失
- 無帳號、無 DB；房間碼分享即可

---

## 目標拓撲（Linode）

```
玩家瀏覽器
  │  HTTPS                 │  WSS
  ▼                        ▼
play.example.com         api.example.com
  Nginx 靜態               Nginx 反代 → 127.0.0.1:8787
  apps/web/dist            systemd: node dist/index.js
                           GET /health → ok
```

現有程式已具備：

- 伺服器：`PORT`、`GET /health`、`node dist/index.js`
- 前端：`import.meta.env.VITE_WS_URL`（`apps/web/src/ws/client.ts`）

---

## 帳號與費用（先準備）

- [ ] GitHub repo 可被 Railway／Cloudflare 讀取（private 亦可，需連線授權）
- [ ] [Railway](https://railway.app) 帳號（信用卡可能要綁，用免費額度）
- [ ] [Cloudflare](https://dash.cloudflare.com) 帳號
- [ ]（可選）自訂網域，例如 `play.example.com` + `api.example.com`

---

## Task 1: 補部署用檔案（repo 內）

**Files:**

- Create: `apps/server/Dockerfile`
- Create: `apps/server/railway.toml`（或根目錄說明用同一 build）
- Create: `apps/web/.env.production.example`
- Modify: `README.md`（加「線上部署」一節，連到本文件）

- [ ] **Step 1: 後端 Dockerfile（monorepo 友善）**

在 repo 根目錄 context 建置，例如：

```dockerfile
# apps/server/Dockerfile — build context = repo root
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/game/package.json packages/game/
COPY apps/server/package.json apps/server/
RUN pnpm install --frozen-lockfile
COPY packages/game packages/game
COPY apps/server apps/server
RUN pnpm --filter @kittypoly/game build \
 && pnpm --filter @kittypoly/server build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=build /app /app
WORKDIR /app/apps/server
EXPOSE 8787
CMD ["pnpm", "start"]
```

（實作時若 `pnpm start` 在精簡映像缺 workspace 連結，改為 `CMD ["node", "dist/index.js"]` 並只複製 runtime 依賴。）

- [ ] **Step 2: Railway 設定**

```toml
# apps/server/railway.toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "apps/server/Dockerfile"

[deploy]
healthcheckPath = "/health"
healthcheckTimeout = 30
restartPolicyType = "ON_FAILURE"
```

Railway 專案的 **Root Directory** 設為 repo 根；Dockerfile path 如上。

- [ ] **Step 3: 前端 env 範例**

```bash
# apps/web/.env.production.example
VITE_WS_URL=wss://YOUR_RAILWAY_HOST
```

- [ ] **Step 4: 本機驗證 Docker（可選）**

```bash
docker build -f apps/server/Dockerfile -t kittypoly-server .
docker run --rm -p 8787:8787 -e PORT=8787 kittypoly-server
curl -s http://localhost:8787/health   # 期望: ok
```

- [ ] **Step 5: Commit**（需你授權後再做）

---

## Task 2: 部署後端到 Railway

- [ ] **Step 1:** New Project → Deploy from GitHub → 選 `kittypoly`
- [ ] **Step 2:** 設定 Dockerfile / `railway.toml`；**Replicas = 1**（不要水平擴展）
- [ ] **Step 3:** Variables：`PORT` 通常由平台注入；可加 `NODE_ENV=production`
- [ ] **Step 4:** Generate Domain，記下主機名，例如 `kittypoly-server-production.up.railway.app`
- [ ] **Step 5:** 驗證

```bash
curl -s https://YOUR_RAILWAY_HOST/health
# 期望: ok
```

瀏覽器無法直接測 WS 時，可用本機前端暫時指向：

```bash
# apps/web/.env.local（勿提交）
VITE_WS_URL=wss://YOUR_RAILWAY_HOST
pnpm --filter @kittypoly/web dev
```

開兩個分頁：建立房間 → 加入 → 確認 snapshot 同步。

---

## Task 3: 部署前端到 Cloudflare Pages

- [ ] **Step 1:** Workers & Pages → Create → Connect Git → 選同一 repo
- [ ] **Step 2:** Build 設定

| 欄位 | 值 |
|------|-----|
| Framework preset | Vite |
| Build command | `corepack enable && pnpm install && pnpm --filter @kittypoly/game build && pnpm --filter @kittypoly/web build` |
| Build output directory | `apps/web/dist` |
| Root directory | `/`（repo 根） |
| Node version | `20` 或 `22`（環境變數 `NODE_VERSION=22`） |

- [ ] **Step 3:** Environment variables（Production）

| Name | Value |
|------|--------|
| `VITE_WS_URL` | `wss://YOUR_RAILWAY_HOST`（**不要**加路徑；**不要**用 `ws://`） |
| `NODE_VERSION` | `22` |

注意：改 `VITE_WS_URL` 後必須 **重新建置** 前端，否則瀏覽器仍連舊位址。

- [ ] **Step 4:** 部署完成後開啟 `https://xxx.pages.dev`，兩裝置試玩

---

## Task 4:（可選）自訂網域

- [ ] 前端：`play.example.com` → Cloudflare Pages 自訂網域（自動 HTTPS）
- [ ] 後端：Railway Custom Domain `api.example.com`，DNS CNAME 依 Railway 指示
- [ ] 前端 Production 改 `VITE_WS_URL=wss://api.example.com` 並 Redeploy
- [ ] 再跑一次兩裝置試玩

---

## Task 5: 上線驗收清單

- [ ] `GET https://api…/health` → `ok`
- [ ] 頁面用 HTTPS 開啟；DevTools → Network → WS 狀態 101
- [ ] 手機 4G + 筆電 Wi‑Fi 各一人：開房／加入／開打
- [ ] 故意重整一頁：重連後仍能操作（既有 reconnect token）
- [ ] 在 Railway Dashboard **不要**開多 replica
- [ ] README 或分享文案註明：「伺服器重啟會清房」

---

## Linode VPS 主路徑（建議照做）

### 拓撲

```
DNS:
  play.example.com  →  Linode 公網 IP
  api.example.com   →  同一個 IP

玩家
  │ HTTPS  https://play.example.com
  ▼
Nginx 靜態檔  (/var/www/kittypoly)     ← apps/web/dist
  │
  │ WSS   wss://api.example.com
  ▼
Nginx 反代  →  127.0.0.1:8787         ← systemd: kittypoly-server
                 GET /health → ok
```

現行程式 WebSocket 掛在 HTTP server **根路徑**，用 `api.` 子網域最省事（**不必改程式**）。只有一個網域時也可只開 `api` 反代、前端另用 IP／別的 host——仍建議兩個 A record。

### 你需要先有

- [ ] Linode：Ubuntu 22.04/24.04，公網 IP，SSH 可登入
- [ ] 網域：兩個 A 記錄指到該 IP（下文以 `play.` / `api.` 為例）
- [ ] 防火牆：開 **22**（SSH）、**80**、**443**；**不要**對公網開 8787（只給本機 Nginx）

Linode Cloud Firewall 或 `ufw`：

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

### L1: 安裝執行環境

SSH 進機器後：

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx git curl

# Node 22（NodeSource）
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo corepack enable
corepack prepare pnpm@latest --activate

node -v   # >= 20
pnpm -v
```

- [ ] Node / pnpm / nginx 可用

---

### L2: 放置程式並建置

建議用獨立使用者，勿用 root 跑 Node：

```bash
sudo adduser --disabled-password --gecos "" kittypoly
sudo mkdir -p /opt/kittypoly /var/www/kittypoly
sudo chown kittypoly:kittypoly /opt/kittypoly /var/www/kittypoly
```

用你的 repo（HTTPS 或 deploy key）：

```bash
sudo -u kittypoly -i
cd /opt/kittypoly
git clone https://github.com/YOUR_USER/kittypoly.git .
pnpm install
pnpm --filter @kittypoly/game build
pnpm --filter @kittypoly/server build
```

前端必須帶正式 WS 位址再 build（換成你的網域）：

```bash
cd /opt/kittypoly
VITE_WS_URL=wss://api.example.com pnpm --filter @kittypoly/web build
rsync -a --delete apps/web/dist/ /var/www/kittypoly/
```

先手動試後端：

```bash
cd /opt/kittypoly/apps/server
PORT=8787 NODE_ENV=production node dist/index.js
# 另開 SSH：curl -s http://127.0.0.1:8787/health  → ok
# Ctrl+C 停掉，改交 systemd
```

- [ ] `/health` 本機 OK、靜態檔已進 `/var/www/kittypoly`

---

### L3: systemd 常駐遊戲服

建立 `/etc/systemd/system/kittypoly.service`：

```ini
[Unit]
Description=KittyPoly game WebSocket server
After=network.target

[Service]
Type=simple
User=kittypoly
WorkingDirectory=/opt/kittypoly/apps/server
Environment=NODE_ENV=production
Environment=PORT=8787
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now kittypoly
sudo systemctl status kittypoly
curl -s http://127.0.0.1:8787/health
```

- [ ] `systemctl` active、`/health` → `ok`

---

### L4: Nginx 兩個 server

建立 `/etc/nginx/sites-available/kittypoly`：

```nginx
# 前端
server {
    listen 80;
    server_name play.example.com;
    root /var/www/kittypoly;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}

# 遊戲 API / WebSocket
server {
    listen 80;
    server_name api.example.com;

    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
```

```bash
sudo ln -sf /etc/nginx/sites-available/kittypoly /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

DNS 生效後：

```bash
curl -s http://api.example.com/health   # ok
curl -sI http://play.example.com        # 200 / HTML
```

- [ ] HTTP 兩網域都通

---

### L5: HTTPS（Certbot）

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d play.example.com -d api.example.com
```

依提示選導向 HTTPS。完成後確認：

```bash
curl -s https://api.example.com/health
```

瀏覽器開 `https://play.example.com`，DevTools → Network → WS 應為 `wss://api.example.com` 且 status 101。

- [ ] HTTPS + WSS 兩裝置可開房對打

---

### L6: 之後更新程式（重覆這段）

```bash
sudo -u kittypoly -i
cd /opt/kittypoly
git pull
pnpm install
pnpm --filter @kittypoly/game build
pnpm --filter @kittypoly/server build
VITE_WS_URL=wss://api.example.com pnpm --filter @kittypoly/web build
rsync -a --delete apps/web/dist/ /var/www/kittypoly/
sudo systemctl restart kittypoly
```

注意：`restart` 會清掉進行中房間。

可把上述做成 `/opt/kittypoly/deploy.sh` 方便重跑。

---

### Linode 驗收

- [ ] `https://api…/health` → `ok`
- [ ] `https://play…` 可開、WS 101
- [ ] 兩裝置（或筆電 + 手機 4G）完整一局
- [ ] 公網掃 port：8787 **未**對外開放
- [ ] `sudo systemctl restart kittypoly` 後服務回來（房間會沒是預期行為）

---

## 雲端備案（無 VPS 時）

見上文 Task 1–5：Railway 跑 server、Cloudflare Pages 跑 `apps/web/dist`，`VITE_WS_URL=wss://…`。有 Linode 時可略過。

---

## 刻意不做（YAGNI）

- Redis／DB 持久化房間
- 多區域、多實例、Docker Compose（單機直接 systemd 較短）
- CI 自動部署（可之後加）
- 帳號系統、Rate limit 儀表板（有濫用再補）

---

## 實作順序建議（Linode）

1. L1 環境 → L2 建置 → L3 systemd  
2. DNS A 記錄 → L4 Nginx HTTP  
3. L5 Certbot → 兩裝置驗收  
4. 需要時寫 `deploy.sh`（L6）  

完成 L5 即「線上可玩」。
