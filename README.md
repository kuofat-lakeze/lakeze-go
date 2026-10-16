# Lakeze Go

可對外收費的 ManyChat 平替：Messenger / Instagram 聊天自動化 SaaS。

> 用戶註冊 → 用 Facebook 登入連接自己的粉絲專頁 → 設定「**Meta 廣告點擊 → 立刻自動回覆 → 按鈕導到指定網址**」→ 試用到期後透過 **PAYUNi 統一金流** 付費續用。

## 功能

**給用戶**

- 🔑 Facebook 登入連接粉絲專頁與 Instagram 專業帳號，自動訂閱 Webhook、設定「開始使用」按鈕
- 🎯 觸發條件：指定廣告 ID、ref 參數、任何廣告點擊、關鍵字、按鈕 payload、開始使用、預設回覆
- 💬 回覆步驟：文字、文字 + 按鈕（網址 / payload）、快速回覆、圖片、延遲、加標籤、跳轉另一條流程
- 🔗 追蹤連結點擊統計、聯絡人來源廣告記錄、模擬測試、事件記錄
- 💳 免費試用（天數可設）→ 線上刷卡購買月繳 / 年繳方案

**給平台擁有者（第一位註冊者）**

- ⚙️ 後台設定 Meta App、PayUni 金流、方案與價格、試用天數、是否開放註冊
- 👥 用戶列表、方案狀態、手動延長（匯款 / 贈送）、全部訂單與營收
- ⚡ 一鍵向 Meta 登記 Webhook

**技術**

- Node.js 22 + TypeScript + Express，內建 SQLite，一個容器就能跑
- 多租戶資料隔離、Webhook 簽章驗證、事件去重、scrypt 密碼雜湊
- PayUni 加解密與官方 SDK 相容（AES-256-GCM + SHA256 驗章），伺服器端 NotifyURL 入帳、金額比對、重複通知冪等

---

## 1. 部署

### 一鍵部署到 Render（最快）

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/kuofat-lakeze/lakeze-go)

按按鈕 → 用 GitHub 登入 Render → Apply。設定都在 `render.yaml`（Docker、1 GB 持久磁碟、Starter 方案約 US$7/月）。免費方案沒有磁碟且會休眠，Meta 的 Webhook 會超時，請勿使用。

### Railway（推薦，約 US$5/月）

repo 內有 `railway.json`（用 Dockerfile 建置、健康檢查 `/healthz`）。

1. [railway.com](https://railway.com) 用 GitHub 登入，升級到 **Hobby**（每月 5 美元，內含 5 美元用量；本專案約用 0.5 GB RAM + 1 GB 磁碟，正常不會超過）。
2. **New Project → Deploy from GitHub repo → `kuofat-lakeze/lakeze-go`**。Railway 會自動偵測 Dockerfile 開始建置。
3. 點進服務 → **Settings → Networking → Generate Domain**，拿到 `xxx.up.railway.app` 網址（之後可綁自己的網域）。
4. **Settings → Volumes → Add Volume**，Mount Path 填 **`/data`**。沒有這步資料會在每次部署後消失。
5. **Settings → Deploy → Region** 選 **Southeast Asia (Singapore)**，離台灣最近。
6. 等部署完成，打開網址註冊第一個帳號（即平台擁有者）。

不需要設定任何環境變數：`PORT` Railway 會自動給，資料庫路徑預設就是 `/data/app.db`，對外網址會從 Railway 的 proxy 標頭自動判斷。Volume 權限由映像的 entrypoint 在啟動時自動處理，不需要 `RAILWAY_RUN_UID`。

### Docker（自己的主機）

```bash
git clone https://github.com/kuofat-lakeze/lakeze-go.git && cd lakeze-go
docker compose up -d        # http://主機:3000，資料存在 lakeze-data volume
```

### 直接跑 Node（需 22.13 以上）

```bash
npm install && npm run build && npm start    # 開發：npm run dev
```

環境變數全部選填，見 `.env.example`。Meta 要求 Webhook 與 OAuth 都走 **https**；本機測試可用 ngrok 或 Cloudflare Tunnel。

---

## 2. 平台擁有者第一次設定（約 15 分鐘）

### 2.1 註冊

打開網址，**第一位註冊的人就是平台擁有者**，之後註冊的都是一般用戶（會拿到試用期）。也可以用 `ADMIN_EMAIL` / `ADMIN_PASSWORD` 環境變數在啟動時建立擁有者。

### 2.2 Meta App

1. 到 [developers.facebook.com/apps](https://developers.facebook.com/apps/) 建立 App，類型選 **商家（Business）**。
2. 加入產品：**Facebook 登入（Facebook Login for Business）**、**Messenger**、**Instagram**。
3. 「App 設定 → 基本資料」複製 App ID 與 App Secret，填到後台「平台設定 → 2. Meta App」。
4. 把後台顯示的 OAuth 重新導向網址（`https://你的網域/auth/facebook/callback`）貼到 Meta App 的「Facebook 登入 → 設定 → 有效的 OAuth 重新導向 URI」。
5. 後台按「自動向 Meta 登記 Webhook」。失敗的話手動到 Messenger → 設定 → Webhooks 填回呼網址與驗證權杖，訂閱 `messages`、`messaging_postbacks`、`messaging_referrals`、`messaging_optins`。

> 所有用戶都會透過你的這個 Meta App 連接他們的粉絲專頁。要對不是 App 測試人員的用戶生效，App 必須送審 `pages_messaging`、`pages_show_list`、`pages_manage_metadata`、`instagram_basic`、`instagram_manage_messages` 並切換為上線模式。送審前可先把早期用戶加為 App 的測試人員。

### 2.3 PAYUNi 統一金流

1. 到 [PAYUNi](https://www.payuni.com.tw/) 申請商店，先用**測試區**帳號。
2. 商店後台「串接資訊」取得 **商店代號（MerID）**、**Hash Key（32 字元）**、**Hash IV（16 字元）**，填到後台「平台設定 → 3. PAYUNi」，勾選測試模式。
3. 用一個測試用戶帳號到「方案與付款」按購買，會導到 PayUni 測試支付頁，用測試卡號完成付款，回來後方案到期日應該延長、訂單狀態為已付款。
4. 確認無誤後換成正式區的 MerID / Key / IV，取消勾選測試模式。

NotifyURL / ReturnURL 會隨每筆交易帶給 PayUni，不需要在 PayUni 後台另外設定。

### 2.4 方案與試用

「平台設定 → 4. 方案」可改名稱、價格、月數、上下架，預設有月繳 990 / 年繳 9900。「1. 基本」可改試用天數與是否開放註冊。

---

## 3. 用戶怎麼用

1. 註冊 → 進入試用期。
2. 「頻道」→「用 Facebook 登入連接粉絲專頁」→ 勾選專頁 → 系統自動儲存權杖、訂閱 Webhook、設定開始使用按鈕、連接綁定的 IG。
3. 「自動化」→「快速建立：廣告點擊 → 導購」，改成自己的網址，儲存。
4. 「模擬測試」確認規則命中。
5. 廣告管理員建立 **互動 → 訊息** 目標的廣告；想分流用 ref 參數或廣告 ID。
6. 試用到期前到「方案與付款」購買；到期後 Webhook 事件照收、聯絡人照記，但自動回覆暫停，付款後立即恢復。

### 觸發條件

| 類型 | 何時觸發 | 條件值 |
| --- | --- | --- |
| 指定廣告 ID | `referral.ad_id` 相符 | 廣告 ID，可逗號分隔多個 |
| ref 參數 | `referral.ref` 相符或以其開頭 | ref 代碼，可多個 |
| 任何廣告點擊 | 來源是 ADS 的任何 referral | 不需 |
| 關鍵字 | 訊息包含任一關鍵字（不分大小寫） | 關鍵字，可多個 |
| 按鈕 payload | 使用者按了按鈕 / 快速回覆 | payload 字串 |
| 開始使用 | 新用戶按「開始使用」且非廣告來源 | 不需 |
| 預設回覆 | 都沒命中的一般訊息 | 不需 |

比對順序：按鈕 payload → 廣告 ID → ref → 任何廣告 → 開始使用 → 關鍵字 → 預設；同一層以優先度大者優先。可用變數：`{{first_name}}` `{{last_name}}` `{{full_name}}` `{{ad_id}}` `{{ref}}` `{{message}}` `{{psid}}`。

---

## 4. API

`/api/*` 需登入 Cookie，或 `Authorization: Basic base64(email:password)`。

| 方法 | 路徑 | 說明 |
| --- | --- | --- |
| POST | `/api/auth/signup`、`/login`、`/logout`、`/password` | 帳號 |
| GET | `/api/auth/me` | 目前使用者與方案狀態 |
| GET | `/api/overview` | 統計 |
| GET | `/api/billing` | 方案狀態、可購買方案、付款記錄 |
| POST | `/api/billing/checkout` | 建立訂單，回傳 PayUni UPP 表單 |
| GET/POST/DELETE | `/api/billing/plans` | 方案管理（擁有者） |
| POST | `/api/billing/grant` | 手動延長（擁有者） |
| GET | `/api/billing/orders/all` | 全部訂單（擁有者） |
| GET/POST | `/api/settings` | 平台設定（擁有者） |
| POST | `/api/webhook/register` | 向 Meta 登記 Webhook（擁有者） |
| GET | `/api/users` | 用戶列表（擁有者） |
| GET | `/api/facebook/pending/:id`、POST `/api/facebook/connect` | Facebook 連接 |
| GET/POST/DELETE | `/api/channels` | 頻道 |
| GET/POST/PUT/PATCH/DELETE | `/api/automations` | 自動化 |
| POST | `/api/simulate` | 模擬 |
| GET | `/api/contacts`、`/api/events`、`/api/links` | 聯絡人、記錄、追蹤連結 |

公開端點：`/webhook`（Meta）、`/payuni/notify`、`/payuni/return`（PayUni）、`/r/:slug`（追蹤轉址）、`/auth/facebook`（OAuth）。

---

## 5. 專案結構

```
src/
  index.ts / app.ts / config.ts     啟動、Express 組裝、環境變數
  settings.ts                       平台設定（存資料庫）、密碼雜湊、對外網址
  db.ts                             SQLite schema 與資料存取（users / plans / orders / channels / ...）
  types.ts
  billing/
    payuni.ts                       PayUni 加解密、UPP 表單、回呼驗章
    subscription.ts                 試用 / 付費 / 到期判斷、付款後延長
  meta/
    parser.ts                       Webhook 正規化（抽出 referral / ad_id / ref）
    graph.ts                        OAuth、列專頁、訂閱 Webhook、messenger_profile
    sendApi.ts / signature.ts       發訊息、簽章驗證
  engine/
    matcher.ts / runner.ts / handler.ts / templates.ts
  routes/
    auth.ts                         註冊登入、角色
    billing.ts                      /api/billing、/payuni/notify、/payuni/return
    facebook.ts / webhook.ts / redirect.ts / api.ts
  public/                           後台網頁（純 HTML/JS，無建置）
test/                               vitest（37 項：解析、比對、PayUni 加解密、多用戶端到端）
```

```bash
npm test && npm run typecheck
```

---

## 6. 常見問題

**付款成功但方案沒延長？** 到「記錄」看全平台事件：「找不到訂單」代表 MerTradeNo 對不上；「金額不符」代表方案價格在付款途中被改；「驗章失敗」代表 Hash Key / IV 填錯或測試區與正式區混用。

**用戶點了廣告沒有回覆？** 用戶的「記錄」頁會寫原因：未連接頻道、方案已到期、權杖過期、沒有規則命中。擁有者在「記錄 → 看全平台」能看到未連接頻道的事件。

**App 在開發模式** 只有 App 的管理員 / 開發者 / 測試人員能收到回覆，正式營運必須送審。

**24 小時規則**：Meta 只允許在使用者最後一次互動後 24 小時內主動發訊息。廣告點擊觸發的回覆一定在窗口內。

**自動扣款（定期定額）**：目前是「買 N 個月、到期前手動續約」，後台會在到期前 7 天提醒。PayUni 的信用卡約定（Token）定期扣款可以之後再加。
