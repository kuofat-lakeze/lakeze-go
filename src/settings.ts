import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import type { DB } from "./db.js";
import { settingsStore } from "./db.js";
import type { PayuniConfig } from "./billing/payuni.js";

/**
 * 平台層級的設定都存在 settings 表，由平台擁有者在後台「設定」頁修改。
 * 環境變數只在第一次啟動時當作初始值灌入（之後以資料庫為準）。
 */
export const KEYS = {
  sessionSecret: "session_secret",
  appName: "app_name",
  allowSignup: "allow_signup",
  trialDays: "trial_days",
  metaAppId: "meta_app_id",
  metaAppSecret: "meta_app_secret",
  verifyToken: "verify_token",
  graphVersion: "graph_version",
  /** Facebook 登入（商家版）的設定 ID；有填就用 config_id 開授權視窗 */
  metaLoginConfigId: "meta_login_config_id",
  publicUrl: "public_url",
  /** 隱私權政策 / 服務條款上的聯絡信箱（沒填就用平台擁有者的 Email） */
  supportEmail: "support_email",
  payuniMerId: "payuni_mer_id",
  payuniHashKey: "payuni_hash_key",
  payuniHashIv: "payuni_hash_iv",
  payuniSandbox: "payuni_sandbox",
} as const;

export const DEFAULT_GRAPH_VERSION = "v21.0";
export const DEFAULT_TRIAL_DAYS = 14;
export const DEFAULT_APP_NAME = "Lakeze Go";

export function seedFromEnv(db: DB) {
  const seed = (key: string, envName: string) => {
    if (settingsStore.get(db, key) === null && process.env[envName]) settingsStore.set(db, key, process.env[envName]!);
  };
  seed(KEYS.metaAppId, "META_APP_ID");
  seed(KEYS.metaAppSecret, "META_APP_SECRET");
  seed(KEYS.verifyToken, "META_VERIFY_TOKEN");
  seed(KEYS.graphVersion, "META_GRAPH_VERSION");
  seed(KEYS.metaLoginConfigId, "META_LOGIN_CONFIG_ID");
  seed(KEYS.publicUrl, "PUBLIC_URL");
  seed(KEYS.sessionSecret, "SESSION_SECRET");
  seed(KEYS.payuniMerId, "PAYUNI_MER_ID");
  seed(KEYS.payuniHashKey, "PAYUNI_HASH_KEY");
  seed(KEYS.payuniHashIv, "PAYUNI_HASH_IV");
  seed(KEYS.payuniSandbox, "PAYUNI_SANDBOX");
  seed(KEYS.appName, "APP_NAME");
  if (settingsStore.get(db, KEYS.sessionSecret) === null) settingsStore.set(db, KEYS.sessionSecret, randomBytes(32).toString("hex"));
  if (settingsStore.get(db, KEYS.verifyToken) === null) settingsStore.set(db, KEYS.verifyToken, randomBytes(12).toString("hex"));
}

/* ---------- 密碼 ---------- */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}
export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const [algo, salt, hash] = stored.split(":");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}
export function sessionSecret(db: DB): string {
  return settingsStore.get(db, KEYS.sessionSecret) ?? "";
}

/* ---------- 平台一般設定 ---------- */
export function appName(db: DB): string {
  return settingsStore.get(db, KEYS.appName) || DEFAULT_APP_NAME;
}
export function allowSignup(db: DB): boolean {
  return (settingsStore.get(db, KEYS.allowSignup) ?? "1") !== "0";
}
export function trialDays(db: DB): number {
  const n = Number(settingsStore.get(db, KEYS.trialDays));
  return Number.isFinite(n) && n >= 0 && settingsStore.get(db, KEYS.trialDays) !== null ? n : DEFAULT_TRIAL_DAYS;
}

/* ---------- Meta 設定 ---------- */
export interface MetaConfig {
  appId: string;
  appSecret: string;
  verifyToken: string;
  graphVersion: string;
  loginConfigId?: string;
}
export function metaConfig(db: DB): MetaConfig {
  return {
    appId: settingsStore.get(db, KEYS.metaAppId) ?? "",
    appSecret: settingsStore.get(db, KEYS.metaAppSecret) ?? "",
    verifyToken: settingsStore.get(db, KEYS.verifyToken) ?? "",
    graphVersion: settingsStore.get(db, KEYS.graphVersion) || DEFAULT_GRAPH_VERSION,
    loginConfigId: settingsStore.get(db, KEYS.metaLoginConfigId) ?? "",
  };
}

/* ---------- PayUni 設定 ---------- */
export function payuniConfig(db: DB): PayuniConfig | null {
  const merId = settingsStore.get(db, KEYS.payuniMerId) ?? "";
  const hashKey = settingsStore.get(db, KEYS.payuniHashKey) ?? "";
  const hashIv = settingsStore.get(db, KEYS.payuniHashIv) ?? "";
  if (!merId || !hashKey || !hashIv) return null;
  return { merId, hashKey, hashIv, sandbox: (settingsStore.get(db, KEYS.payuniSandbox) ?? "1") !== "0" };
}

/** 對外網址：設定頁有填就用設定值，否則從目前請求推算（支援反向代理的 X-Forwarded-*） */
export function resolvePublicUrl(db: DB, req?: Request): string {
  const configured = settingsStore.get(db, KEYS.publicUrl)?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  if (!req) return "http://localhost:3000";
  const host = req.get("x-forwarded-host") ?? req.get("host") ?? "localhost";
  return `${req.protocol}://${host}`;
}
