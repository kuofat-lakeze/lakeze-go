import { Router } from "express";
import type { DB, AutomationInput } from "../db.js";
import { automations, channels, contacts, events, links, platformStats, settingsStore, stats, users } from "../db.js";
import type { IncomingEvent, Platform, Step, TriggerType } from "../types.js";
import { createCaptureSender, type Sender } from "../meta/sendApi.js";
import { runAutomation } from "../engine/runner.js";
import { matchAutomation } from "../engine/matcher.js";
import { parseWebhook } from "../meta/parser.js";
import { handleIncomingEvent } from "../engine/handler.js";
import { allowSignup, appName, KEYS, metaConfig, payuniConfig, resolvePublicUrl, trialDays } from "../settings.js";
import { listAppWebhooks, registerAppWebhook, setGetStarted, subscribePage, WEBHOOK_FIELDS } from "../meta/graph.js";
import { callbackUrl, clearPending, getPending } from "./facebook.js";
import { publicUser, requireOwner, userOf } from "./auth.js";
import { subscriptionStatus } from "../billing/subscription.js";
import { HttpError } from "./errors.js";

export interface ApiOptions {
  db: DB;
  sender: Sender;
  fetchImpl: typeof fetch;
}

const TRIGGER_TYPES: TriggerType[] = ["ad", "ref", "any_ad", "keyword", "postback", "get_started", "default"];
const PLATFORMS = ["any", "messenger", "instagram"] as const;

const mask = (t: string) => (t.length > 10 ? `${t.slice(0, 6)}…${t.slice(-4)}` : t ? "••••" : "");
function maskChannel<T extends { access_token: string }>(c: T) {
  return { ...c, access_token: mask(c.access_token) };
}

export function apiRouter(opts: ApiOptions): Router {
  const { db, fetchImpl } = opts;
  const router = Router();

  router.get("/overview", (req, res) => {
    const u = userOf(res);
    const cfg = metaConfig(db);
    res.json({
      stats: stats(db, u.id),
      subscription: subscriptionStatus(u),
      app_configured: !!(cfg.appId && cfg.appSecret),
      payuni_configured: payuniConfig(db) !== null,
      channels: channels.list(db, u.id).map(maskChannel),
      public_url: resolvePublicUrl(db, req),
      platform: u.role === "owner" ? platformStats(db) : null,
    });
  });

  /* ---- 平台設定（擁有者） ---- */
  router.get("/settings", requireOwner, (req, res) => {
    const cfg = metaConfig(db);
    const pu = payuniConfig(db);
    res.json({
      app_name: appName(db),
      allow_signup: allowSignup(db),
      trial_days: trialDays(db),
      meta_app_id: cfg.appId,
      meta_app_secret_masked: mask(cfg.appSecret),
      meta_app_secret_set: !!cfg.appSecret,
      verify_token: cfg.verifyToken,
      graph_version: cfg.graphVersion,
      public_url: settingsStore.get(db, KEYS.publicUrl) ?? "",
      resolved_public_url: resolvePublicUrl(db, req),
      webhook_url: `${resolvePublicUrl(db, req)}/webhook`,
      oauth_redirect_url: callbackUrl(db, req),
      webhook_fields: WEBHOOK_FIELDS,
      payuni_mer_id: settingsStore.get(db, KEYS.payuniMerId) ?? "",
      payuni_hash_key_set: !!settingsStore.get(db, KEYS.payuniHashKey),
      payuni_hash_iv_set: !!settingsStore.get(db, KEYS.payuniHashIv),
      payuni_sandbox: pu ? pu.sandbox : (settingsStore.get(db, KEYS.payuniSandbox) ?? "1") !== "0",
      payuni_notify_url: `${resolvePublicUrl(db, req)}/payuni/notify`,
      payuni_return_url: `${resolvePublicUrl(db, req)}/payuni/return`,
    });
  });
  router.post("/settings", requireOwner, (req, res) => {
    const b = req.body ?? {};
    const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    if ("app_name" in b) settingsStore.set(db, KEYS.appName, str(b.app_name) || "Lakeze Go");
    if ("allow_signup" in b) settingsStore.set(db, KEYS.allowSignup, b.allow_signup ? "1" : "0");
    if ("trial_days" in b) {
      const n = Number(b.trial_days);
      if (!Number.isInteger(n) || n < 0 || n > 365) throw new HttpError(400, "試用天數需為 0 到 365");
      settingsStore.set(db, KEYS.trialDays, String(n));
    }
    if ("meta_app_id" in b) settingsStore.set(db, KEYS.metaAppId, str(b.meta_app_id));
    if (str(b.meta_app_secret)) settingsStore.set(db, KEYS.metaAppSecret, str(b.meta_app_secret));
    if (str(b.verify_token)) settingsStore.set(db, KEYS.verifyToken, str(b.verify_token));
    if (str(b.graph_version)) {
      if (!/^v\d+\.\d+$/.test(str(b.graph_version))) throw new HttpError(400, "Graph API 版本格式應為 v21.0 這種形式");
      settingsStore.set(db, KEYS.graphVersion, str(b.graph_version));
    }
    if ("public_url" in b) {
      const u = str(b.public_url).replace(/\/+$/, "");
      if (u && !/^https?:\/\//i.test(u)) throw new HttpError(400, "對外網址需以 http(s):// 開頭");
      if (u) settingsStore.set(db, KEYS.publicUrl, u);
      else settingsStore.remove(db, KEYS.publicUrl);
    }
    if ("payuni_mer_id" in b) settingsStore.set(db, KEYS.payuniMerId, str(b.payuni_mer_id));
    if (str(b.payuni_hash_key)) {
      if (str(b.payuni_hash_key).length !== 32) throw new HttpError(400, "PayUni HashKey 必須是 32 字元");
      settingsStore.set(db, KEYS.payuniHashKey, str(b.payuni_hash_key));
    }
    if (str(b.payuni_hash_iv)) {
      if (str(b.payuni_hash_iv).length !== 16) throw new HttpError(400, "PayUni HashIV 必須是 16 字元");
      settingsStore.set(db, KEYS.payuniHashIv, str(b.payuni_hash_iv));
    }
    if ("payuni_sandbox" in b) settingsStore.set(db, KEYS.payuniSandbox, b.payuni_sandbox ? "1" : "0");
    res.json({ ok: true });
  });

  router.post("/webhook/register", requireOwner, async (req, res) => {
    const cfg = metaConfig(db);
    if (!cfg.appId || !cfg.appSecret) throw new HttpError(400, "請先填入 Meta App ID 與 App Secret");
    const url = `${resolvePublicUrl(db, req)}/webhook`;
    const results: Record<string, { ok: boolean; error?: string }> = {};
    for (const object of ["page", "instagram"] as const) {
      try {
        await registerAppWebhook(cfg, object, url, fetchImpl);
        results[object] = { ok: true };
      } catch (err) {
        results[object] = { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }
    events.log(db, { type: "info", summary: `登記 Webhook ${url}：page ${results.page.ok ? "成功" : "失敗"}、instagram ${results.instagram.ok ? "成功" : "失敗"}` });
    res.json({ url, results });
  });
  router.get("/webhook/status", requireOwner, async (_req, res) => {
    const cfg = metaConfig(db);
    if (!cfg.appId || !cfg.appSecret) throw new HttpError(400, "請先填入 Meta App ID 與 App Secret");
    res.json(await listAppWebhooks(cfg, fetchImpl));
  });

  /* ---- 使用者管理（擁有者） ---- */
  router.get("/users", requireOwner, (_req, res) => {
    res.json(users.list(db).map((u) => ({ ...publicUser(u), channels: channels.list(db, u.id).length, automations: automations.list(db, u.id).length })));
  });

  /* ---- Facebook 連接流程 ---- */
  router.get("/facebook/pending/:id", (req, res) => {
    const u = userOf(res);
    const pages = getPending(String(req.params.id), u.id);
    if (!pages) throw new HttpError(404, "授權資料已過期，請重新連接 Facebook");
    const mine = new Set(channels.list(db, u.id).map((c) => c.external_id));
    res.json(
      pages.map((p) => {
        const other = channels.byExternalId(db, p.id);
        return {
          id: p.id,
          name: p.name,
          instagram: p.instagram ? { id: p.instagram.id, username: p.instagram.username ?? null } : null,
          already_connected: mine.has(p.id),
          connected_by_other: !!other && other.user_id !== u.id,
        };
      }),
    );
  });

  router.post("/facebook/connect", async (req, res) => {
    const u = userOf(res);
    const pendingId = String(req.body?.pending_id ?? "");
    const pages = getPending(pendingId, u.id);
    if (!pages) throw new HttpError(404, "授權資料已過期，請重新連接 Facebook");
    const wanted: string[] = Array.isArray(req.body?.page_ids) ? req.body.page_ids.map(String) : [];
    if (wanted.length === 0) throw new HttpError(400, "請至少選擇一個粉絲專頁");
    const cfg = metaConfig(db);
    const results = [];
    for (const page of pages.filter((p) => wanted.includes(p.id))) {
      const other = channels.byExternalId(db, page.id);
      if (other && other.user_id !== u.id) {
        results.push({ page_id: page.id, name: page.name, subscribed: false, get_started: false, instagram: null, errors: ["這個粉絲專頁已被其他帳號連接"] });
        continue;
      }
      const errors: string[] = [];
      channels.upsert(db, { user_id: u.id, platform: "messenger", external_id: page.id, name: page.name, access_token: page.access_token, instagram_login: 0 });
      let subscribed = false;
      let getStarted = false;
      try {
        await subscribePage(cfg, page.id, page.access_token, fetchImpl);
        subscribed = true;
      } catch (err) {
        errors.push(`訂閱 Webhook 失敗：${err instanceof Error ? err.message : String(err)}`);
      }
      try {
        await setGetStarted(cfg, page.access_token, fetchImpl);
        getStarted = true;
      } catch (err) {
        errors.push(`設定「開始使用」按鈕失敗：${err instanceof Error ? err.message : String(err)}`);
      }
      let instagram: string | null = null;
      if (page.instagram) {
        channels.upsert(db, {
          user_id: u.id,
          platform: "instagram",
          external_id: page.instagram.id,
          name: page.instagram.username ? `@${page.instagram.username}` : `${page.name}（Instagram）`,
          access_token: page.access_token,
          instagram_login: 0,
        });
        instagram = page.instagram.username ?? page.instagram.id;
      }
      events.log(db, { user_id: u.id, type: "info", summary: `已連接粉絲專頁「${page.name}」${instagram ? `與 Instagram ${instagram}` : ""}${errors.length ? `，但有警告：${errors.join("；")}` : ""}` });
      results.push({ page_id: page.id, name: page.name, subscribed, get_started: getStarted, instagram, errors });
    }
    clearPending(pendingId);
    res.json({ results });
  });

  /* ---- channels ---- */
  router.get("/channels", (_req, res) => res.json(channels.list(db, userOf(res).id).map(maskChannel)));
  router.post("/channels", (req, res) => {
    const u = userOf(res);
    const b = req.body ?? {};
    const platform = b.platform as Platform;
    if (platform !== "messenger" && platform !== "instagram") throw new HttpError(400, "platform 必須是 messenger 或 instagram");
    const external_id = String(b.external_id ?? "").trim();
    const access_token = String(b.access_token ?? "").trim();
    if (!external_id) throw new HttpError(400, "請填寫粉絲專頁 ID / IG 帳號 ID");
    const existing = channels.byExternalId(db, external_id);
    if (existing && existing.user_id !== u.id) throw new HttpError(409, "這個 ID 已被其他帳號連接");
    if (!access_token && !existing) throw new HttpError(400, "請填寫存取權杖");
    const ch = channels.upsert(db, {
      user_id: u.id,
      platform,
      external_id,
      name: String(b.name ?? "").trim() || external_id,
      access_token: access_token || existing!.access_token,
      instagram_login: b.instagram_login ? 1 : 0,
    });
    res.json(maskChannel(ch));
  });
  router.delete("/channels/:id", (req, res) => {
    channels.remove(db, Number(req.params.id), userOf(res).id);
    res.json({ ok: true });
  });
  router.post("/channels/:id/test", async (req, res) => {
    const ch = channels.get(db, Number(req.params.id));
    if (!ch || ch.user_id !== userOf(res).id) throw new HttpError(404, "頻道不存在");
    const cfg = metaConfig(db);
    const host = ch.platform === "instagram" && ch.instagram_login ? "graph.instagram.com" : "graph.facebook.com";
    const r = await fetchImpl(`https://${host}/${cfg.graphVersion}/me?fields=id,name`, { headers: { authorization: `Bearer ${ch.access_token}` } });
    const body = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    res.status(r.ok ? 200 : 400).json({ ok: r.ok, result: body });
  });
  router.post("/channels/:id/subscribe", async (req, res) => {
    const ch = channels.get(db, Number(req.params.id));
    if (!ch || ch.user_id !== userOf(res).id) throw new HttpError(404, "頻道不存在");
    if (ch.platform !== "messenger") throw new HttpError(400, "Instagram 頻道透過其綁定的粉絲專頁訂閱即可");
    const cfg = metaConfig(db);
    await subscribePage(cfg, ch.external_id, ch.access_token, fetchImpl);
    await setGetStarted(cfg, ch.access_token, fetchImpl);
    res.json({ ok: true });
  });

  /* ---- automations ---- */
  router.get("/automations", (_req, res) => res.json(automations.list(db, userOf(res).id)));
  router.get("/automations/:id", (req, res) => {
    const a = automations.get(db, Number(req.params.id), userOf(res).id);
    if (!a) throw new HttpError(404, "找不到自動化");
    res.json(a);
  });
  router.post("/automations", (req, res) => {
    res.status(201).json(automations.create(db, validateAutomation(req.body, userOf(res).id)));
  });
  router.put("/automations/:id", (req, res) => {
    const a = automations.update(db, Number(req.params.id), validateAutomation(req.body, userOf(res).id));
    if (!a) throw new HttpError(404, "找不到自動化");
    res.json(a);
  });
  router.patch("/automations/:id/enabled", (req, res) => {
    const u = userOf(res);
    const a = automations.get(db, Number(req.params.id), u.id);
    if (!a) throw new HttpError(404, "找不到自動化");
    const { id: _id, triggered_count: _t, created_at: _c, updated_at: _u, ...rest } = a;
    res.json(automations.update(db, a.id, { ...rest, enabled: req.body?.enabled ? 1 : 0 }));
  });
  router.delete("/automations/:id", (req, res) => {
    automations.remove(db, Number(req.params.id), userOf(res).id);
    res.json({ ok: true });
  });

  /** 模擬：不會真的發訊息，也不會寫入聯絡人 */
  router.post("/simulate", async (req, res) => {
    const u = userOf(res);
    const b = req.body ?? {};
    const platform: Platform = b.platform === "instagram" ? "instagram" : "messenger";
    const event: IncomingEvent = {
      platform,
      channel_external_id: "SIMULATED",
      sender_id: "SIMULATED_USER",
      timestamp: Date.now(),
      kind: b.postback_payload ? "postback" : b.text ? "message" : "referral",
      text: b.text ? String(b.text) : null,
      postback_payload: b.postback_payload ? String(b.postback_payload) : null,
      referral:
        b.ad_id || b.ref
          ? { source: b.ad_id ? "ADS" : "SHORTLINK", type: "OPEN_THREAD", ref: b.ref ? String(b.ref) : null, ad_id: b.ad_id ? String(b.ad_id) : null, ads_context: null }
          : null,
      raw: null,
    };
    const channelRow = channels.list(db, u.id).find((c) => c.platform === platform);
    const match = matchAutomation(event, automations.listEnabled(db, u.id), channelRow?.id ?? null);
    if (!match) {
      res.json({ matched: null, messages: [] });
      return;
    }
    const capture = createCaptureSender();
    await runAutomation(match, {
      db,
      sender: capture,
      publicUrl: resolvePublicUrl(db, req),
      userId: u.id,
      channel: channelRow ?? { id: 0, user_id: u.id, platform, external_id: "SIMULATED", name: "模擬頻道", access_token: "", instagram_login: 0, created_at: "" },
      contact: {
        id: 0,
        user_id: u.id,
        channel_id: channelRow?.id ?? 0,
        platform,
        psid: "SIMULATED_USER",
        first_name: "小明",
        last_name: "王",
        profile_pic: null,
        source_ad_id: null,
        source_ref: null,
        source_automation_id: null,
        tags: [],
        first_seen: "",
        last_seen: "",
      },
      referral: event.referral,
      text: event.text,
      dryRun: true,
      sleep: async () => {},
    });
    res.json({ matched: { id: match.id, name: match.name }, messages: capture.sent.map((s) => s.message) });
  });

  /** 把一段 Meta webhook 原始 JSON 重跑一次（會真的送訊息），擁有者除錯用 */
  router.post("/replay-webhook", requireOwner, async (req, res) => {
    const incoming = parseWebhook(req.body);
    for (const ev of incoming) await handleIncomingEvent(ev, { db, sender: opts.sender, publicUrl: resolvePublicUrl(db, req) });
    res.json({ processed: incoming.length });
  });

  /* ---- contacts / events / links ---- */
  router.get("/contacts", (req, res) => res.json(contacts.list(db, userOf(res).id, Number(req.query.limit ?? 200))));
  router.get("/contacts/:id", (req, res) => {
    const c = contacts.get(db, Number(req.params.id), userOf(res).id);
    if (!c) throw new HttpError(404, "找不到聯絡人");
    res.json({ contact: c, events: events.forContact(db, c.id) });
  });
  router.delete("/contacts/:id", (req, res) => {
    contacts.remove(db, Number(req.params.id), userOf(res).id);
    res.json({ ok: true });
  });
  router.post("/contacts/:id/send", async (req, res) => {
    const u = userOf(res);
    const c = contacts.get(db, Number(req.params.id), u.id);
    if (!c) throw new HttpError(404, "找不到聯絡人");
    const ch = channels.get(db, c.channel_id);
    if (!ch) throw new HttpError(400, "聯絡人所屬頻道已移除");
    if (!subscriptionStatus(u).active) throw new HttpError(402, "方案已到期，請先續約");
    const text = String(req.body?.text ?? "").trim();
    if (!text) throw new HttpError(400, "請輸入訊息");
    await opts.sender.send(ch, c.psid, { text });
    events.log(db, { user_id: u.id, channel_id: ch.id, contact_id: c.id, type: "sent", summary: `手動送出：${text.slice(0, 60)}` });
    res.json({ ok: true });
  });

  router.get("/events", (req, res) => {
    const u = userOf(res);
    const all = u.role === "owner" && req.query.scope === "all";
    res.json(events.list(db, all ? null : u.id, Number(req.query.limit ?? 200)));
  });
  router.get("/links", (_req, res) => res.json(links.list(db, userOf(res).id)));

  return router;
}

export function validateAutomation(body: unknown, userId: number): AutomationInput {
  const b = (body ?? {}) as Record<string, unknown>;
  const name = String(b.name ?? "").trim();
  if (!name) throw new HttpError(400, "請填寫名稱");
  const trigger_type = b.trigger_type as TriggerType;
  if (!TRIGGER_TYPES.includes(trigger_type)) throw new HttpError(400, "觸發類型不正確");
  const trigger_value = String(b.trigger_value ?? "").trim();
  if (["ad", "ref", "keyword", "postback"].includes(trigger_type) && !trigger_value) {
    throw new HttpError(400, "此觸發類型需要填寫觸發條件（廣告 ID / ref / 關鍵字 / payload）");
  }
  const platform = (PLATFORMS as readonly string[]).includes(String(b.platform)) ? (b.platform as "any" | Platform) : "any";
  const channel_id = b.channel_id === null || b.channel_id === undefined || b.channel_id === "" ? null : Number(b.channel_id);
  const steps = validateSteps(b.steps);
  if (steps.length === 0) throw new HttpError(400, "至少要有一個回覆步驟");
  return {
    user_id: userId,
    name,
    enabled: b.enabled === false || b.enabled === 0 ? 0 : 1,
    priority: Number.isFinite(Number(b.priority)) ? Number(b.priority) : 0,
    platform,
    channel_id: Number.isInteger(channel_id) ? channel_id : null,
    trigger_type,
    trigger_value,
    steps,
  };
}

function validateSteps(raw: unknown): Step[] {
  if (!Array.isArray(raw)) throw new HttpError(400, "steps 必須是陣列");
  return raw.map((s, i): Step => {
    const o = (s ?? {}) as Record<string, unknown>;
    const where = `步驟 ${i + 1}`;
    switch (o.type) {
      case "text": {
        const text = String(o.text ?? "").trim();
        if (!text) throw new HttpError(400, `${where}：文字不可空白`);
        return { type: "text", text };
      }
      case "buttons": {
        const text = String(o.text ?? "").trim();
        if (!text) throw new HttpError(400, `${where}：按鈕訊息的文字不可空白`);
        const buttons = Array.isArray(o.buttons) ? o.buttons : [];
        if (buttons.length === 0 || buttons.length > 3) throw new HttpError(400, `${where}：按鈕需 1 到 3 個`);
        return {
          type: "buttons",
          text,
          buttons: buttons.map((btn: Record<string, unknown>, j: number) => {
            const title = String(btn.title ?? "").trim();
            if (!title) throw new HttpError(400, `${where} 按鈕 ${j + 1}：請填標題`);
            if (btn.type === "postback") {
              const payload = String(btn.payload ?? "").trim();
              if (!payload) throw new HttpError(400, `${where} 按鈕 ${j + 1}：請填 payload`);
              return { type: "postback", title, payload };
            }
            const url = String(btn.url ?? "").trim();
            if (!/^https?:\/\/.+/i.test(url)) throw new HttpError(400, `${where} 按鈕 ${j + 1}：請填完整網址（http(s):// 開頭）`);
            return { type: "url", title, url, track: btn.track !== false };
          }),
        };
      }
      case "quick_replies": {
        const text = String(o.text ?? "").trim();
        if (!text) throw new HttpError(400, `${where}：文字不可空白`);
        const replies = Array.isArray(o.replies) ? o.replies : [];
        if (replies.length === 0) throw new HttpError(400, `${where}：至少一個快速回覆`);
        return {
          type: "quick_replies",
          text,
          replies: replies.map((r: Record<string, unknown>) => ({ title: String(r.title ?? "").trim(), payload: String(r.payload ?? r.title ?? "").trim() })),
        };
      }
      case "image": {
        const url = String(o.url ?? "").trim();
        if (!/^https?:\/\/.+/i.test(url)) throw new HttpError(400, `${where}：圖片網址需以 http(s):// 開頭`);
        return { type: "image", url };
      }
      case "delay":
        return { type: "delay", seconds: Math.max(0, Number(o.seconds) || 0) };
      case "tag": {
        const tag = String(o.tag ?? "").trim();
        if (!tag) throw new HttpError(400, `${where}：標籤不可空白`);
        return { type: "tag", tag };
      }
      case "goto": {
        const id = Number(o.automation_id);
        if (!Number.isInteger(id)) throw new HttpError(400, `${where}：請選擇要跳轉的自動化`);
        return { type: "goto", automation_id: id };
      }
      default:
        throw new HttpError(400, `${where}：不支援的步驟類型 ${String(o.type)}`);
    }
  });
}
