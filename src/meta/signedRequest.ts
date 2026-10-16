import { createHmac, timingSafeEqual } from "node:crypto";

/** 解析 Meta 的 signed_request（取消授權、資料刪除回呼會帶這個）；簽章不符回傳 null */
export function parseSignedRequest(signed: string, appSecret: string): Record<string, unknown> | null {
  const [sig, payload] = String(signed || "").split(".");
  if (!sig || !payload || !appSecret) return null;
  const expected = createHmac("sha256", appSecret).update(payload).digest();
  const given = Buffer.from(sig.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")) as Record<string, unknown>;
    if (String(data.algorithm ?? "").toUpperCase() !== "HMAC-SHA256") return null;
    return data;
  } catch {
    return null;
  }
}
