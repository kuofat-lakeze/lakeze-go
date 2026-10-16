import type { Channel, Contact, IncomingEvent } from "../types.js";
import type { DB } from "../db.js";
import { automations, channels, contacts, events, users } from "../db.js";
import { isConnectionError, type Sender } from "../meta/sendApi.js";
import { isFromAd } from "../meta/parser.js";
import { matchAutomation } from "./matcher.js";
import { runAutomation } from "./runner.js";
import { firstContentStep } from "./adJson.js";
import { subscriptionStatus } from "../billing/subscription.js";
import { metaConfig } from "../settings.js";

export interface HandlerDeps {
  db: DB;
  sender: Sender;
  publicUrl: string;
}

/** 小編在收件匣回覆後，自動回覆暫停多久 */
export const HANDOVER_MINUTES = 30;
/** 我們送出後這麼短的時間內又有別的程式回覆 → 多半是專頁原本的自動回覆，不是真人 */
const CONFLICT_WINDOW_SECONDS = 15;
const AD_TRIGGERS = new Set(["any_ad", "ad", "ref"]);

/** 處理一個正規化後的 Webhook 事件：找頻道與其擁有者 → 建立聯絡人 → 比對規則 → 執行 */
export async function handleIncomingEvent(event: IncomingEvent, deps: HandlerDeps): Promise<void> {
  const { db, sender, publicUrl } = deps;

  const channel = channels.byExternalId(db, event.channel_external_id);
  if (!channel) {
    if (event.kind === "echo") return;
    events.log(db, {
      type: "warning",
      summary: `收到未連接頻道的事件（${event.platform} ${event.channel_external_id}）`,
      payload: event.raw,
    });
    return;
  }
  const owner = users.get(db, channel.user_id);
  if (!owner) return;

  // 去重：Meta 可能重送同一事件
  const dedupeKey = `${channel.id}:${event.sender_id}:${event.timestamp}:${event.kind}`;
  if (!events.markProcessed(db, dedupeKey)) return;

  if (event.kind === "echo") return handleEcho(event, channel, owner.id, db);

  const { contact, isNew } = contacts.touch(db, channel, event.sender_id);

  if (isNew || !contact.first_name) {
    const profile = await sender.getProfile(channel, event.sender_id);
    if (profile) contacts.setProfile(db, contact.id, profile);
  }

  const fromAd = isFromAd(event.referral);
  events.log(db, {
    user_id: owner.id,
    channel_id: channel.id,
    contact_id: contact.id,
    type: event.kind,
    summary: describeEvent(event, fromAd),
    payload: event.raw,
  });

  const match = matchAutomation(event, automations.listEnabled(db, owner.id), channel.id);

  if (event.referral && (fromAd || event.referral.ref)) {
    contacts.setSource(db, contact.id, {
      ad_id: event.referral.ad_id,
      ref: event.referral.ref,
      automation_id: match?.id ?? null,
    });
  }

  if (!match) return;

  const log = (type: string, summary: string) =>
    events.log(db, { user_id: owner.id, channel_id: channel.id, contact_id: contact.id, automation_id: match.id, type, summary });

  const sub = subscriptionStatus(owner);
  if (!sub.active) {
    log("warning", `方案已到期，未執行自動化「${match.name}」。請到「方案與付款」續約。`);
    return;
  }

  const pausedUntil = pausedUntilMs(contact);
  if (pausedUntil) {
    log("paused", `小編接手中，自動回覆暫停到 ${formatTime(pausedUntil)}，未執行「${match.name}」`);
    return;
  }

  // 第一則訊息已經放在 Messenger 廣告裡，客人看過了，就不要再送一次
  let skipStep: number | undefined;
  if (match.ad_json && event.platform === "messenger" && fromAd && AD_TRIGGERS.has(match.trigger_type)) {
    const idx = firstContentStep(match.steps);
    if (idx >= 0) {
      skipStep = idx;
      log("info", `客人已在廣告中看過「${match.name}」的第一則訊息，這次不重複送出`);
    }
  }

  const fresh = contacts.get(db, contact.id) ?? contact;
  try {
    await runAutomation(match, {
      db,
      sender,
      publicUrl,
      userId: owner.id,
      channel,
      contact: fresh,
      referral: event.referral,
      text: event.text,
      skipStep,
    });
    if (channel.status === "broken") channels.setStatus(db, channel.id, "ok", null);
  } catch (err) {
    // 錯誤已由 runner 記錄到事件；權杖失效之類的連線問題另外標記，讓後台提醒客戶重新連接
    if (isConnectionError(err) && channels.setStatus(db, channel.id, "broken", `傳送失敗：${(err as Error).message}`)) {
      events.log(db, {
        user_id: owner.id,
        channel_id: channel.id,
        type: "warning",
        summary: `「${channel.name}」的連線失效，自動回覆送不出去。請到「連接帳號」重新連接 Facebook。`,
      });
    }
  }
}

/** 專頁送出的訊息：不是本平台送的 → 小編接手（暫停）或專頁原本的自動回覆（提醒衝突） */
function handleEcho(event: IncomingEvent, channel: Channel, userId: number, db: DB) {
  const { appId } = metaConfig(db);
  if (appId && event.echo_app_id === appId) return;
  const contact = contacts.find(db, channel.id, event.sender_id);
  if (!contact) return;
  const sinceOurs = events.secondsSince(db, contact.id, "sent");
  if (sinceOurs !== null && sinceOurs < CONFLICT_WINDOW_SECONDS) {
    events.log(db, {
      user_id: userId,
      channel_id: channel.id,
      contact_id: contact.id,
      type: "conflict",
      summary: "偵測到另一個自動回覆也回了客人（多半是 Meta 商業套件的「即時回覆」），客人會收到兩則訊息",
      payload: event.raw,
    });
    return;
  }
  const until = new Date(Date.now() + HANDOVER_MINUTES * 60_000);
  contacts.setPausedUntil(db, contact.id, until.toISOString());
  events.log(db, {
    user_id: userId,
    channel_id: channel.id,
    contact_id: contact.id,
    type: "handover",
    summary: `小編回覆了客人，自動回覆暫停 ${HANDOVER_MINUTES} 分鐘（到 ${formatTime(until.getTime())}）`,
  });
}

function pausedUntilMs(c: Contact): number | null {
  if (!c.paused_until) return null;
  const t = Date.parse(c.paused_until);
  return Number.isFinite(t) && t > Date.now() ? t : null;
}
function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Taipei" });
}

function describeEvent(e: IncomingEvent, fromAd: boolean): string {
  const parts: string[] = [];
  if (fromAd) parts.push(`從廣告進入${e.referral?.ad_id ? `（ad_id ${e.referral.ad_id}）` : ""}`);
  else if (e.referral?.ref) parts.push(`帶 ref=${e.referral.ref} 進入`);
  if (e.kind === "message" && e.text) parts.push(`訊息：${e.text.slice(0, 80)}`);
  else if (e.kind === "message") parts.push("收到非文字訊息");
  else if (e.kind === "postback") parts.push(`按下按鈕：${e.text ?? e.postback_payload ?? ""}`);
  else if (e.kind === "referral" && parts.length === 0) parts.push("收到 referral 事件");
  return parts.join("，") || "收到事件";
}
