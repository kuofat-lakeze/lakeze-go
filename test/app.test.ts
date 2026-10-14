import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { createApp } from "../src/app.js";
import { openDb, channels, contacts, automations, links, settingsStore } from "../src/db.js";
import { createCaptureSender } from "../src/meta/sendApi.js";
import { signBody } from "../src/meta/signature.js";
import { hashPassword, KEYS } from "../src/settings.js";

const APP_SECRET = "secret123";
const PAGE_ID = "PAGE1";
const db = openDb(":memory:");
const sender = createCaptureSender();

/** 假的 Graph API：模擬 OAuth、列出專頁、訂閱、messenger_profile */
const graphCalls: string[] = [];
const fakeFetch: typeof fetch = async (input, init) => {
  const url = String(input);
  graphCalls.push(`${init?.method ?? "GET"} ${url.split("?")[0]}`);
  const json = (obj: unknown, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
  if (url.includes("/oauth/access_token")) return json({ access_token: url.includes("fb_exchange_token") ? "LONG_USER_TOKEN" : "SHORT_TOKEN" });
  if (url.includes("/me/accounts")) {
    return json({
      data: [
        { id: "PAGE_A", name: "A 專頁", access_token: "PAGE_A_TOKEN", instagram_business_account: { id: "IG_A", username: "a_shop" } },
        { id: "PAGE_B", name: "B 專頁", access_token: "PAGE_B_TOKEN" },
      ],
    });
  }
  if (url.includes("/subscribed_apps")) return json({ success: true });
  if (url.includes("/me/messenger_profile")) return json({ result: "success" });
  if (url.includes("/subscriptions")) return json({ success: true });
  if (url.includes("/me?fields=")) return json({ id: "PAGE1", name: "測試專頁" });
  return json({ error: { message: `unexpected ${url}` } }, 400);
};

const app = createApp({ db, sender, fetchImpl: fakeFetch });

let server: Server;
let base = "";
const auth = { authorization: "Bearer pw", "content-type": "application/json" };

beforeAll(async () => {
  settingsStore.set(db, KEYS.adminPasswordHash, hashPassword("pw"));
  settingsStore.set(db, KEYS.sessionSecret, "test-secret");
  settingsStore.set(db, KEYS.verifyToken, "verify-me");
  settingsStore.set(db, KEYS.metaAppId, "APP123");
  settingsStore.set(db, KEYS.metaAppSecret, APP_SECRET);
  settingsStore.set(db, KEYS.publicUrl, "https://bot.example.com");
  await new Promise<void>((r) => {
    server = app.listen(0, () => r());
  });
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
  channels.upsert(db, { platform: "messenger", external_id: PAGE_ID, name: "測試專頁", access_token: "tok", instagram_login: 0 });
});
afterAll(() => server.close());

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function postWebhook(body: unknown, sign = true) {
  const raw = JSON.stringify(body);
  return fetch(`${base}/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(sign ? { "x-hub-signature-256": signBody(APP_SECRET, raw) } : {}) },
    body: raw,
  });
}

describe("webhook 驗證", () => {
  it("GET 驗證成功回 challenge", async () => {
    const r = await fetch(`${base}/webhook?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=abc`);
    expect(r.status).toBe(200);
    expect(await r.text()).toBe("abc");
  });
  it("GET 驗證 token 錯誤回 403", async () => {
    const r = await fetch(`${base}/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=abc`);
    expect(r.status).toBe(403);
  });
  it("POST 沒簽章回 401", async () => {
    const r = await postWebhook({ object: "page", entry: [] }, false);
    expect(r.status).toBe(401);
  });
});

describe("後台 API 權限", () => {
  it("未登入拒絕", async () => {
    const r = await fetch(`${base}/api/automations`);
    expect(r.status).toBe(401);
  });
  it("密碼登入後可用 cookie", async () => {
    const r = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: "pw" }) });
    expect(r.status).toBe(200);
    const cookie = r.headers.get("set-cookie")!.split(";")[0];
    const r2 = await fetch(`${base}/api/overview`, { headers: { cookie } });
    expect(r2.status).toBe(200);
    const j = (await r2.json()) as { webhook_url: string; app_configured: boolean };
    expect(j.webhook_url).toBe("https://bot.example.com/webhook");
    expect(j.app_configured).toBe(true);
  });
  it("錯誤密碼 401，且已設定密碼後不能再 setup", async () => {
    const r = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: "nope" }) });
    expect(r.status).toBe(401);
    const s = await fetch(`${base}/api/auth/setup`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: "whatever123" }) });
    expect(s.status).toBe(400);
  });
});

describe("首次設定密碼", () => {
  it("全新資料庫 needs_setup = true，設定後即登入", async () => {
    const freshDb = openDb(":memory:");
    settingsStore.set(freshDb, KEYS.sessionSecret, "x");
    const freshApp = createApp({ db: freshDb, sender, fetchImpl: fakeFetch });
    const s = await new Promise<Server>((r) => {
      const srv = freshApp.listen(0, () => r(srv));
    });
    const addr = s.address();
    const b = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
    try {
      const me = (await (await fetch(`${b}/api/auth/me`)).json()) as { needs_setup: boolean };
      expect(me.needs_setup).toBe(true);
      const short = await fetch(`${b}/api/auth/setup`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: "short" }) });
      expect(short.status).toBe(400);
      const ok = await fetch(`${b}/api/auth/setup`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: "longenough" }) });
      expect(ok.status).toBe(200);
      const cookie = ok.headers.get("set-cookie")!.split(";")[0];
      const me2 = (await (await fetch(`${b}/api/auth/me`, { headers: { cookie } })).json()) as { authenticated: boolean; needs_setup: boolean };
      expect(me2).toEqual({ authenticated: true, needs_setup: false });
    } finally {
      s.close();
    }
  });
});

describe("設定頁", () => {
  it("儲存設定並反映在 overview", async () => {
    const r = await fetch(`${base}/api/settings`, { method: "POST", headers: auth, body: JSON.stringify({ meta_app_id: "APP123", graph_version: "v22.0" }) });
    expect(r.status).toBe(200);
    const s = (await (await fetch(`${base}/api/settings`, { headers: auth })).json()) as { graph_version: string; oauth_redirect_url: string; meta_app_secret_set: boolean };
    expect(s.graph_version).toBe("v22.0");
    expect(s.oauth_redirect_url).toBe("https://bot.example.com/auth/facebook/callback");
    expect(s.meta_app_secret_set).toBe(true);
  });
  it("拒絕格式錯誤的 Graph 版本", async () => {
    const r = await fetch(`${base}/api/settings`, { method: "POST", headers: auth, body: JSON.stringify({ graph_version: "22" }) });
    expect(r.status).toBe(400);
  });
  it("一鍵登記 Webhook 會對 page 與 instagram 各呼叫一次", async () => {
    graphCalls.length = 0;
    const r = await fetch(`${base}/api/webhook/register`, { method: "POST", headers: auth });
    const j = (await r.json()) as { results: { page: { ok: boolean }; instagram: { ok: boolean } } };
    expect(j.results.page.ok).toBe(true);
    expect(j.results.instagram.ok).toBe(true);
    expect(graphCalls.filter((c) => c.includes("/APP123/subscriptions"))).toHaveLength(2);
  });
});

describe("Facebook 登入連接粉絲專頁", () => {
  it("完整 OAuth → 選擇專頁 → 自動訂閱與設定開始使用", async () => {
    const login = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: "pw" }) });
    const session = login.headers.get("set-cookie")!.split(";")[0];

    // 1. 開始授權：應導向 facebook 並種下 state cookie
    const start = await fetch(`${base}/auth/facebook`, { headers: { cookie: session }, redirect: "manual" });
    expect(start.status).toBe(302);
    const dialog = new URL(start.headers.get("location")!);
    expect(dialog.hostname).toBe("www.facebook.com");
    expect(dialog.searchParams.get("client_id")).toBe("APP123");
    expect(dialog.searchParams.get("redirect_uri")).toBe("https://bot.example.com/auth/facebook/callback");
    const state = dialog.searchParams.get("state")!;
    const stateCookie = start.headers.get("set-cookie")!.split(";")[0];

    // 2. 回呼：換權杖、列專頁、導到選擇頁
    const cb = await fetch(`${base}/auth/facebook/callback?code=CODE&state=${state}`, {
      headers: { cookie: `${session}; ${stateCookie}` },
      redirect: "manual",
    });
    expect(cb.status).toBe(302);
    const loc = cb.headers.get("location")!;
    expect(loc.startsWith("/#channels/connect/")).toBe(true);
    const pendingId = loc.split("/").pop()!;

    // state 不符要被拒絕
    const bad = await fetch(`${base}/auth/facebook/callback?code=CODE&state=wrong`, { headers: { cookie: `${session}; ${stateCookie}` }, redirect: "manual" });
    expect(bad.headers.get("location")!.includes("error=")).toBe(true);

    // 3. 列出可連接的專頁
    const pages = (await (await fetch(`${base}/api/facebook/pending/${pendingId}`, { headers: auth })).json()) as { id: string; instagram: unknown }[];
    expect(pages.map((p) => p.id)).toEqual(["PAGE_A", "PAGE_B"]);

    // 4. 連接 A 專頁（含 IG）
    graphCalls.length = 0;
    const r = await fetch(`${base}/api/facebook/connect`, { method: "POST", headers: auth, body: JSON.stringify({ pending_id: pendingId, page_ids: ["PAGE_A"] }) });
    const j = (await r.json()) as { results: { subscribed: boolean; get_started: boolean; instagram: string | null }[] };
    expect(j.results[0]).toMatchObject({ subscribed: true, get_started: true, instagram: "a_shop" });
    expect(graphCalls.some((c) => c.includes("/PAGE_A/subscribed_apps"))).toBe(true);
    expect(graphCalls.some((c) => c.includes("/me/messenger_profile"))).toBe(true);

    const fb = channels.byExternalId(db, "PAGE_A")!;
    expect(fb.platform).toBe("messenger");
    expect(fb.access_token).toBe("PAGE_A_TOKEN");
    const ig = channels.byExternalId(db, "IG_A")!;
    expect(ig.platform).toBe("instagram");
    expect(ig.name).toBe("@a_shop");
    expect(ig.access_token).toBe("PAGE_A_TOKEN");

    // pending 用過即失效
    const gone = await fetch(`${base}/api/facebook/pending/${pendingId}`, { headers: auth });
    expect(gone.status).toBe(404);
  });
});

describe("廣告點擊 → 自動回覆 → 導購連結（核心流程）", () => {
  let automationId = 0;

  it("建立自動化", async () => {
    const r = await fetch(`${base}/api/automations`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        name: "廣告接待",
        trigger_type: "any_ad",
        priority: 5,
        steps: [
          { type: "text", text: "{{first_name}} 你好！" },
          { type: "buttons", text: "點這裡前往", buttons: [{ type: "url", title: "前往官網", url: "https://shop.example.com/landing?utm=ad" }] },
          { type: "tag", tag: "ad-lead" },
        ],
      }),
    });
    expect(r.status).toBe(201);
    automationId = ((await r.json()) as { id: number }).id;
  });

  it("驗證錯誤的自動化會被拒絕", async () => {
    const r = await fetch(`${base}/api/automations`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ name: "bad", trigger_type: "ad", trigger_value: "", steps: [] }),
    });
    expect(r.status).toBe(400);
    const r2 = await fetch(`${base}/api/automations`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ name: "bad url", trigger_type: "any_ad", steps: [{ type: "buttons", text: "x", buttons: [{ type: "url", title: "go", url: "https://" }] }] }),
    });
    expect(r2.status).toBe(400);
  });

  it("收到廣告 referral 後送出兩則訊息、建立聯絡人與追蹤連結", async () => {
    sender.sent.length = 0;
    const r = await postWebhook({
      object: "page",
      entry: [
        {
          id: PAGE_ID,
          messaging: [
            {
              sender: { id: "USER_A" },
              recipient: { id: PAGE_ID },
              timestamp: 1700000000001,
              postback: { title: "開始使用", payload: "GET_STARTED", referral: { ref: "spring", source: "ADS", type: "OPEN_THREAD", ad_id: "AD777" } },
            },
          ],
        },
      ],
    });
    expect(r.status).toBe(200);
    expect(await r.text()).toBe("EVENT_RECEIVED");
    await sleep(50);

    expect(sender.sent).toHaveLength(2);
    expect(sender.sent[0].recipientId).toBe("USER_A");
    expect(sender.sent[0].message.text).toBe("測試 你好！");

    const tmpl = sender.sent[1].message as { attachment: { payload: { buttons: { type: string; url: string; title: string }[] } } };
    const btn = tmpl.attachment.payload.buttons[0];
    expect(btn.type).toBe("web_url");
    expect(btn.title).toBe("前往官網");
    expect(btn.url.startsWith("https://bot.example.com/r/")).toBe(true);

    const contact = contacts.find(db, 1, "USER_A")!;
    expect(contact.source_ad_id).toBe("AD777");
    expect(contact.source_ref).toBe("spring");
    expect(contact.source_automation_id).toBe(automationId);
    expect(contact.tags).toEqual(["ad-lead"]);
    expect(automations.get(db, automationId)!.triggered_count).toBe(1);

    const slug = btn.url.split("/r/")[1].split("?")[0];
    const redirect = await fetch(btn.url.replace("https://bot.example.com", base), { redirect: "manual" });
    expect(redirect.status).toBe(302);
    expect(redirect.headers.get("location")).toBe("https://shop.example.com/landing?utm=ad");
    expect(links.bySlug(db, slug)!.clicks).toBe(1);
  });

  it("Meta 重送同一事件不會重複回覆", async () => {
    sender.sent.length = 0;
    await postWebhook({
      object: "page",
      entry: [
        {
          id: PAGE_ID,
          messaging: [
            {
              sender: { id: "USER_A" },
              recipient: { id: PAGE_ID },
              timestamp: 1700000000001,
              postback: { title: "開始使用", payload: "GET_STARTED", referral: { ref: "spring", source: "ADS", type: "OPEN_THREAD", ad_id: "AD777" } },
            },
          ],
        },
      ],
    });
    await sleep(30);
    expect(sender.sent).toHaveLength(0);
  });

  it("模擬 API 不會真的送訊息也不會建立聯絡人", async () => {
    sender.sent.length = 0;
    const r = await fetch(`${base}/api/simulate`, { method: "POST", headers: auth, body: JSON.stringify({ platform: "messenger", ad_id: "ANY" }) });
    const j = (await r.json()) as { matched: { id: number } | null; messages: unknown[] };
    expect(j.matched?.id).toBe(automationId);
    expect(j.messages).toHaveLength(2);
    expect(sender.sent).toHaveLength(0);
    expect(contacts.find(db, 1, "SIMULATED_USER")).toBeUndefined();
  });

  it("一般訊息沒命中任何規則時不回覆，但仍記錄聯絡人", async () => {
    sender.sent.length = 0;
    await postWebhook({
      object: "page",
      entry: [{ id: PAGE_ID, messaging: [{ sender: { id: "USER_B" }, recipient: { id: PAGE_ID }, timestamp: 5, message: { mid: "x", text: "哈囉" } }] }],
    });
    await sleep(30);
    expect(sender.sent).toHaveLength(0);
    expect(contacts.find(db, 1, "USER_B")).toBeDefined();
  });
});

describe("對外網址自動判斷", () => {
  it("未設定 public_url 時用請求的 X-Forwarded-* 推算", async () => {
    settingsStore.remove(db, KEYS.publicUrl);
    const r = await fetch(`${base}/api/overview`, { headers: { ...auth, "x-forwarded-proto": "https", "x-forwarded-host": "go.lakeze.com" } });
    const j = (await r.json()) as { webhook_url: string };
    expect(j.webhook_url).toBe("https://go.lakeze.com/webhook");
    settingsStore.set(db, KEYS.publicUrl, "https://bot.example.com");
  });
});
