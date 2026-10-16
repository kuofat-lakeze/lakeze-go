import type { DB } from "../db.js";
import { channels, events, settingsStore } from "../db.js";
import { checkChannel, listAppWebhooks, PAGE_FIELDS, registerAppWebhook, subscribePage } from "../meta/graph.js";
import { KEYS, metaConfig, resolvePublicUrl } from "../settings.js";

/**
 * 定期檢查所有已連接的頻道：
 *  - 權杖失效 → 標記「需要重新連接」，後台會提醒客戶
 *  - 粉絲專頁的訂閱欄位不齊（例如舊版沒訂 message_echoes）→ 自動補訂
 *  - App 層級的 Webhook 欄位不齊 → 自動重新登記（需已設定對外網址）
 */
export async function runHealthCheck(db: DB, fetchImpl: typeof fetch = fetch): Promise<{ checked: number; broken: number }> {
  const cfg = metaConfig(db);
  if (!cfg.appId || !cfg.appSecret) return { checked: 0, broken: 0 };
  await ensureAppWebhookFields(db, fetchImpl).catch(() => {});
  let broken = 0;
  const all = channels.all(db);
  for (const ch of all) {
    const r = await checkChannel(cfg, ch, fetchImpl);
    if (!r.ok && !r.auth) continue; // 暫時連不上 Meta，下次再檢查
    if (!r.ok) {
      broken++;
      if (channels.setStatus(db, ch.id, "broken", `連線檢查失敗：${r.error}`)) {
        events.log(db, { user_id: ch.user_id, channel_id: ch.id, type: "warning", summary: `「${ch.name}」的連線失效（${r.error}），請到「連接帳號」重新連接 Facebook。` });
      }
      continue;
    }
    if (r.missingFields && ch.platform === "messenger") await subscribePage(cfg, ch.external_id, ch.access_token, fetchImpl).catch(() => {});
    // 傳送失敗造成的標記，要等下一次成功送出或客戶手動檢查才解除（權杖可能正常但權限被拿掉）
    if (ch.status === "broken" && !String(ch.last_error ?? "").startsWith("傳送失敗")) channels.setStatus(db, ch.id, "ok", null);
    else if (ch.status !== "broken") channels.setStatus(db, ch.id, "ok", null);
  }
  return { checked: all.length, broken };
}

async function ensureAppWebhookFields(db: DB, fetchImpl: typeof fetch) {
  if (!settingsStore.get(db, KEYS.publicUrl)) return;
  const cfg = metaConfig(db);
  const subs = (await listAppWebhooks(cfg, fetchImpl)) as { data?: { object: string; fields?: { name: string }[] }[] };
  const page = subs.data?.find((x) => x.object === "page");
  if (!page) return; // 還沒登記過，交給設定頁
  const have = new Set((page.fields ?? []).map((f) => f.name));
  if (PAGE_FIELDS.every((f) => have.has(f))) return;
  await registerAppWebhook(cfg, "page", `${resolvePublicUrl(db)}/webhook`, fetchImpl);
  events.log(db, { type: "info", summary: "已自動更新 Webhook 訂閱欄位（新增 message_echoes）" });
}

export function scheduleHealthChecks(db: DB) {
  const run = () => void runHealthCheck(db).catch((err) => console.error("health check failed", err));
  setTimeout(run, 60_000).unref();
  setInterval(run, 6 * 60 * 60_000).unref();
}
