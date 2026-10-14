import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { createApp } from "../src/app.js";
import { openDb, channels, contacts, automations, links, settingsStore, users, plans, orders } from "../src/db.js";
import { createCaptureSender } from "../src/meta/sendApi.js";
import { signBody } from "../src/meta/signature.js";
import { KEYS } from "../src/settings.js";
import { encrypt, hashInfo, toQueryString } from "../src/billing/payuni.js";

const APP_SECRET = "secret123";
const PAGE_ID = "PAGE1";
const PAYUNI = { merId: "SHOP1", hashKey: "12345678901234567890123456789012", hashIv: "1234567890123456", sandbox: true };
const db = openDb(":memory:");
const sender = createCaptureSender();

/** 假的 Graph API */
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

    const pages = (await call("alice", "GET", `/facebook/pending/${pendingId}`)).body as unknown as { id: string }[];
    expect(pages.map((p) => p.id)).toEqual(["PAGE_A", "PAGE_B"]);
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
    expect((await call("bob", "GET", "/automations")).body).toEqual([]);
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
