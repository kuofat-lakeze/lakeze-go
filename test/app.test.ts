import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { createApp } from "../src/app.js";
import { openDb, channels, contacts, automations, links, settingsStore, users, plans, orders } from "../src/db.js";
import { createCaptureSender, SendError, type Sender } from "../src/meta/sendApi.js";
import { createHmac } from "node:crypto";
import { handleIncomingEvent } from "../src/engine/handler.js";
import { stripVariables } from "../src/engine/adJson.js";
import { signBody } from "../src/meta/signature.js";
import { KEYS } from "../src/settings.js";
import { encrypt, hashInfo, toQueryString } from "../src/billing/payuni.js";
import { EXAMPLES, seedExamplesForExistingUsers } from "../src/examples.js";

const APP_SECRET = "secret123";
const PAGE_ID = "PAGE1";
const PAYUNI = { merId: "SHOP1", hashKey: "12345678901234567890123456789012", hashIv: "1234567890123456", sandbox: true };
const db = openDb(":memory:");
const sender = createCaptureSender();

/** 假的 Graph API */
const graphCalls: string[] = [];
/** 授權時客人實際允許的權限（測試可改） */
let grantedPerms = ["pages_show_list", "pages_messaging", "pages_manage_metadata", "pages_read_engagement", "business_management", "instagram_basic", "instagram_manage_messages"];
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
  if (url.includes("/me/permissions")) {
    const all = ["pages_show_list", "pages_messaging", "pages_manage_metadata", "instagram_basic", "instagram_manage_messages", "ads_read"];
    return json({ data: all.map((permission) => ({ permission, status: grantedPerms.includes(permission) ? "granted" : "declined" })) });
  }
  if (url.includes("/me/adaccounts")) return json({ data: [{ id: "act_1", name: "主要廣告帳號" }] });
  if (url.includes("/act_1/ads")) return json({ data: [{ id: "AD777", name: "秋季新品", effective_status: "ACTIVE", campaign: { name: "秋季活動" } }] });
  if (url.includes("/subscribed_apps") && (init?.method ?? "GET") === "GET") {
    return json({ data: [{ id: "APP123", subscribed_fields: ["messages", "messaging_postbacks", "messaging_referrals", "messaging_optins"] }] });
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
const json = { "content-type": "application/json" };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 每個測試身分一個 cookie */
const sessions: Record<string, string> = {};
async function signup(key: string, email: string, password = "password123") {
  const r = await fetch(`${base}/api/auth/signup`, { method: "POST", headers: json, body: JSON.stringify({ email, password, name: key }) });
  if (r.status !== 201) throw new Error(`signup ${email} failed: ${r.status} ${await r.text()}`);
  sessions[key] = r.headers.get("set-cookie")!.split(";")[0];
  return (await r.json()) as { user: { id: number; role: string; subscription: { source: string; active: boolean } } };
}
const as = (key: string) => ({ ...json, cookie: sessions[key] });
async function call(key: string, method: string, path: string, body?: unknown) {
  const r = await fetch(`${base}/api${path}`, { method, headers: as(key), body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, body: (await r.json().catch(() => ({}))) as Record<string, unknown> & Record<string, never> };
}

beforeAll(async () => {
  settingsStore.set(db, KEYS.sessionSecret, "test-secret");
  settingsStore.set(db, KEYS.verifyToken, "verify-me");
  settingsStore.set(db, KEYS.metaAppId, "APP123");
  settingsStore.set(db, KEYS.metaAppSecret, APP_SECRET);
  settingsStore.set(db, KEYS.publicUrl, "https://bot.example.com");
  settingsStore.set(db, KEYS.payuniMerId, PAYUNI.merId);
  settingsStore.set(db, KEYS.payuniHashKey, PAYUNI.hashKey);
  settingsStore.set(db, KEYS.payuniHashIv, PAYUNI.hashIv);
  settingsStore.set(db, KEYS.trialDays, "14");
  plans.seedDefaults(db);
  await new Promise<void>((r) => {
    server = app.listen(0, () => r());
  });
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
});
afterAll(() => server.close());

async function postWebhook(body: unknown, sign = true) {
  const raw = JSON.stringify(body);
  return fetch(`${base}/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(sign ? { "x-hub-signature-256": signBody(APP_SECRET, raw) } : {}) },
    body: raw,
  });
}
const adEvent = (sender_id: string, timestamp: number) => ({
  object: "page",
  entry: [
    {
      id: PAGE_ID,
      messaging: [
        {
          sender: { id: sender_id },
          recipient: { id: PAGE_ID },
          timestamp,
          postback: { title: "開始使用", payload: "GET_STARTED", referral: { ref: "spring", source: "ADS", type: "OPEN_THREAD", ad_id: "AD777" } },
        },
      ],
    },
  ],
});

describe("註冊 / 登入 / 角色", () => {
  it("第一位註冊者是擁有者且不受方案限制", async () => {
    const me0 = (await (await fetch(`${base}/api/auth/me`)).json()) as { needs_setup: boolean };
    expect(me0.needs_setup).toBe(true);
    const r = await signup("owner", "owner@example.com");
    expect(r.user.role).toBe("owner");
    expect(r.user.subscription.source).toBe("owner");
  });
  it("第二位註冊者是一般用戶並獲得試用", async () => {
    const r = await signup("alice", "alice@example.com");
    expect(r.user.role).toBe("member");
    expect(r.user.subscription).toMatchObject({ source: "trial", active: true });
    const u = users.byEmail(db, "alice@example.com")!;
    expect(new Date(u.trial_until!).getTime()).toBeGreaterThan(Date.now() + 13 * 86400000);
  });
  it("重複 Email、短密碼、錯誤登入都被拒絕", async () => {
    const dup = await fetch(`${base}/api/auth/signup`, { method: "POST", headers: json, body: JSON.stringify({ email: "alice@example.com", password: "password123" }) });
    expect(dup.status).toBe(409);
    const short = await fetch(`${base}/api/auth/signup`, { method: "POST", headers: json, body: JSON.stringify({ email: "x@example.com", password: "short" }) });
    expect(short.status).toBe(400);
    const bad = await fetch(`${base}/api/auth/login`, { method: "POST", headers: json, body: JSON.stringify({ email: "alice@example.com", password: "wrong" }) });
    expect(bad.status).toBe(401);
    const ok = await fetch(`${base}/api/auth/login`, { method: "POST", headers: json, body: JSON.stringify({ email: "alice@example.com", password: "password123" }) });
    expect(ok.status).toBe(200);
  });
  it("未登入拒絕；一般用戶不能看平台設定", async () => {
    expect((await fetch(`${base}/api/automations`)).status).toBe(401);
    expect((await call("alice", "GET", "/settings")).status).toBe(403);
    expect((await call("owner", "GET", "/settings")).status).toBe(200);
  });
  it("關閉註冊後新用戶不能註冊", async () => {
    await call("owner", "POST", "/settings", { allow_signup: false });
    const r = await fetch(`${base}/api/auth/signup`, { method: "POST", headers: json, body: JSON.stringify({ email: "late@example.com", password: "password123" }) });
    expect(r.status).toBe(403);
    await call("owner", "POST", "/settings", { allow_signup: true });
  });
});

describe("webhook 驗證", () => {
  it("GET 驗證成功回 challenge；token 錯誤 403；POST 無簽章 401", async () => {
    const r = await fetch(`${base}/webhook?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=abc`);
    expect(await r.text()).toBe("abc");
    expect((await fetch(`${base}/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=abc`)).status).toBe(403);
    expect((await postWebhook({ object: "page", entry: [] }, false)).status).toBe(401);
  });
});

describe("Facebook 連接（多用戶）", () => {
  it("alice 走完 OAuth 並連接 A 專頁；bob 看不到也連不了同一專頁", async () => {
    const start = await fetch(`${base}/auth/facebook`, { headers: { cookie: sessions.alice }, redirect: "manual" });
    expect(start.status).toBe(302);
    const dialog = new URL(start.headers.get("location")!);
    expect(dialog.searchParams.get("client_id")).toBe("APP123");
    const state = dialog.searchParams.get("state")!;
    const stateCookie = start.headers.get("set-cookie")!.split(";")[0];
    const cb = await fetch(`${base}/auth/facebook/callback?code=CODE&state=${state}`, { headers: { cookie: `${sessions.alice}; ${stateCookie}` }, redirect: "manual" });
    const pendingId = cb.headers.get("location")!.split("/").pop()!;

    await signup("bob", "bob@example.com");
    expect((await call("bob", "GET", `/facebook/pending/${pendingId}`)).status).toBe(404);

    const pend = (await call("alice", "GET", `/facebook/pending/${pendingId}`)).body as unknown as { pages: { id: string }[]; missing: unknown[] };
    expect(pend.pages.map((p) => p.id)).toEqual(["PAGE_A", "PAGE_B"]);
    expect(pend.missing).toEqual([]);
    const r = await call("alice", "POST", "/facebook/connect", { pending_id: pendingId, page_ids: ["PAGE_A"] });
    expect((r.body.results as { subscribed: boolean; instagram: string }[])[0]).toMatchObject({ subscribed: true, instagram: "a_shop" });
    expect(channels.byExternalId(db, "PAGE_A")!.user_id).toBe(users.byEmail(db, "alice@example.com")!.id);
    expect(channels.byExternalId(db, "IG_A")!.platform).toBe("instagram");

    // bob 手動新增同一個 ID 會被擋
    const dup = await call("bob", "POST", "/channels", { platform: "messenger", external_id: "PAGE_A", access_token: "x" });
    expect(dup.status).toBe(409);
    expect((await call("bob", "GET", "/channels")).body).toEqual([]);
  });
});

describe("廣告點擊 → 自動回覆 → 導購（資料隔離）", () => {
  let aliceAutomation = 0;
  it("alice 連接 PAGE1 並建立自動化；bob 看不到", async () => {
    const alice = users.byEmail(db, "alice@example.com")!;
    channels.upsert(db, { user_id: alice.id, platform: "messenger", external_id: PAGE_ID, name: "測試專頁", access_token: "tok", instagram_login: 0 });
    const r = await call("alice", "POST", "/automations", {
      name: "廣告接待",
      trigger_type: "any_ad",
      steps: [
        { type: "text", text: "{{first_name}} 你好！" },
        { type: "buttons", text: "點這裡前往", buttons: [{ type: "url", title: "前往官網", url: "https://shop.example.com/landing" }] },
        { type: "tag", tag: "ad-lead" },
      ],
    });
    expect(r.status).toBe(201);
    aliceAutomation = r.body.id as number;
    const bobId = users.byEmail(db, "bob@example.com")!.id;
    const bobList = (await call("bob", "GET", "/automations")).body as unknown as { id: number; user_id: number; is_example: number }[];
    expect(bobList.length).toBe(EXAMPLES.length);
    expect(bobList.every((x) => x.user_id === bobId && x.is_example === 1)).toBe(true);
    expect(bobList.some((x) => x.id === aliceAutomation)).toBe(false);
    expect((await call("bob", "GET", `/automations/${aliceAutomation}`)).status).toBe(404);
  });

  it("廣告 referral 進來 → 送兩則訊息、建立 alice 的聯絡人與追蹤連結", async () => {
    sender.sent.length = 0;
    const r = await postWebhook(adEvent("USER_A", 1700000000001));
    expect(await r.text()).toBe("EVENT_RECEIVED");
    await sleep(50);
    expect(sender.sent).toHaveLength(2);
    expect(sender.sent[0].message.text).toBe("測試 你好！");
    const btn = (sender.sent[1].message as { attachment: { payload: { buttons: { url: string }[] } } }).attachment.payload.buttons[0];
    expect(btn.url.startsWith("https://bot.example.com/r/")).toBe(true);

    const ch = channels.byExternalId(db, PAGE_ID)!;
    const contact = contacts.find(db, ch.id, "USER_A")!;
    expect(contact.user_id).toBe(ch.user_id);
    expect(contact.source_ad_id).toBe("AD777");
    expect(contact.tags).toEqual(["ad-lead"]);
    expect(automations.get(db, aliceAutomation)!.triggered_count).toBe(1);

    const slug = btn.url.split("/r/")[1].split("?")[0];
    const redirect = await fetch(btn.url.replace("https://bot.example.com", base), { redirect: "manual" });
    expect(redirect.status).toBe(302);
    expect(redirect.headers.get("location")).toBe("https://shop.example.com/landing");
    expect(links.bySlug(db, slug)!.clicks).toBe(1);

    expect(((await call("alice", "GET", "/contacts")).body as unknown as unknown[]).length).toBe(1);
    expect((await call("bob", "GET", "/contacts")).body).toEqual([]);
    expect((await call("bob", "GET", `/contacts/${contact.id}`)).status).toBe(404);
  });

  it("Meta 重送同一事件不會重複回覆", async () => {
    sender.sent.length = 0;
    await postWebhook(adEvent("USER_A", 1700000000001));
    await sleep(30);
    expect(sender.sent).toHaveLength(0);
  });

  it("alice 方案到期後：事件照記錄但不自動回覆；續約後恢復", async () => {
    const alice = users.byEmail(db, "alice@example.com")!;
    users.setTrialUntil(db, alice.id, new Date(Date.now() - 1000).toISOString());
    sender.sent.length = 0;
    await postWebhook(adEvent("USER_C", 1700000000003));
    await sleep(30);
    expect(sender.sent).toHaveLength(0);
    const ch = channels.byExternalId(db, PAGE_ID)!;
    expect(contacts.find(db, ch.id, "USER_C")).toBeDefined();
    const ev = (await call("alice", "GET", "/events")).body as unknown as { type: string; summary: string }[];
    expect(ev.some((e) => e.type === "warning" && e.summary.includes("方案已到期"))).toBe(true);
    expect((await call("alice", "GET", "/overview")).body.subscription).toMatchObject({ active: false, source: "expired" });

    users.setPaidUntil(db, alice.id, new Date(Date.now() + 30 * 86400000).toISOString());
    await postWebhook(adEvent("USER_D", 1700000000004));
    await sleep(30);
    expect(sender.sent).toHaveLength(2);
  });

  it("模擬 API 不送訊息、不建聯絡人、不建追蹤連結", async () => {
    sender.sent.length = 0;
    const before = links.list(db, users.byEmail(db, "alice@example.com")!.id).length;
    const r = await call("alice", "POST", "/simulate", { platform: "messenger", ad_id: "ANY" });
    expect((r.body.matched as { id: number }).id).toBe(aliceAutomation);
    expect((r.body.messages as unknown[]).length).toBe(2);
    expect(sender.sent).toHaveLength(0);
    expect(links.list(db, users.byEmail(db, "alice@example.com")!.id).length).toBe(before);
  });
});

describe("PayUni 付費流程", () => {
  it("bob 結帳 → 拿到 UPP 表單 → 模擬 PayUni Notify → 方案延長", async () => {
    const bill = (await call("bob", "GET", "/billing")).body;
    expect(bill.payuni_configured).toBe(true);
    const plan = (bill.plans as { id: number; price: number; months: number; code: string }[]).find((p) => p.code === "monthly")!;

    const co = await call("bob", "POST", "/billing/checkout", { plan_id: plan.id });
    expect(co.status).toBe(200);
    expect(co.body.action).toBe("https://sandbox-api.payuni.com.tw/api/upp");
    const fields = co.body.fields as Record<string, string>;
    expect(fields.MerID).toBe("SHOP1");
    expect(fields.HashInfo).toBe(hashInfo(PAYUNI, fields.EncryptInfo));
    const orderNo = co.body.order_no as string;
    expect(orders.byOrderNo(db, orderNo)!.status).toBe("pending");

    // 金額不符要被拒絕
    const wrong = encrypt(PAYUNI, toQueryString({ Status: "SUCCESS", MerTradeNo: orderNo, TradeNo: "T1", TradeAmt: 1, TradeStatus: 1 }));
    const bad = await fetch(`${base}/payuni/notify`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ MerID: "SHOP1", Status: "SUCCESS", EncryptInfo: wrong, HashInfo: hashInfo(PAYUNI, wrong) }) });
    expect(await bad.text()).toBe("金額不符");
    expect(orders.byOrderNo(db, orderNo)!.status).toBe("pending");

    // 正確通知
    const enc = encrypt(PAYUNI, toQueryString({ Status: "SUCCESS", MerTradeNo: orderNo, TradeNo: "16661", TradeAmt: plan.price, TradeStatus: 1, PaymentType: "1" }));
    const notify = await fetch(`${base}/payuni/notify`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ MerID: "SHOP1", Status: "SUCCESS", EncryptInfo: enc, HashInfo: hashInfo(PAYUNI, enc) }) });
    expect(await notify.text()).toBe("SUCCESS");
    const order = orders.byOrderNo(db, orderNo)!;
    expect(order.status).toBe("paid");
    expect(order.payuni_trade_no).toBe("16661");

    const bob = users.byEmail(db, "bob@example.com")!;
    const paidUntil = new Date(bob.paid_until!);
    expect(paidUntil.getTime()).toBeGreaterThan(Date.now() + 27 * 86400000);
    expect((await call("bob", "GET", "/billing")).body.subscription).toMatchObject({ source: "paid", active: true });

    // ReturnURL 用同一包資料再打一次：不會重複入帳，且導回 billing 頁
    const ret = await fetch(`${base}/payuni/return`, { method: "POST", redirect: "manual", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ MerID: "SHOP1", Status: "SUCCESS", EncryptInfo: enc, HashInfo: hashInfo(PAYUNI, enc) }) });
    expect(ret.status).toBe(302);
    expect(ret.headers.get("location")).toBe("/#billing?paid=1");
    expect(new Date(users.byEmail(db, "bob@example.com")!.paid_until!).getTime()).toBe(paidUntil.getTime());
  });

  it("驗章失敗的通知回 400；擁有者可手動延長與管理方案", async () => {
    const r = await fetch(`${base}/payuni/notify`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ Status: "SUCCESS", EncryptInfo: "00", HashInfo: "bad" }) });
    expect(r.status).toBe(400);

    const bob = users.byEmail(db, "bob@example.com")!;
    const before = new Date(bob.paid_until!).getTime();
    expect((await call("bob", "POST", "/billing/grant", { user_id: bob.id, months: 1 })).status).toBe(403);
    const g = await call("owner", "POST", "/billing/grant", { user_id: bob.id, months: 2 });
    expect(g.status).toBe(200);
    expect(new Date(users.get(db, bob.id)!.paid_until!).getTime()).toBeGreaterThan(before + 55 * 86400000);

    const p = await call("owner", "POST", "/billing/plans", { code: "quarterly", name: "季繳", price: 2700, months: 3 });
    expect(p.status).toBe(200);
    expect((await call("owner", "POST", "/billing/plans", { code: "bad", name: "x", price: -1, months: 1 })).status).toBe(400);
    const list = (await call("owner", "GET", "/billing/orders/all")).body as unknown as { email: string }[];
    expect(list.some((o) => o.email === "bob@example.com")).toBe(true);
  });
});

describe("範例自動回覆", () => {
  it("註冊時建立範例，全部不啟用，也不會被觸發", async () => {
    await signup("carol", "carol@example.com");
    const list = (await call("carol", "GET", "/automations")).body as unknown as { id: number; enabled: number; is_example: number; name: string }[];
    expect(list).toHaveLength(EXAMPLES.length);
    expect(list.every((a) => a.enabled === 0 && a.is_example === 1)).toBe(true);
    expect(list.every((a) => a.name.startsWith("【範例】"))).toBe(true);
    // 沒有啟用的規則 → 模擬不會命中任何範例
    const sim = await call("carol", "POST", "/simulate", { platform: "messenger", ad_id: "X" });
    expect(sim.body.matched).toBeNull();
    // 首頁統計不把範例算成「啟用中的自動回覆」
    expect(((await call("carol", "GET", "/overview")).body.stats as { automations: number }).automations).toBe(0);
  });

  it("修改或啟用範例後就變成使用者自己的", async () => {
    const list = (await call("carol", "GET", "/automations")).body as unknown as { id: number; trigger_type: string }[];
    const ad = list.find((a) => a.trigger_type === "any_ad")!;
    const r = await call("carol", "PATCH", `/automations/${ad.id}/enabled`, { enabled: true });
    expect(r.body).toMatchObject({ enabled: 1, is_example: 0 });
    const sim = await call("carol", "POST", "/simulate", { platform: "messenger", ad_id: "X" });
    expect((sim.body.matched as { id: number }).id).toBe(ad.id);
  });

  it("既有帳號只補一次範例", () => {
    const carol = users.byEmail(db, "carol@example.com")!;
    const before = automations.list(db, carol.id).length;
    seedExamplesForExistingUsers(db);
    expect(automations.list(db, carol.id).length).toBe(before);
    db.prepare("UPDATE users SET examples_seeded = 0 WHERE id = ?").run(carol.id);
    seedExamplesForExistingUsers(db);
    expect(automations.list(db, carol.id).length).toBe(before + EXAMPLES.length);
  });
});

/* ---------------- 串接改善 ---------------- */

const echoEvent = (customer: string, timestamp: number, appId?: string) => ({
  object: "page",
  entry: [{ id: PAGE_ID, messaging: [{ sender: { id: PAGE_ID }, recipient: { id: customer }, timestamp, message: { is_echo: true, text: "小編來了", ...(appId ? { app_id: appId } : {}) } }] }],
});
const textEvent = (customer: string, timestamp: number, text: string) => ({
  object: "page",
  entry: [{ id: PAGE_ID, messaging: [{ sender: { id: customer }, recipient: { id: PAGE_ID }, timestamp, message: { mid: `m${timestamp}`, text } }] }],
});
function signedRequest(payload: Record<string, unknown>, secret = APP_SECRET) {
  const b64 = (b: Buffer) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const body = b64(Buffer.from(JSON.stringify({ algorithm: "HMAC-SHA256", ...payload })));
  return `${b64(createHmac("sha256", secret).update(body).digest())}.${body}`;
}

describe("廣告 JSON", () => {
  it("移除個人化變數並整理標點", () => {
    expect(stripVariables("嗨 {{first_name}} 👋 謝謝你！").text).toBe("嗨 👋 謝謝你！");
    expect(stripVariables("{{first_name}} 你好！").text).toBe("你好！");
    expect(stripVariables("歡迎 {{first_name}}，想先了解什麼？").text).toBe("歡迎，想先了解什麼？");
    expect(stripVariables("沒有變數").removed).toBe(false);
  });

  it("產生 JSON：第一則訊息、追蹤連結；開啟後客人從廣告進來不重複送第一則", async () => {
    const alice = users.byEmail(db, "alice@example.com")!;
    const auto = automations.list(db, alice.id).find((a) => a.name === "廣告接待")!;
    // 讓按鈕訊息變成第一則，方便驗證 web_url
    await call("alice", "PUT", `/automations/${auto.id}`, {
      ...auto,
      steps: [
        { type: "buttons", text: "嗨 {{first_name}}，點這裡前往", buttons: [{ type: "url", title: "前往官網", url: "https://shop.example.com/landing" }] },
        { type: "text", text: "有問題直接留言喔" },
        { type: "tag", tag: "ad-lead" },
      ],
    });
    const r = await call("alice", "GET", `/automations/${auto.id}/ad-json`);
    expect(r.status).toBe(200);
    const msg = (r.body.json as { message: { attachment: { payload: { text: string; buttons: { type: string; url: string }[] } } } }).message;
    expect(msg.attachment.payload.text).toBe("嗨，點這裡前往");
    expect(msg.attachment.payload.buttons[0].type).toBe("web_url");
    expect(msg.attachment.payload.buttons[0].url).toMatch(/^https:\/\/bot\.example\.com\/r\/[\w-]+$/);
    expect((r.body.warnings as string[]).some((w) => w.includes("first_name"))).toBe(true);
    expect(r.body.ad_json).toBe(false);

    // 沒開啟前：照常送兩則
    sender.sent.length = 0;
    await postWebhook(adEvent("USER_J1", 1700000000101));
    await sleep(40);
    expect(sender.sent).toHaveLength(2);

    expect((await call("alice", "PATCH", `/automations/${auto.id}/ad-json`, { enabled: true })).body.ad_json).toBe(true);
    sender.sent.length = 0;
    await postWebhook(adEvent("USER_J2", 1700000000102));
    await sleep(40);
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0].message.text).toBe("有問題直接留言喔");
    const ch = channels.byExternalId(db, PAGE_ID)!;
    expect(contacts.find(db, ch.id, "USER_J2")!.tags).toEqual(["ad-lead"]);
    // bob 拿不到 alice 的 JSON
    expect((await call("bob", "GET", `/automations/${auto.id}/ad-json`)).status).toBe(404);
    await call("alice", "PATCH", `/automations/${auto.id}/ad-json`, { enabled: false });
  });
});

describe("小編接手與自動回覆衝突", () => {
  it("小編在收件匣回覆 → 這位客人暫停自動回覆；恢復後照常", async () => {
    const alice = users.byEmail(db, "alice@example.com")!;
    await call("alice", "POST", "/automations", { name: "價格", trigger_type: "keyword", trigger_value: "價格", steps: [{ type: "text", text: "價格在這裡" }] });
    await postWebhook(textEvent("USER_H", 1700000000201, "哈囉"));
    await sleep(30);
    const ch = channels.byExternalId(db, PAGE_ID)!;
    const c = contacts.find(db, ch.id, "USER_H")!;
    // 本平台自己送的 echo 不算
    await postWebhook(echoEvent("USER_H", 1700000000202, "APP123"));
    await sleep(20);
    expect(contacts.get(db, c.id)!.paused_until ?? null).toBeNull();
    // 小編手動回覆（沒有 app_id）
    await postWebhook(echoEvent("USER_H", 1700000000203));
    await sleep(20);
    expect(Date.parse(contacts.get(db, c.id)!.paused_until!)).toBeGreaterThan(Date.now());
    sender.sent.length = 0;
    await postWebhook(textEvent("USER_H", 1700000000204, "請問價格"));
    await sleep(30);
    expect(sender.sent).toHaveLength(0);
    const ev = (await call("alice", "GET", "/events")).body as unknown as { type: string }[];
    expect(ev.some((e) => e.type === "handover")).toBe(true);
    expect(ev.some((e) => e.type === "paused")).toBe(true);

    expect((await call("alice", "POST", `/contacts/${c.id}/resume`)).status).toBe(200);
    await postWebhook(textEvent("USER_H", 1700000000205, "請問價格"));
    await sleep(30);
    expect(sender.sent).toHaveLength(1);
    expect(alice.id).toBe(c.user_id);
  });

  it("我們剛送完就有別的程式回覆 → 記錄為衝突，不暫停", async () => {
    sender.sent.length = 0;
    await postWebhook(textEvent("USER_K", 1700000000301, "價格？"));
    await sleep(30);
    expect(sender.sent).toHaveLength(1);
    await postWebhook(echoEvent("USER_K", 1700000000302, "263902037430900"));
    await sleep(20);
    const ch = channels.byExternalId(db, PAGE_ID)!;
    expect(contacts.find(db, ch.id, "USER_K")!.paused_until ?? null).toBeNull();
    expect(((await call("alice", "GET", "/overview")).body.conflicts_7d as number)).toBeGreaterThan(0);
  });
});

describe("連線健康", () => {
  it("授權時取消勾選必要權限 → 回報缺少的權限", async () => {
    grantedPerms = ["pages_show_list", "pages_manage_metadata"];
    const start = await fetch(`${base}/auth/facebook?rerequest=1`, { headers: { cookie: sessions.alice }, redirect: "manual" });
    const dialog = new URL(start.headers.get("location")!);
    expect(dialog.searchParams.get("auth_type")).toBe("rerequest");
    const stateCookie = start.headers.get("set-cookie")!.split(";")[0];
    const cb = await fetch(`${base}/auth/facebook/callback?code=CODE&state=${dialog.searchParams.get("state")}`, { headers: { cookie: `${sessions.alice}; ${stateCookie}` }, redirect: "manual" });
    const pendingId = cb.headers.get("location")!.split("/").pop()!;
    const pend = (await call("alice", "GET", `/facebook/pending/${pendingId}`)).body as unknown as { missing: { perm: string }[]; missing_instagram: { perm: string }[] };
    expect(pend.missing.map((m) => m.perm)).toEqual(["pages_messaging"]);
    expect(pend.missing_instagram.map((m) => m.perm)).toEqual(["instagram_basic", "instagram_manage_messages"]);
    grantedPerms.push("pages_messaging", "instagram_basic", "instagram_manage_messages");
  });

  it("送出時權杖失效 → 頻道標記需要重新連接；檢查成功後恢復", async () => {
    const broken: Sender = {
      async send() {
        throw new SendError("Graph API 400 (#190): Error validating access token", 400, 190, 460);
      },
      async getProfile() {
        return null;
      },
    };
    await handleIncomingEvent(
      { platform: "messenger", channel_external_id: PAGE_ID, sender_id: "USER_T", timestamp: 1700000000401, kind: "message", text: "價格", postback_payload: null, referral: null, raw: null },
      { db, sender: broken, publicUrl: "https://bot.example.com" },
    );
    const ch = channels.byExternalId(db, PAGE_ID)!;
    expect(ch.status).toBe("broken");
    expect(ch.last_error).toContain("190");
    const r = await call("alice", "POST", `/channels/${ch.id}/test`);
    expect(r.status).toBe(200);
    expect(r.body.resubscribed).toBe(true); // 少了 message_echoes → 自動補訂
    expect(channels.get(db, ch.id)!.status).toBe("ok");
  });

  it("「24 小時外」之類單一客人的錯誤不會把頻道標成失效", async () => {
    const windowErr: Sender = {
      async send() {
        throw new SendError("outside window", 400, 10, 2018278);
      },
      async getProfile() {
        return null;
      },
    };
    await handleIncomingEvent(
      { platform: "messenger", channel_external_id: PAGE_ID, sender_id: "USER_W", timestamp: 1700000000402, kind: "message", text: "價格", postback_payload: null, referral: null, raw: null },
      { db, sender: windowErr, publicUrl: "https://bot.example.com" },
    );
    expect(channels.byExternalId(db, PAGE_ID)!.status).toBe("ok");
  });
});

describe("廣告挑選器", () => {
  it("沒授權讀取廣告 → authorized=false；授權後列出廣告與帶來的聯絡人數", async () => {
    grantedPerms = grantedPerms.filter((p) => p !== "ads_read");
    expect((await call("alice", "GET", "/meta/ads")).body.authorized).toBe(false);
    grantedPerms.push("ads_read");
    const start = await fetch(`${base}/auth/facebook?ads=1&return=%23automations%2Fnew`, { headers: { cookie: sessions.alice }, redirect: "manual" });
    const dialog = new URL(start.headers.get("location")!);
    expect(dialog.searchParams.get("scope")).toContain("ads_read");
    const stateCookie = start.headers.get("set-cookie")!.split(";")[0];
    const cb = await fetch(`${base}/auth/facebook/callback?code=CODE&state=${dialog.searchParams.get("state")}`, { headers: { cookie: `${sessions.alice}; ${stateCookie}` }, redirect: "manual" });
    expect(cb.headers.get("location")).toBe("/#automations/new?ads=granted");
    const r = await call("alice", "GET", "/meta/ads");
    expect(r.body.authorized).toBe(true);
    const ads = r.body.ads as { id: string; name: string; contacts: number }[];
    expect(ads[0]).toMatchObject({ id: "AD777", name: "秋季新品" });
    expect(ads[0].contacts).toBeGreaterThan(0);
  });
});

describe("Meta 上線必備", () => {
  it("隱私權政策、服務條款、資料刪除說明是公開頁面", async () => {
    for (const [path, text] of [["/privacy", "隱私權政策"], ["/terms", "服務條款"], ["/data-deletion", "資料刪除說明"]]) {
      const r = await fetch(`${base}${path}`);
      expect(r.status).toBe(200);
      expect(await r.text()).toContain(text);
    }
  });

  it("有設定 ID 時用 config_id 開授權視窗", async () => {
    await call("owner", "POST", "/settings", { meta_login_config_id: "987654321" });
    const start = await fetch(`${base}/auth/facebook`, { headers: { cookie: sessions.alice }, redirect: "manual" });
    const dialog = new URL(start.headers.get("location")!);
    expect(dialog.searchParams.get("config_id")).toBe("987654321");
    expect(dialog.searchParams.get("scope")).toBeNull();
    expect((await call("owner", "POST", "/settings", { meta_login_config_id: "abc" })).status).toBe(400);
    await call("owner", "POST", "/settings", { meta_login_config_id: "" });
  });

  it("取消授權 → 頻道標記失效；資料刪除 → 刪掉頻道與聯絡人並回傳確認碼", async () => {
    const alice = users.byEmail(db, "alice@example.com")!;
    channels.upsert(db, { user_id: alice.id, platform: "messenger", external_id: "PAGE_DEL", name: "要刪的專頁", access_token: "t", instagram_login: 0, fb_user_id: "FBU1" });
    const ch = channels.byExternalId(db, "PAGE_DEL")!;
    contacts.touch(db, ch, "USER_DEL");
    const form = (sr: string) => ({ method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ signed_request: sr }) });

    expect((await fetch(`${base}/meta/deauthorize`, form(signedRequest({ user_id: "FBU1" }, "wrong")))).status).toBe(400);
    expect((await fetch(`${base}/meta/deauthorize`, form(signedRequest({ user_id: "FBU1" })))).status).toBe(200);
    expect(channels.get(db, ch.id)!.status).toBe("broken");

    const del = await fetch(`${base}/meta/data-deletion`, form(signedRequest({ user_id: "FBU1" })));
    const body = (await del.json()) as { url: string; confirmation_code: string };
    expect(body.url).toBe(`https://bot.example.com/data-deletion?code=${body.confirmation_code}`);
    expect(channels.get(db, ch.id)).toBeUndefined();
    expect(contacts.find(db, ch.id, "USER_DEL")).toBeUndefined();
    const status = await fetch(`${base}/data-deletion?code=${body.confirmation_code}`);
    expect(await status.text()).toContain("刪除要求已處理完成");
  });
});

describe("健康檢查不誤判", () => {
  it("Meta 暫時連不上不會把頻道標成失效；權杖錯誤才會", async () => {
    const { runHealthCheck } = await import("../src/engine/health.js");
    const down: typeof fetch = async () => {
      throw new TypeError("fetch failed");
    };
    await runHealthCheck(db, down);
    expect(channels.byExternalId(db, PAGE_ID)!.status).toBe("ok");
    const expired: typeof fetch = async () => new Response(JSON.stringify({ error: { message: "Error validating access token", code: 190 } }), { status: 400 });
    await runHealthCheck(db, expired);
    expect(channels.byExternalId(db, PAGE_ID)!.status).toBe("broken");
    // 重新檢查成功（假 Graph）→ 恢復
    await runHealthCheck(db, fakeFetch);
    expect(channels.byExternalId(db, PAGE_ID)!.status).toBe("ok");
  });
});
