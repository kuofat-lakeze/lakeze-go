import { createCipheriv, createDecipheriv, createHash } from "node:crypto";

/**
 * PAYUNi 統一金流 — 與官方 PHP / .NET SDK 相容的加解密與整合式支付頁（UPP）。
 *
 * 加密：AES-256-GCM(key=HashKey, iv=HashIV) 對 query string 加密，
 *       EncryptInfo = hex( base64(密文) + ":::" + base64(tag) )
 * 驗章：HashInfo = SHA256(HashKey + EncryptInfo + HashIV) 大寫
 */

export interface PayuniConfig {
  merId: string;
  hashKey: string; // 32 字元
  hashIv: string; // 16 字元
  sandbox: boolean;
}

export function apiBase(cfg: Pick<PayuniConfig, "sandbox">): string {
  return cfg.sandbox ? "https://sandbox-api.payuni.com.tw/api" : "https://api.payuni.com.tw/api";
}

export function toQueryString(params: Record<string, string | number>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
}

export function parseQueryString(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(s)) out[k] = v;
  return out;
}

export function encrypt(cfg: Pick<PayuniConfig, "hashKey" | "hashIv">, plain: string): string {
  const key = Buffer.from(cfg.hashKey.trim(), "utf8");
  const iv = Buffer.from(cfg.hashIv.trim(), "utf8");
  if (key.length !== 32) throw new Error("PayUni HashKey 必須是 32 字元");
  if (iv.length !== 16) throw new Error("PayUni HashIV 必須是 16 字元");
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const joined = `${encrypted.toString("base64")}:::${tag.toString("base64")}`;
  return Buffer.from(joined, "utf8").toString("hex");
}

export function decrypt(cfg: Pick<PayuniConfig, "hashKey" | "hashIv">, encryptInfo: string): string {
  const key = Buffer.from(cfg.hashKey.trim(), "utf8");
  const iv = Buffer.from(cfg.hashIv.trim(), "utf8");
  const joined = Buffer.from(encryptInfo.trim(), "hex").toString("utf8");
  const idx = joined.indexOf(":::");
  if (idx < 0) throw new Error("EncryptInfo 格式錯誤");
  const data = Buffer.from(joined.slice(0, idx), "base64");
  const tag = Buffer.from(joined.slice(idx + 3), "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function hashInfo(cfg: Pick<PayuniConfig, "hashKey" | "hashIv">, encryptInfo: string): string {
  return createHash("sha256").update(`${cfg.hashKey}${encryptInfo}${cfg.hashIv}`).digest("hex").toUpperCase();
}

export interface CheckoutInput {
  merTradeNo: string; // 商店訂單編號，英數 20 字內
  amount: number; // 新台幣整數
  description: string;
  returnUrl: string; // 付款完成後瀏覽器導回
  notifyUrl: string; // 伺服器端通知
  backUrl?: string; // 取消付款返回
  email?: string;
  timestamp?: number;
}

export interface CheckoutForm {
  action: string;
  fields: Record<string, string>;
}

/** 產生整合式支付頁的表單（前端 POST 送出即可導到 PayUni） */
export function buildCheckout(cfg: PayuniConfig, input: CheckoutInput): CheckoutForm {
  const params: Record<string, string | number> = {
    MerID: cfg.merId,
    MerTradeNo: input.merTradeNo,
    TradeAmt: Math.round(input.amount),
    Timestamp: input.timestamp ?? Math.floor(Date.now() / 1000),
    ProdDesc: input.description.slice(0, 50),
    ReturnURL: input.returnUrl,
    NotifyURL: input.notifyUrl,
  };
  if (input.backUrl) params.BackURL = input.backUrl;
  if (input.email) params.UsrMail = input.email;
  const encryptInfo = encrypt(cfg, toQueryString(params));
  return {
    action: `${apiBase(cfg)}/upp`,
    fields: { MerID: cfg.merId, Version: "1.0", EncryptInfo: encryptInfo, HashInfo: hashInfo(cfg, encryptInfo) },
  };
}

export interface PayuniResult {
  status: string; // 外層 Status，SUCCESS 為成功
  message: string;
  data: Record<string, string>; // 解密後：TradeNo, MerTradeNo, TradeAmt, TradeStatus, PaymentType, PayTime ...
  paid: boolean;
}

/** 處理 ReturnURL / NotifyURL 回傳：驗章 + 解密 */
export function parseResult(cfg: PayuniConfig, body: Record<string, unknown>): PayuniResult {
  const encryptInfo = typeof body.EncryptInfo === "string" ? body.EncryptInfo : "";
  const givenHash = typeof body.HashInfo === "string" ? body.HashInfo : "";
  const status = typeof body.Status === "string" ? body.Status : "";
  if (!encryptInfo) throw new Error("缺少 EncryptInfo");
  if (!givenHash || hashInfo(cfg, encryptInfo) !== givenHash.toUpperCase()) throw new Error("HashInfo 驗章失敗");
  const raw = decrypt(cfg, encryptInfo);
  let data: Record<string, string>;
  try {
    const j = JSON.parse(raw) as Record<string, unknown>;
    data = Object.fromEntries(Object.entries(j).map(([k, v]) => [k, String(v)]));
  } catch {
    data = parseQueryString(raw);
  }
  const outerOk = status === "" || status.toUpperCase() === "SUCCESS";
  const paid = outerOk && (data.TradeStatus === "1" || (data.Status ?? "").toUpperCase() === "SUCCESS");
  return { status: status || data.Status || "", message: typeof body.Message === "string" ? body.Message : (data.Message ?? ""), data, paid };
}

/** 產生商店訂單編號：LG + 13 位時間戳 + 5 位亂數 = 20 字 */
export function makeTradeNo(now = Date.now()): string {
  return `LG${now}${Math.floor(Math.random() * 100000)
    .toString()
    .padStart(5, "0")}`;
}
