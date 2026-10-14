import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import type { DB } from "./db.js";
import { settingsStore } from "./db.js";

/**
 * 所有可在後台「設定」頁修改的設定都存在 SQLite 的 settings 表。
 * 環境變數只在第一次啟動時當作初始值灌入（之後以資料庫為準）。
 */
export const KEYS = {
  adminPasswordHash: "admin_password_hash",
  sessionSecret: "session_secret",
  metaAppId: "meta_app_id",
  metaAppSecret: "meta_app_secret",
  verifyToken: "verify_token",
  graphVersion: "graph_version",
  publicUrl: "public_url",
} as const;

export const DEFAULT_GRAPH_VERSION = "v21.0";

export function seedFromEnv(db: DB) {
  const seed = (key: string, envName: string) => {
    if (settingsStore.get(db, key) === null && process.env[envName]) settingsStore.set(db, key, process.env[envName]!);
  };
  seed(KEYS.metaAppId, "META_APP_ID");
  seed(KEYS.metaAppSecret, "META_APP_SECRET");
  seed(KEYS.verifyToken, "META_VERIFY_TOKEN");
  seed(KEYS.graphVersion, "META_GRAPH_VERSION");
  seed(KEYS.publicUrl, "PUBLIC_URL");
  seed(KEYS.sessionSecret, "SESSION_SECRET");
  if (settingsStore.get(db, KEYS.adminPasswordHash) === null && process.env.ADMIN_PASSWORD) {
    settingsStore.set(db, KEYS.adminPasswordHash, hashPassword(process.env.ADMIN_PASSWORD));
  }
  if (settingsStore.get(db, KEYS.sessionSecret) === null) settingsStore.set(db, KEYS.sessionSecret, randomBytes(32).toString("hex"));
  if (settingsStore.get(db, KEYS.verifyToken) === null) settingsStore.set(db, KEYS.verifyToken, randomBytes(12).toString("hex"));
}

/* ---------- 密碼 ---------- */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}
export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const [algo, salt, hash] = stored.split(":");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}
export function hasAdminPassword(db: DB): boolean {
  return settingsStore.get(db, KEYS.adminPasswordHash) !== null;
}
export function setAdminPassword(db: DB, password: string) {
  settingsStore.set(db, KEYS.adminPasswordHash, hashPassword(password));
}
export function checkAdminPassword(db: DB, password: string): boolean {
  return verifyPassword(password, settingsStore.get(db, KEYS.adminPasswordHash));
}
export function sessionSecret(db: DB): string {
  return settingsStore.get(db, KEYS.sessionSecret) ?? "";
}

/* ---------- Meta 設定 ---------- */
export interface MetaConfig {
  appId: string;
  appSecret: string;
  verifyToken: string;
  graphVersion: string;
}
export function metaConfig(db: DB): MetaConfig {
  return {
    appId: settingsStore.get(db, KEYS.metaAppId) ?? "",
    appSecret: settingsStore.get(db, KEYS.metaAppSecret) ?? "",
    verifyToken: settingsStore.get(db, KEYS.verifyToken) ?? "",
    graphVersion: settingsStore.get(db, KEYS.graphVersion) || DEFAULT_GRAPH_VERSION,
  };
}

/** 對外網址：設定頁有填就用設定值，否則從目前請求推算（支援反向代理的 X-Forwarded-*） */
export function resolvePublicUrl(db: DB, req?: Request): string {
  const configured = settingsStore.get(db, KEYS.publicUrl)?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  if (!req) return "http://localhost:3000";
  const host = req.get("x-forwarded-host") ?? req.get("host") ?? "localhost";
  return `${req.protocol}://${host}`;
}
