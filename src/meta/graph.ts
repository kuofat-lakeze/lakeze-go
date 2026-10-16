import type { MetaConfig } from "../settings.js";

/** Facebook 登入 + 連接粉絲專頁所需的 Graph API 呼叫 */

export const OAUTH_SCOPES = [
  "pages_show_list",
  "pages_messaging",
  "pages_manage_metadata",
  "pages_read_engagement",
  "business_management",
  "instagram_basic",
  "instagram_manage_messages",
];

export const WEBHOOK_FIELDS = ["messages", "messaging_postbacks", "messaging_referrals", "messaging_optins"];
/** 粉絲專頁另外訂閱 message_echoes，才知道小編是不是在收件匣回覆了客人 */
export const PAGE_FIELDS = [...WEBHOOK_FIELDS, "message_echoes"];
/** 讀取廣告清單用的額外權限（選用，另外授權） */
export const ADS_SCOPE = "ads_read";
/** 沒有這些權限就收發不了訊息 */
export const REQUIRED_SCOPES = ["pages_show_list", "pages_messaging", "pages_manage_metadata"];
export const INSTAGRAM_SCOPES = ["instagram_basic", "instagram_manage_messages"];
export const SCOPE_LABEL: Record<string, string> = {
  pages_show_list: "列出你的粉絲專頁",
  pages_messaging: "用粉絲專頁傳送訊息",
  pages_manage_metadata: "接收專頁的新訊息通知",
  pages_read_engagement: "讀取專頁基本資料",
  business_management: "讀取商業管理平台中的專頁",
  instagram_basic: "讀取 Instagram 帳號",
  instagram_manage_messages: "收發 Instagram 私訊",
  ads_read: "讀取廣告清單",
};

export interface PageInfo {
  id: string;
  name: string;
  access_token: string;
  instagram?: { id: string; username?: string } | null;
}

export class GraphError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: unknown,
  ) {
    super(message);
  }
}

async function graphFetch<T>(url: string, init?: RequestInit, fetchImpl: typeof fetch = fetch): Promise<T> {
  const res = await fetchImpl(url, init);
  const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
  if (!res.ok) throw new GraphError(body.error?.message ?? `Graph API ${res.status}`, res.status, body);
  return body as T;
}

const base = (cfg: MetaConfig) => `https://graph.facebook.com/${cfg.graphVersion}`;

/**
 * Facebook 授權視窗網址。
 * - 有設定「Facebook 登入（商家版）設定 ID」時用 config_id（權限由那組設定決定）
 * - 否則用 scope 列出權限
 * - rerequest：客人上次取消勾選某些權限時，重新詢問
 */
export function oauthDialogUrl(
  cfg: MetaConfig,
  redirectUri: string,
  state: string,
  opts: { extraScopes?: string[]; rerequest?: boolean } = {},
): string {
  const q = new URLSearchParams({ client_id: cfg.appId, redirect_uri: redirectUri, state, response_type: "code" });
  if (cfg.loginConfigId && !opts.extraScopes?.length) {
    q.set("config_id", cfg.loginConfigId);
    q.set("override_default_response_type", "true");
  } else {
    q.set("scope", [...OAUTH_SCOPES, ...(opts.extraScopes ?? [])].join(","));
  }
  if (opts.rerequest) q.set("auth_type", "rerequest");
  return `https://www.facebook.com/${cfg.graphVersion}/dialog/oauth?${q}`;
}

export async function getMe(cfg: MetaConfig, userToken: string, f = fetch): Promise<{ id: string; name?: string }> {
  return graphFetch(`${base(cfg)}/me?fields=id,name&access_token=${encodeURIComponent(userToken)}`, undefined, f);
}

/** 這次授權實際拿到哪些權限 */
export async function getPermissions(cfg: MetaConfig, userToken: string, f = fetch): Promise<{ granted: string[]; declined: string[] }> {
  const r = await graphFetch<{ data: { permission: string; status: string }[] }>(
    `${base(cfg)}/me/permissions?access_token=${encodeURIComponent(userToken)}`,
    undefined,
    f,
  );
  return {
    granted: r.data.filter((p) => p.status === "granted").map((p) => p.permission),
    declined: r.data.filter((p) => p.status !== "granted").map((p) => p.permission),
  };
}

/**
 * 檢查一個已連接的頻道：權杖還能不能用；粉絲專頁另外確認 App 仍在訂閱、欄位齊全。
 * 回傳 missingFields 時呼叫端可以重新訂閱。
 */
export async function checkChannel(
  cfg: MetaConfig,
  ch: { platform: string; external_id: string; access_token: string; instagram_login: number },
  f = fetch,
): Promise<{ ok: boolean; error?: string; missingFields?: string[]; /** true = 權杖或權限問題；false = 暫時連不上，不代表連線壞掉 */ auth?: boolean }> {
  const host = ch.platform === "instagram" && ch.instagram_login ? "graph.instagram.com" : "graph.facebook.com";
  try {
    await graphFetch(`https://${host}/${cfg.graphVersion}/me?fields=id&access_token=${encodeURIComponent(ch.access_token)}`, undefined, f);
    if (ch.platform !== "messenger") return { ok: true };
    const subs = await graphFetch<{ data: { id: string; subscribed_fields?: string[] }[] }>(
      `${base(cfg)}/${ch.external_id}/subscribed_apps?access_token=${encodeURIComponent(ch.access_token)}`,
      undefined,
      f,
    );
    const mine = subs.data.find((x) => x.id === cfg.appId);
    if (!mine) return { ok: true, missingFields: PAGE_FIELDS };
    const missing = PAGE_FIELDS.filter((x) => !(mine.subscribed_fields ?? []).includes(x));
    return { ok: true, missingFields: missing.length ? missing : undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err), auth: isAuthGraphError(err) };
  }
}

/** Graph API 回應的是權杖失效 / 權限不足（而不是網路或 Meta 暫時故障） */
export function isAuthGraphError(err: unknown): boolean {
  if (!(err instanceof GraphError)) return false;
  const code = (err.body as { error?: { code?: number } } | null)?.error?.code;
  return err.status === 401 || err.status === 403 || code === 190 || code === 102 || code === 200 || code === 10;
}

export interface AdSummary {
  id: string;
  name: string;
  status: string;
  account: string;
  campaign?: string;
}
/** 列出使用者能看到的廣告（需要 ads_read） */
export async function listAds(cfg: MetaConfig, userToken: string, f = fetch): Promise<AdSummary[]> {
  const t = encodeURIComponent(userToken);
  const accounts = await graphFetch<{ data: { id: string; name?: string }[] }>(`${base(cfg)}/me/adaccounts?fields=id,name&limit=50&access_token=${t}`, undefined, f);
  const out: AdSummary[] = [];
  for (const acc of accounts.data) {
    const ads = await graphFetch<{ data: { id: string; name: string; effective_status: string; campaign?: { name?: string } }[] }>(
      `${base(cfg)}/${acc.id}/ads?fields=id,name,effective_status,campaign{name}&limit=200&effective_status=${encodeURIComponent('["ACTIVE","PAUSED","PENDING_REVIEW","IN_PROCESS","WITH_ISSUES","CAMPAIGN_PAUSED","ADSET_PAUSED"]')}&access_token=${t}`,
      undefined,
      f,
    );
    for (const ad of ads.data) out.push({ id: ad.id, name: ad.name, status: ad.effective_status, account: acc.name ?? acc.id, campaign: ad.campaign?.name });
  }
  return out;
}

export async function exchangeCode(cfg: MetaConfig, code: string, redirectUri: string, f = fetch): Promise<string> {
  const q = new URLSearchParams({ client_id: cfg.appId, client_secret: cfg.appSecret, redirect_uri: redirectUri, code });
  const r = await graphFetch<{ access_token: string }>(`${base(cfg)}/oauth/access_token?${q}`, undefined, f);
  return r.access_token;
}

export async function longLivedUserToken(cfg: MetaConfig, shortToken: string, f = fetch): Promise<string> {
  const q = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: cfg.appId,
    client_secret: cfg.appSecret,
    fb_exchange_token: shortToken,
  });
  const r = await graphFetch<{ access_token: string }>(`${base(cfg)}/oauth/access_token?${q}`, undefined, f);
  return r.access_token;
}

/** 列出使用者管理的粉絲專頁（含專頁權杖與綁定的 IG 帳號）。用長效使用者權杖換到的專頁權杖不會過期。 */
export async function listPages(cfg: MetaConfig, userToken: string, f = fetch): Promise<PageInfo[]> {
  const out: PageInfo[] = [];
  let url: string | null =
    `${base(cfg)}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&limit=100&access_token=${encodeURIComponent(userToken)}`;
  while (url) {
    const r: {
      data: { id: string; name: string; access_token: string; instagram_business_account?: { id: string; username?: string } }[];
      paging?: { next?: string };
    } = await graphFetch(url, undefined, f);
    for (const p of r.data) {
      out.push({ id: p.id, name: p.name, access_token: p.access_token, instagram: p.instagram_business_account ?? null });
    }
    url = r.paging?.next ?? null;
  }
  return out;
}

/** 讓 App 訂閱這個粉絲專頁的 Webhook 事件 */
export async function subscribePage(cfg: MetaConfig, pageId: string, pageToken: string, f = fetch): Promise<void> {
  const q = new URLSearchParams({ subscribed_fields: PAGE_FIELDS.join(","), access_token: pageToken });
  await graphFetch(`${base(cfg)}/${pageId}/subscribed_apps?${q}`, { method: "POST" }, f);
}

/** 設定「開始使用」按鈕：新用戶從廣告點進來會先看到它，按下去才會觸發我們的自動化 */
export async function setGetStarted(cfg: MetaConfig, pageToken: string, f = fetch): Promise<void> {
  await graphFetch(
    `${base(cfg)}/me/messenger_profile?access_token=${encodeURIComponent(pageToken)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ get_started: { payload: "GET_STARTED" } }),
    },
    f,
  );
}

/** 幫 App 登記 Webhook 回呼網址（Meta 會立刻對 callbackUrl 做 GET 驗證） */
export async function registerAppWebhook(
  cfg: MetaConfig,
  object: "page" | "instagram",
  callbackUrl: string,
  f = fetch,
): Promise<void> {
  const q = new URLSearchParams({
    object,
    callback_url: callbackUrl,
    verify_token: cfg.verifyToken,
    fields: (object === "page" ? PAGE_FIELDS : WEBHOOK_FIELDS).join(","),
    include_values: "true",
    access_token: `${cfg.appId}|${cfg.appSecret}`,
  });
  await graphFetch(`${base(cfg)}/${cfg.appId}/subscriptions?${q}`, { method: "POST" }, f);
}

/** 用 App 權杖讀取 App 基本資料，用來驗證 App ID 與 App Secret 是否正確 */
export async function verifyApp(cfg: MetaConfig, f = fetch): Promise<{ id: string; name: string }> {
  const token = encodeURIComponent(`${cfg.appId}|${cfg.appSecret}`);
  return graphFetch<{ id: string; name: string }>(`${base(cfg)}/${cfg.appId}?fields=id,name&access_token=${token}`, undefined, f);
}

export async function listAppWebhooks(cfg: MetaConfig, f = fetch): Promise<unknown> {
  return graphFetch(`${base(cfg)}/${cfg.appId}/subscriptions?access_token=${encodeURIComponent(`${cfg.appId}|${cfg.appSecret}`)}`, undefined, f);
}
