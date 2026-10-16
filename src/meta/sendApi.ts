import type { Channel } from "../types.js";

/** 傳給 Graph API /me/messages 的 message 物件 */
export type OutgoingMessage = Record<string, unknown>;

export interface Sender {
  send(channel: Channel, recipientId: string, message: OutgoingMessage): Promise<void>;
  getProfile(
    channel: Channel,
    psid: string,
  ): Promise<{ first_name?: string; last_name?: string; profile_pic?: string } | null>;
}

/** Graph API 傳送失敗；code / subcode 是 Meta 的錯誤代碼 */
export class SendError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: number | null,
    public subcode: number | null,
  ) {
    super(message);
  }
}

/**
 * 是不是「連線本身壞掉」（權杖失效、權限被拿掉），需要客戶重新連接。
 * 像「超過 24 小時」或「這個人目前無法接收訊息」只跟單一客人有關，不算。
 */
export function isConnectionError(err: unknown): boolean {
  if (!(err instanceof SendError)) return false;
  if (err.code === 190 || err.code === 102 || err.status === 401) return true;
  if (err.code === 200 && err.subcode !== 2018278) return true;
  if (err.code === 10 && err.subcode !== 2018278 && err.subcode !== 2018108) return true;
  return false;
}

export function graphBase(channel: Channel, version: string): string {
  const host = channel.platform === "instagram" && channel.instagram_login ? "graph.instagram.com" : "graph.facebook.com";
  return `https://${host}/${version}`;
}

export function createGraphSender(getVersion: () => string, fetchImpl: typeof fetch = fetch): Sender {
  return {
    async send(channel, recipientId, message) {
      const url = `${graphBase(channel, getVersion())}/me/messages`;
      const res = await fetchImpl(url, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${channel.access_token}` },
        body: JSON.stringify({
          recipient: { id: recipientId },
          messaging_type: "RESPONSE",
          message,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        let code: number | null = null;
        let subcode: number | null = null;
        let msg = body.slice(0, 500);
        try {
          const e = (JSON.parse(body) as { error?: { code?: number; error_subcode?: number; message?: string } }).error;
          code = e?.code ?? null;
          subcode = e?.error_subcode ?? null;
          if (e?.message) msg = e.message;
        } catch {
          /* 不是 JSON 就用原文 */
        }
        throw new SendError(`Graph API ${res.status}${code ? ` (#${code})` : ""}: ${msg}`, res.status, code, subcode);
      }
    },
    async getProfile(channel, psid) {
      const fields = channel.platform === "instagram" ? "name,username,profile_pic" : "first_name,last_name,profile_pic";
      const url = `${graphBase(channel, getVersion())}/${psid}?fields=${fields}`;
      try {
        const res = await fetchImpl(url, { headers: { authorization: `Bearer ${channel.access_token}` } });
        if (!res.ok) return null;
        const j = (await res.json()) as Record<string, string | undefined>;
        if (channel.platform === "instagram") {
          return { first_name: j.name ?? j.username, last_name: j.username ? `@${j.username}` : undefined, profile_pic: j.profile_pic };
        }
        return { first_name: j.first_name, last_name: j.last_name, profile_pic: j.profile_pic };
      } catch {
        return null;
      }
    },
  };
}

/** 測試 / 模擬用：把訊息收集起來不真的送出 */
export function createCaptureSender(): Sender & { sent: { recipientId: string; message: OutgoingMessage }[] } {
  const sent: { recipientId: string; message: OutgoingMessage }[] = [];
  return {
    sent,
    async send(_channel, recipientId, message) {
      sent.push({ recipientId, message });
    },
    async getProfile() {
      return { first_name: "測試", last_name: "用戶" };
    },
  };
}
