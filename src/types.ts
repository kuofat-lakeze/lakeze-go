export type Platform = "messenger" | "instagram";

export interface Channel {
  id: number;
  /** 擁有這個頻道的使用者 */
  user_id: number;
  platform: Platform;
  /** Messenger: 粉絲專頁 ID；Instagram: IG 專業帳號 ID（Webhook entry.id 會對到這個值） */
  external_id: string;
  name: string;
  access_token: string;
  /** Instagram 若是用「Instagram 登入」取得的 token，要走 graph.instagram.com */
  instagram_login: number;
  /** ok = 正常；broken = 權杖失效或權限被移除，需要重新連接 */
  status?: "ok" | "broken";
  last_error?: string | null;
  checked_at?: string | null;
  /** 授權這個頻道的 Facebook 使用者（App 範圍 ID），用於 Meta 的資料刪除 / 取消授權通知 */
  fb_user_id?: string | null;
  created_at: string;
}

export type TriggerType =
  | "ad" // 指定廣告 ID
  | "ref" // 廣告 / m.me 連結上的 ref 參數
  | "any_ad" // 任何從廣告點進來的人
  | "keyword" // 訊息包含關鍵字
  | "postback" // 按鈕 payload
  | "get_started" // 第一次開啟對話（開始使用）
  | "default"; // 都沒命中時的預設回覆

export interface UrlButton {
  type: "url";
  title: string;
  url: string;
  /** 是否經由本系統的追蹤連結轉址（可統計點擊） */
  track?: boolean;
}
export interface PostbackButton {
  type: "postback";
  title: string;
  payload: string;
}
export type Button = UrlButton | PostbackButton;

export type Step =
  | { type: "text"; text: string }
  | { type: "buttons"; text: string; buttons: Button[] }
  | { type: "quick_replies"; text: string; replies: { title: string; payload: string }[] }
  | { type: "image"; url: string }
  | { type: "delay"; seconds: number }
  | { type: "tag"; tag: string }
  | { type: "goto"; automation_id: number };

export interface Automation {
  id: number;
  user_id: number;
  name: string;
  enabled: number;
  priority: number;
  platform: Platform | "any";
  channel_id: number | null;
  trigger_type: TriggerType;
  /** ad: 廣告 ID；ref: ref 值；keyword: 以逗號分隔的關鍵字；postback: payload */
  trigger_value: string;
  steps: Step[];
  triggered_count: number;
  /** 系統預先建立、尚未被使用者修改過的範例（預設不啟用） */
  is_example: number;
  /** 第一則訊息已用 JSON 放進 Messenger 廣告：客人從廣告進來互動時略過這則，避免重複 */
  ad_json?: number;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: number;
  user_id: number;
  channel_id: number;
  platform: Platform;
  psid: string;
  first_name: string | null;
  last_name: string | null;
  profile_pic: string | null;
  source_ad_id: string | null;
  source_ref: string | null;
  source_automation_id: number | null;
  tags: string[];
  first_seen: string;
  last_seen: string;
  /** 小編接手對話時，自動回覆暫停到這個時間（ISO / SQLite datetime） */
  paused_until?: string | null;
}

export interface Referral {
  source: string | null; // ADS / SHORTLINK / MESSENGER_CODE ...
  type: string | null; // OPEN_THREAD ...
  ref: string | null;
  ad_id: string | null;
  ads_context: Record<string, unknown> | null;
}

/** Webhook 事件正規化後的樣子 */
export interface IncomingEvent {
  platform: Platform;
  channel_external_id: string;
  sender_id: string;
  timestamp: number;
  /** echo = 專頁自己送出的訊息（小編在收件匣回覆，或其他工具） */
  kind: "message" | "postback" | "referral" | "echo" | "other";
  text: string | null;
  /** echo 時：送出這則訊息的 App ID（小編手動回覆時通常沒有或不是本平台的 App） */
  echo_app_id?: string | null;
  postback_payload: string | null;
  referral: Referral | null;
  /** 原始 messaging 物件，記錄用 */
  raw: unknown;
}
