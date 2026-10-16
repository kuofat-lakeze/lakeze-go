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

export function oauthDialogUrl(cfg: MetaConfig, redirectUri: string, state: string): string {
  const q = new URLSearchParams({
    client_id: cfg.appId,
    redirect_uri: redirectUri,
    state,
    scope: OAUTH_SCOPES.join(","),
    response_type: "code",
  });
  return `https://www.facebook.com/${cfg.graphVersion}/dialog/oauth?${q}`;
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
  const q = new URLSearchParams({ subscribed_fields: WEBHOOK_FIELDS.join(","), access_token: pageToken });
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
    fields: WEBHOOK_FIELDS.join(","),
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
