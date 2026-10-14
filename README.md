# Lakeze Go

自架的 ManyChat 平替：Messenger / Instagram 聊天自動化 web app。

> **使用者點了 Meta 廣告（Click to Messenger / Click to Instagram）→ 立刻自動回覆 → 一顆按鈕把人導到你指定的網址**，並記錄聯絡人、來源廣告與點擊數。

部署上去、打開網址、用 Facebook 登入把粉絲專頁連上，就能用。不需要改設定檔、不需要手動貼權杖。

## 功能

- 🔑 **Facebook 登入連接粉絲專頁**：授權後勾選專頁，自動儲存權杖、訂閱 Webhook、設定「開始使用」按鈕；綁定的 Instagram 專業帳號一併連接
- ⚡ **一鍵登記 Webhook**：在後台按一下就向 Meta 登記回呼網址
- 🎯 **觸發條件**：指定廣告 ID、ref 參數、任何廣告點擊、關鍵字、按鈕 payload、開始使用、預設回覆
- 💬 **回覆步驟**：文字、文字 + 按鈕（網址 / payload）、快速回覆、圖片、延遲、加標籤、跳轉另一條流程
- 🔗 **追蹤連結**：按鈕網址經過 `/r/<slug>` 再轉址，統計每條自動化的點擊
- 👥 **聯絡人**：PSID、名字、來源廣告 ID / ref、標籤、互動時間，可手動回覆
- 🧪 **模擬測試**：不用投廣告就能看某個廣告 ID / ref / 訊息會命中哪條規則、送出什麼
- 🔐 Webhook 簽章驗證、事件去重、密碼雜湊登入
- 🗄️ 零外部服務：Node.js 22 內建 SQLite，一個容器就能跑

---

## 1. 部署

### 一鍵部署到 Render（最快）

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/kuofat-lakeze/lakeze-go)

1. 按上面的按鈕，用 GitHub 帳號登入 Render。
2. 看到「Blueprint」畫面，直接按 **Apply**（設定都寫在 `render.yaml`：Docker、1 GB 持久磁碟、Starter 方案約 US$7/月；Render 的免費方案不支援磁碟，資料會在重啟後消失）。
3. 約 3 到 5 分鐘後會拿到一個 `https://lakeze-go-xxxx.onrender.com` 網址，打開就能設定密碼開始用。

### Docker（自己的主機）

```bash
git clone https://github.com/kuofat-lakeze/lakeze-go.git
cd lakeze-go
docker compose up -d
```

打開 `http://你的主機:3000`。資料存在 `lakeze-data` volume。

### Render / Railway / Fly 等平台

repo 內有 `Dockerfile` 與 `render.yaml`，連結 repo 即可自動部署。記得掛一個持久磁碟到 `/data`（Render 的 `render.yaml` 已設定）。

### 直接跑 Node

需求：Node.js **22.13 以上**。

```bash
npm install
npm run build
npm start          # 預設 3000 埠，資料存 ./data/app.db
```

開發模式：`npm run dev`。

### 環境變數（全部選填）

| 變數 | 說明 |
| --- | --- |
| `PORT` | 埠號，預設 3000 |
| `DATABASE_PATH` | SQLite 檔案，預設 `./data/app.db`（Docker 內為 `/data/app.db`） |
| `ADMIN_PASSWORD`、`PUBLIC_URL`、`META_APP_ID`、`META_APP_SECRET`… | 只在第一次啟動時當初始值寫進資料庫，之後以後台「設定」頁為準 |

> Meta 要求 Webhook 與 OAuth 都走 **https**。本機測試可用 [ngrok](https://ngrok.com/) 或 Cloudflare Tunnel 把 3000 埠開到外網。

---

## 2. 第一次使用（約 10 分鐘）

### 2.1 設定後台密碼

第一次打開網址會要求設定管理員密碼。

### 2.2 建立 Meta App

1. 到 [developers.facebook.com/apps](https://developers.facebook.com/apps/) 建立 App，類型選 **商家（Business）**。
2. 加入產品：**Facebook 登入（Facebook Login for Business）**、**Messenger**；要做 Instagram 也加入 **Instagram**。
3. 「App 設定 → 基本資料」複製 **App ID** 與 **App Secret**，貼到後台「設定」頁並儲存。

### 2.3 填 OAuth 重新導向網址

後台「設定」頁會顯示一行 `https://你的網域/auth/facebook/callback`。到 Meta App 的「Facebook 登入 → 設定 → 有效的 OAuth 重新導向 URI」貼上並儲存。這一步 Meta 不允許程式自動做。

### 2.4 登記 Webhook

後台「設定」頁按 **「自動向 Meta 登記 Webhook」**。成功會顯示 page 與 instagram 都 ok。

若失敗（例如網址還沒對外開放），也可以手動：Meta App → Messenger → 設定 → Webhooks，填後台顯示的回呼網址與驗證權杖，訂閱 `messages`、`messaging_postbacks`、`messaging_referrals`、`messaging_optins`。

### 2.5 連接粉絲專頁

後台「頻道」頁按 **「用 Facebook 登入連接粉絲專頁」** → 授權 → 勾選專頁 → 連接。系統會自動：

- 儲存永久有效的專頁存取權杖
- 讓 App 訂閱該專頁的 Webhook 事件
- 設定 Messenger「開始使用」按鈕（新用戶從廣告點進來會先看到它，按下去才會觸發自動化）
- 連接該專頁綁定的 Instagram 專業帳號

### 2.6 建立自動化

後台「自動化」→ **「⚡ 快速建立：廣告點擊 → 導購」**，把按鈕網址改成你要導去的頁面，儲存。到「模擬測試」頁填一個廣告 ID 執行，就能看到會送什麼。

### 2.7 投廣告

廣告管理員：行銷活動目標選 **互動 → 訊息**（Click to Messenger / Instagram Direct）。廣告層級「訊息範本 → 進階 → ref 參數」可填代碼（例如 `spring_sale`）讓不同廣告走不同自動化；不填也會帶 `ad_id`，用「任何廣告點擊」或「指定廣告 ID」即可。

> **App 還在開發模式時**只有 App 的管理員 / 開發者 / 測試人員收得到回覆。要對所有人生效，需送審 `pages_messaging`（Instagram 另需 `instagram_manage_messages`）並切換為上線模式。

---

## 3. 觸發條件

| 類型 | 何時觸發 | 條件值 |
| --- | --- | --- |
| 指定廣告 ID | `referral.ad_id` 相符 | 廣告 ID，可逗號分隔多個 |
| ref 參數 | `referral.ref` 相符或以其開頭 | ref 代碼，可多個 |
| 任何廣告點擊 | 來源是 ADS 的任何 referral | 不需 |
| 關鍵字 | 訊息包含任一關鍵字（不分大小寫） | 關鍵字，可多個 |
| 按鈕 payload | 使用者按了按鈕 / 快速回覆 | payload 字串 |
| 開始使用 | 新用戶按「開始使用」且非廣告來源 | 不需 |
| 預設回覆 | 都沒命中的一般訊息 | 不需 |

比對順序：按鈕 payload → 廣告 ID → ref → 任何廣告 → 開始使用 → 關鍵字 → 預設；同一層以「優先度」大者優先。

**串多步驟流程**：按鈕改成「回傳 payload」（例如 `WANT_PRICE`），再建一條「按鈕 payload = WANT_PRICE」的自動化即可分支。

**可用變數**：`{{first_name}}` `{{last_name}}` `{{full_name}}` `{{ad_id}}` `{{ref}}` `{{message}}` `{{psid}}`

---

## 4. API

所有 `/api/*` 需登入 Cookie，或 header `Authorization: Bearer <後台密碼>`。

| 方法 | 路徑 | 說明 |
| --- | --- | --- |
| GET | `/api/overview` | 統計與設定狀態 |
| GET/POST | `/api/settings` | 讀取 / 更新 Meta App 等設定 |
| POST | `/api/webhook/register` | 向 Meta 登記 Webhook |
| GET | `/api/facebook/pending/:id` | OAuth 後可連接的專頁清單 |
| POST | `/api/facebook/connect` | 連接選取的專頁 |
| GET/POST/DELETE | `/api/channels` | 頻道 |
| POST | `/api/channels/:id/subscribe` | 重新訂閱 Webhook + 設定開始使用 |
| GET/POST | `/api/automations` | 自動化列表 / 新增 |
| PUT/DELETE | `/api/automations/:id` | 更新 / 刪除 |
| PATCH | `/api/automations/:id/enabled` | 啟用 / 停用 |
| POST | `/api/simulate` | 模擬事件（不真的送出） |
| POST | `/api/replay-webhook` | 把 Meta 的原始 webhook JSON 重跑一次 |
| GET | `/api/contacts`、`/api/contacts/:id` | 聯絡人 |
| POST | `/api/contacts/:id/send` | 手動發訊息（24 小時窗口內） |
| GET | `/api/events`、`/api/links` | 事件記錄、追蹤連結 |

自動化 JSON 範例：

```json
{
  "name": "春季廣告",
  "trigger_type": "ref",
  "trigger_value": "spring_sale",
  "priority": 10,
  "steps": [
    { "type": "text", "text": "{{first_name}} 你好！" },
    { "type": "buttons", "text": "點下方按鈕看活動",
      "buttons": [{ "type": "url", "title": "看活動", "url": "https://example.com/spring", "track": true }] },
    { "type": "tag", "tag": "spring" }
  ]
}
```

---

## 5. 專案結構

```
src/
  index.ts          啟動入口
  app.ts            Express 組裝
  config.ts         啟動前的環境變數（只有 PORT、DATABASE_PATH）
  settings.ts       存在資料庫的設定、密碼雜湊、對外網址推算
  db.ts             SQLite schema 與資料存取
  meta/
    parser.ts       Webhook payload 正規化（抽出 referral / ad_id / ref）
    graph.ts        OAuth、列專頁、訂閱 Webhook、messenger_profile
    sendApi.ts      Graph API 發送訊息 / 取得個人資料
    signature.ts    X-Hub-Signature-256 驗證
  engine/
    matcher.ts      決定事件要跑哪條自動化
    runner.ts       執行步驟、產生追蹤連結
    templates.ts    {{變數}} 替換
    handler.ts      完整處理流程（聯絡人 → 比對 → 執行）
  routes/
    webhook.ts      /webhook
    facebook.ts     /auth/facebook 登入流程
    redirect.ts     /r/:slug 追蹤轉址
    auth.ts         後台登入 / 首次設定
    api.ts          後台 REST API
  public/           後台網頁（純 HTML/JS，無建置）
test/               vitest 測試
```

```bash
npm test          # 跑測試
npm run typecheck # 型別檢查
```

---

## 6. 常見問題

**點了廣告沒有回覆？** 到後台「記錄」頁看：

- 「收到未設定頻道的事件」→ 該專頁 / IG 帳號還沒連接，到「頻道」頁連接。
- 「Webhook 簽章驗證失敗」→ App Secret 填錯。
- 「Webhook 驗證失敗：verify token 不符」→ Meta 後台的驗證權杖跟設定頁不一樣，重新登記 Webhook。
- 有 `referral` 事件但沒有「觸發自動化」→ 沒有規則命中，用「模擬測試」檢查。
- 「步驟送出失敗」→ 通常是權杖過期或權限不足，到「頻道」頁重新連接。
- 什麼都沒有 → Webhook 沒登記到這個 App，或專頁沒訂閱（頻道頁按「重新訂閱」）。

**Facebook 登入後說「沒有可管理的粉絲專頁」？** 授權時 Meta 會問要分享哪些專頁，請確認有勾選。

**24 小時規則**：Meta 只允許在使用者最後一次互動後 24 小時內主動發訊息。廣告點擊觸發的回覆一定在窗口內；後台「手動發送」超過 24 小時會失敗。
