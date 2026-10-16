import { Router } from "express";
import type { DB } from "../db.js";
import { deletionRequests, settingsStore, users } from "../db.js";
import { appName, KEYS } from "../settings.js";

/** 隱私權政策、服務條款、資料刪除說明：Meta App 上線與送審必填的公開頁面 */
export function legalRouter(db: DB): Router {
  const router = Router();
  const contact = () => settingsStore.get(db, KEYS.supportEmail) || users.list(db).find((u) => u.role === "owner")?.email || "";
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
  const page = (title: string, body: string) => `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(title)} · ${esc(appName(db))}</title><link rel="icon" href="/brand/mark.svg"/>
<style>body{margin:0;background:#fafafb;color:#1d1d24;font:15px/1.75 Inter,"Noto Sans TC",system-ui,sans-serif}main{max-width:760px;margin:0 auto;padding:40px 20px 80px}
header{display:flex;align-items:center;gap:12px;margin-bottom:32px}header img{height:28px}h1{font-size:26px;margin:0 0 4px}h2{font-size:17px;margin:32px 0 6px}p,li{color:#3b3b45}.muted{color:#6e6e7a;font-size:13px}
a{color:#e95b17}.box{background:#fff;border:1px solid #e7e7ec;border-radius:12px;padding:16px 20px;margin-top:16px}nav a{margin-right:16px;font-size:13px}</style></head>
<body><main><header><img src="/brand/logo.png" alt="${esc(appName(db))}"/></header>${body}
<p class="muted" style="margin-top:48px"><nav><a href="/privacy">隱私權政策</a><a href="/terms">服務條款</a><a href="/data-deletion">資料刪除</a><a href="/">回到 ${esc(appName(db))}</a></nav></p></main></body></html>`;
  const updated = `<p class="muted">最後更新：${new Date().getFullYear()} 年</p>`;
  const mail = () => (contact() ? `<a href="mailto:${esc(contact())}">${esc(contact())}</a>` : "平台管理員");

  router.get("/privacy", (_req, res) => {
    const n = esc(appName(db));
    res.type("html").send(
      page(
        "隱私權政策",
        `<h1>隱私權政策</h1>${updated}
<p>${n}（以下稱「本服務」）協助商家在 Facebook Messenger 與 Instagram 上自動回覆客人訊息。本政策說明我們蒐集哪些資料、如何使用與保護。</p>
<h2>我們蒐集的資料</h2><ul>
<li><b>商家帳號資料：</b>註冊時填寫的名稱、Email 與加密後的密碼。</li>
<li><b>粉絲專頁與 Instagram 連線資料：</b>商家授權後取得的專頁 ID、名稱與存取權杖，用來代表商家收發訊息。</li>
<li><b>客人在對話中的資料：</b>Messenger / Instagram 提供的使用者 ID、公開名稱與大頭貼、客人傳給專頁的訊息、點擊的廣告 ID 或 ref 參數、點擊連結的紀錄。</li>
<li><b>付款資料：</b>付款由統一金流 PayUni 處理，本服務不會取得或儲存信用卡號碼。</li></ul>
<h2>資料的用途</h2><ul><li>依商家設定的規則自動回覆客人、導向商家指定的網址。</li><li>讓商家在後台查看聯絡人、對話事件與成效統計。</li><li>維護服務安全、排除問題與處理帳務。</li></ul>
<p>我們不會出售資料，也不會把資料用於廣告投放或提供給與本服務無關的第三方。</p>
<h2>資料的保存與刪除</h2><p>資料在商家使用本服務期間保存。商家可以隨時在後台移除連接的帳號或刪除聯絡人；移除 App 授權或提出刪除要求後，我們會刪除相關的存取權杖與聯絡人資料。詳見<a href="/data-deletion">資料刪除說明</a>。</p>
<h2>資料安全</h2><p>所有連線皆使用 HTTPS 加密，密碼以雜湊方式儲存，存取權杖只用於 Meta 官方 API。</p>
<h2>聯絡我們</h2><p>對本政策有任何問題，請寄信到 ${mail()}。</p>`,
      ),
    );
  });

  router.get("/terms", (_req, res) => {
    const n = esc(appName(db));
    res.type("html").send(
      page(
        "服務條款",
        `<h1>服務條款</h1>${updated}
<p>使用 ${n}（以下稱「本服務」）即表示你同意以下條款。</p>
<h2>服務內容</h2><p>本服務提供 Facebook Messenger 與 Instagram 的自動回覆、廣告點擊導流與成效追蹤。功能可能因 Meta 平台政策調整而變動。</p>
<h2>你的責任</h2><ul><li>你必須是所連接粉絲專頁與 Instagram 帳號的合法管理者。</li><li>你送出的訊息內容須遵守 Meta 的<a href="https://developers.facebook.com/terms" target="_blank" rel="noopener">平台條款</a>、<a href="https://transparency.meta.com/policies/community-standards/" target="_blank" rel="noopener">社群守則</a>與相關法律，不得傳送垃圾訊息或詐騙內容。</li><li>請妥善保管帳號密碼。</li></ul>
<h2>費用與付款</h2><p>付費方案依後台「方案與付款」頁面顯示的價格與期間計費，付款由統一金流 PayUni 處理。方案到期後自動回覆會暫停，續約後恢復。</p>
<h2>服務中斷與責任限制</h2><p>我們會盡力維持服務穩定，但不保證服務不中斷，也不對因 Meta 平台變更、網路問題或不可抗力造成的損失負責。</p>
<h2>終止</h2><p>你可以隨時停止使用並移除連接的帳號。若違反本條款，我們得暫停或終止你的帳號。</p>
<h2>聯絡我們</h2><p>有任何問題，請寄信到 ${mail()}。</p>`,
      ),
    );
  });

  router.get("/data-deletion", (req, res) => {
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const r = code ? deletionRequests.get(db, code) : undefined;
    res.type("html").send(
      page(
        "資料刪除",
        `<h1>資料刪除說明</h1>
${code ? `<div class="box"><b>${r ? "刪除要求已處理完成" : "找不到這個刪除要求"}</b><p class="muted">確認碼：${esc(code)}${r ? `<br/>處理時間：${esc(r.created_at)} (UTC)<br/>${esc(r.detail ?? "")}` : ""}</p></div>` : ""}
<h2>商家（粉絲專頁管理者）</h2><ul>
<li>在 Facebook 的「設定和隱私 → 設定 → 商業整合」移除 ${esc(appName(db))}，我們會收到通知並自動刪除你連接的頻道、存取權杖與這些頻道的聯絡人資料。</li>
<li>也可以在後台「連接帳號」移除帳號，或寄信要求刪除整個帳號。</li></ul>
<h2>在 Messenger / Instagram 與商家對話的客人</h2>
<p>你的對話資料屬於該商家。請直接傳訊息給商家要求刪除，或寄信到 ${mail()}，告訴我們商家名稱與你的 Facebook / Instagram 名稱，我們會在 30 天內處理。</p>`,
      ),
    );
  });

  return router;
}
