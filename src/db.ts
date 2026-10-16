import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Automation, Channel, Contact, Step } from "./types.js";

export type DB = DatabaseSync;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  trial_until TEXT,
  paid_until TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  months INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL,
  plan_id INTEGER,
  plan_name TEXT NOT NULL,
  amount INTEGER NOT NULL,
  months INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payuni_trade_no TEXT,
  payment_type TEXT,
  paid_at TEXT,
  raw TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, id DESC);

CREATE TABLE IF NOT EXISTS channels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  platform TEXT NOT NULL,
  external_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  access_token TEXT NOT NULL,
  instagram_login INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS automations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL DEFAULT 0,
  platform TEXT NOT NULL DEFAULT 'any',
  channel_id INTEGER,
  trigger_type TEXT NOT NULL,
  trigger_value TEXT NOT NULL DEFAULT '',
  steps TEXT NOT NULL DEFAULT '[]',
  triggered_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_automations_user ON automations(user_id);

CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  channel_id INTEGER NOT NULL,
  platform TEXT NOT NULL,
  psid TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  profile_pic TEXT,
  source_ad_id TEXT,
  source_ref TEXT,
  source_automation_id INTEGER,
  tags TEXT NOT NULL DEFAULT '[]',
  first_seen TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(channel_id, psid)
);
CREATE INDEX IF NOT EXISTS idx_contacts_user ON contacts(user_id, last_seen DESC);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  channel_id INTEGER,
  contact_id INTEGER,
  automation_id INTEGER,
  type TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  payload TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id, id DESC);

CREATE TABLE IF NOT EXISTS links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  automation_id INTEGER,
  clicks INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS link_clicks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  link_id INTEGER NOT NULL,
  contact_id INTEGER,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS processed_events (
  key TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

export function openDb(path: string): DB {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  migrate(db);
  return db;
}

/** 對既有資料庫補上新欄位（SQLite 沒有 ADD COLUMN IF NOT EXISTS） */
function migrate(db: DB) {
  const hasColumn = (table: string, column: string) =>
    (db.prepare(`PRAGMA table_info(${table})`).all() as Row[]).some((c) => c.name === column);
  if (!hasColumn("automations", "is_example")) db.exec("ALTER TABLE automations ADD COLUMN is_example INTEGER NOT NULL DEFAULT 0");
  if (!hasColumn("users", "examples_seeded")) db.exec("ALTER TABLE users ADD COLUMN examples_seeded INTEGER NOT NULL DEFAULT 0");
  // 第一則訊息已放進廣告 JSON：客人從廣告進來互動時不重複送出
  if (!hasColumn("automations", "ad_json")) db.exec("ALTER TABLE automations ADD COLUMN ad_json INTEGER NOT NULL DEFAULT 0");
  // 連線健康狀態
  if (!hasColumn("channels", "status")) db.exec("ALTER TABLE channels ADD COLUMN status TEXT NOT NULL DEFAULT 'ok'");
  if (!hasColumn("channels", "last_error")) db.exec("ALTER TABLE channels ADD COLUMN last_error TEXT");
  if (!hasColumn("channels", "checked_at")) db.exec("ALTER TABLE channels ADD COLUMN checked_at TEXT");
  if (!hasColumn("channels", "fb_user_id")) db.exec("ALTER TABLE channels ADD COLUMN fb_user_id TEXT");
  // 小編接手時暫停自動回覆
  if (!hasColumn("contacts", "paused_until")) db.exec("ALTER TABLE contacts ADD COLUMN paused_until TEXT");
  // 讀取廣告清單用的長效使用者權杖（選用）
  if (!hasColumn("users", "fb_user_id")) db.exec("ALTER TABLE users ADD COLUMN fb_user_id TEXT");
  if (!hasColumn("users", "fb_user_token")) db.exec("ALTER TABLE users ADD COLUMN fb_user_token TEXT");
  db.exec(`CREATE TABLE IF NOT EXISTS deletion_requests (
    code TEXT PRIMARY KEY,
    fb_user_id TEXT NOT NULL,
    detail TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
}

type Row = Record<string, unknown>;

function safeJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}
function rowToAutomation(r: Row): Automation {
  return { ...(r as unknown as Automation), steps: safeJson<Step[]>(r.steps as string, []) };
}
function rowToContact(r: Row): Contact {
  return { ...(r as unknown as Contact), tags: safeJson<string[]>(r.tags as string, []) };
}

/* ---------- users ---------- */
export type UserRole = "owner" | "member";
export interface User {
  id: number;
  email: string;
  name: string;
  password_hash: string;
  role: UserRole;
  trial_until: string | null; // ISO
  paid_until: string | null; // ISO
  /** 連接 Facebook 的那個人（App 範圍的使用者 ID）與長效使用者權杖，用來讀取廣告清單 */
  fb_user_id?: string | null;
  fb_user_token?: string | null;
  created_at: string;
}
export const users = {
  count(db: DB): number {
    return Number((db.prepare("SELECT COUNT(*) n FROM users").get() as Row).n);
  },
  get(db: DB, id: number): User | undefined {
    return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as unknown as User | undefined;
  },
  byEmail(db: DB, email: string): User | undefined {
    return db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase().trim()) as unknown as User | undefined;
  },
  list(db: DB): User[] {
    return db.prepare("SELECT * FROM users ORDER BY id").all() as unknown as User[];
  },
  create(db: DB, u: { email: string; name: string; password_hash: string; role: UserRole; trial_until: string | null }): User {
    const res = db
      .prepare("INSERT INTO users (email, name, password_hash, role, trial_until) VALUES (?, ?, ?, ?, ?)")
      .run(u.email.toLowerCase().trim(), u.name, u.password_hash, u.role, u.trial_until);
    return users.get(db, Number(res.lastInsertRowid))!;
  },
  setPassword(db: DB, id: number, hash: string) {
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, id);
  },
  setPaidUntil(db: DB, id: number, iso: string) {
    db.prepare("UPDATE users SET paid_until = ? WHERE id = ?").run(iso, id);
  },
  setTrialUntil(db: DB, id: number, iso: string | null) {
    db.prepare("UPDATE users SET trial_until = ? WHERE id = ?").run(iso, id);
  },
  setRole(db: DB, id: number, role: UserRole) {
    db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, id);
  },
  setFbUser(db: DB, id: number, fbUserId: string | null, token: string | null) {
    db.prepare("UPDATE users SET fb_user_id = ?, fb_user_token = ? WHERE id = ?").run(fbUserId, token, id);
  },
  byFbUser(db: DB, fbUserId: string): User[] {
    return db.prepare("SELECT * FROM users WHERE fb_user_id = ?").all(fbUserId) as unknown as User[];
  },
};

/* ---------- plans ---------- */
export interface Plan {
  id: number;
  code: string;
  name: string;
  price: number;
  months: number;
  active: number;
  sort: number;
}
export const plans = {
  list(db: DB, activeOnly = false): Plan[] {
    return db
      .prepare(`SELECT * FROM plans ${activeOnly ? "WHERE active = 1" : ""} ORDER BY sort, id`)
      .all() as unknown as Plan[];
  },
  get(db: DB, id: number): Plan | undefined {
    return db.prepare("SELECT * FROM plans WHERE id = ?").get(id) as unknown as Plan | undefined;
  },
  upsert(db: DB, p: Omit<Plan, "id"> & { id?: number }): Plan {
    if (p.id) {
      db.prepare("UPDATE plans SET code = ?, name = ?, price = ?, months = ?, active = ?, sort = ? WHERE id = ?").run(
        p.code,
        p.name,
        p.price,
        p.months,
        p.active ? 1 : 0,
        p.sort,
        p.id,
      );
      return plans.get(db, p.id)!;
    }
    const res = db
      .prepare("INSERT INTO plans (code, name, price, months, active, sort) VALUES (?, ?, ?, ?, ?, ?)")
      .run(p.code, p.name, p.price, p.months, p.active ? 1 : 0, p.sort);
    return plans.get(db, Number(res.lastInsertRowid))!;
  },
  remove(db: DB, id: number) {
    db.prepare("DELETE FROM plans WHERE id = ?").run(id);
  },
  seedDefaults(db: DB) {
    if (plans.list(db).length > 0) return;
    plans.upsert(db, { code: "monthly", name: "月繳方案", price: 990, months: 1, active: 1, sort: 1 });
    plans.upsert(db, { code: "yearly", name: "年繳方案（省兩個月）", price: 9900, months: 12, active: 1, sort: 2 });
  },
};

/* ---------- orders ---------- */
export type OrderStatus = "pending" | "paid" | "failed";
export interface Order {
  id: number;
  order_no: string;
  user_id: number;
  plan_id: number | null;
  plan_name: string;
  amount: number;
  months: number;
  status: OrderStatus;
  payuni_trade_no: string | null;
  payment_type: string | null;
  paid_at: string | null;
  raw: string | null;
  created_at: string;
}
export const orders = {
  create(db: DB, o: { order_no: string; user_id: number; plan_id: number | null; plan_name: string; amount: number; months: number }): Order {
    const res = db
      .prepare("INSERT INTO orders (order_no, user_id, plan_id, plan_name, amount, months) VALUES (?, ?, ?, ?, ?, ?)")
      .run(o.order_no, o.user_id, o.plan_id, o.plan_name, o.amount, o.months);
    return orders.get(db, Number(res.lastInsertRowid))!;
  },
  get(db: DB, id: number): Order | undefined {
    return db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as unknown as Order | undefined;
  },
  byOrderNo(db: DB, orderNo: string): Order | undefined {
    return db.prepare("SELECT * FROM orders WHERE order_no = ?").get(orderNo) as unknown as Order | undefined;
  },
  listForUser(db: DB, userId: number, limit = 50): Order[] {
    return db.prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT ?").all(userId, limit) as unknown as Order[];
  },
  listAll(db: DB, limit = 200): (Order & { email: string })[] {
    return db
      .prepare("SELECT o.*, u.email FROM orders o LEFT JOIN users u ON u.id = o.user_id ORDER BY o.id DESC LIMIT ?")
      .all(limit) as unknown as (Order & { email: string })[];
  },
  markPaid(db: DB, id: number, info: { payuni_trade_no: string | null; payment_type: string | null; raw: unknown }) {
    db.prepare(
      "UPDATE orders SET status = 'paid', payuni_trade_no = ?, payment_type = ?, paid_at = datetime('now'), raw = ? WHERE id = ?",
    ).run(info.payuni_trade_no, info.payment_type, JSON.stringify(info.raw), id);
  },
  markFailed(db: DB, id: number, raw: unknown) {
    db.prepare("UPDATE orders SET status = 'failed', raw = ? WHERE id = ? AND status = 'pending'").run(JSON.stringify(raw), id);
  },
};

/* ---------- channels ---------- */
export const channels = {
  list(db: DB, userId: number): Channel[] {
    return db.prepare("SELECT * FROM channels WHERE user_id = ? ORDER BY id").all(userId) as unknown as Channel[];
  },
  get(db: DB, id: number): Channel | undefined {
    return db.prepare("SELECT * FROM channels WHERE id = ?").get(id) as unknown as Channel | undefined;
  },
  byExternalId(db: DB, externalId: string): Channel | undefined {
    return db.prepare("SELECT * FROM channels WHERE external_id = ?").get(externalId) as unknown as Channel | undefined;
  },
  upsert(db: DB, c: Omit<Channel, "id" | "created_at" | "status" | "last_error" | "checked_at">): Channel {
    // 重新連接 = 拿到新權杖，所以狀態一併恢復正常
    db.prepare(
      `INSERT INTO channels (user_id, platform, external_id, name, access_token, instagram_login, fb_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(external_id) DO UPDATE SET
         user_id = excluded.user_id, platform = excluded.platform, name = excluded.name,
         access_token = excluded.access_token, instagram_login = excluded.instagram_login,
         fb_user_id = COALESCE(excluded.fb_user_id, channels.fb_user_id),
         status = 'ok', last_error = NULL, checked_at = datetime('now')`,
    ).run(c.user_id, c.platform, c.external_id, c.name, c.access_token, c.instagram_login ? 1 : 0, c.fb_user_id ?? null);
    return channels.byExternalId(db, c.external_id)!;
  },
  all(db: DB): Channel[] {
    return db.prepare("SELECT * FROM channels ORDER BY id").all() as unknown as Channel[];
  },
  /** 記錄健康檢查結果；狀態有變化時回傳 true */
  setStatus(db: DB, id: number, status: "ok" | "broken", error: string | null): boolean {
    const before = channels.get(db, id);
    db.prepare("UPDATE channels SET status = ?, last_error = ?, checked_at = datetime('now') WHERE id = ?").run(status, error, id);
    return !!before && before.status !== status;
  },
  byFbUser(db: DB, fbUserId: string): Channel[] {
    return db.prepare("SELECT * FROM channels WHERE fb_user_id = ?").all(fbUserId) as unknown as Channel[];
  },
  remove(db: DB, id: number, userId: number) {
    db.prepare("DELETE FROM channels WHERE id = ? AND user_id = ?").run(id, userId);
  },
};

/* ---------- automations ---------- */
export type AutomationInput = Omit<Automation, "id" | "triggered_count" | "is_example" | "ad_json" | "created_at" | "updated_at">;

export const automations = {
  list(db: DB, userId: number): Automation[] {
    return (db.prepare("SELECT * FROM automations WHERE user_id = ? ORDER BY priority DESC, id DESC").all(userId) as Row[]).map(
      rowToAutomation,
    );
  },
  listEnabled(db: DB, userId: number): Automation[] {
    return (
      db.prepare("SELECT * FROM automations WHERE user_id = ? AND enabled = 1 ORDER BY priority DESC, id DESC").all(userId) as Row[]
    ).map(rowToAutomation);
  },
  get(db: DB, id: number, userId?: number): Automation | undefined {
    const r = db.prepare("SELECT * FROM automations WHERE id = ?").get(id) as Row | undefined;
    if (!r) return undefined;
    if (userId !== undefined && Number(r.user_id) !== userId) return undefined;
    return rowToAutomation(r);
  },
  create(db: DB, a: AutomationInput, opts: { isExample?: boolean } = {}): Automation {
    const res = db
      .prepare(
        `INSERT INTO automations (user_id, name, enabled, priority, platform, channel_id, trigger_type, trigger_value, steps, is_example)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        a.user_id,
        a.name,
        a.enabled ? 1 : 0,
        a.priority,
        a.platform,
        a.channel_id,
        a.trigger_type,
        a.trigger_value,
        JSON.stringify(a.steps),
        opts.isExample ? 1 : 0,
      );
    return automations.get(db, Number(res.lastInsertRowid))!;
  },
  /** 任何更新（含啟用）都代表使用者採用了它，所以會清掉範例標記 */
  update(db: DB, id: number, a: AutomationInput): Automation | undefined {
    db.prepare(
      `UPDATE automations SET name = ?, enabled = ?, priority = ?, platform = ?, channel_id = ?,
         trigger_type = ?, trigger_value = ?, steps = ?, is_example = 0, updated_at = datetime('now') WHERE id = ? AND user_id = ?`,
    ).run(a.name, a.enabled ? 1 : 0, a.priority, a.platform, a.channel_id, a.trigger_type, a.trigger_value, JSON.stringify(a.steps), id, a.user_id);
    return automations.get(db, id, a.user_id);
  },
  remove(db: DB, id: number, userId: number) {
    db.prepare("DELETE FROM automations WHERE id = ? AND user_id = ?").run(id, userId);
  },
  setAdJson(db: DB, id: number, userId: number, on: boolean) {
    db.prepare("UPDATE automations SET ad_json = ? WHERE id = ? AND user_id = ?").run(on ? 1 : 0, id, userId);
  },
  bumpTriggered(db: DB, id: number) {
    db.prepare("UPDATE automations SET triggered_count = triggered_count + 1 WHERE id = ?").run(id);
  },
};

/* ---------- contacts ---------- */
export const contacts = {
  list(db: DB, userId: number, limit = 200): Contact[] {
    return (db.prepare("SELECT * FROM contacts WHERE user_id = ? ORDER BY last_seen DESC LIMIT ?").all(userId, limit) as Row[]).map(
      rowToContact,
    );
  },
  get(db: DB, id: number, userId?: number): Contact | undefined {
    const r = db.prepare("SELECT * FROM contacts WHERE id = ?").get(id) as Row | undefined;
    if (!r) return undefined;
    if (userId !== undefined && Number(r.user_id) !== userId) return undefined;
    return rowToContact(r);
  },
  find(db: DB, channelId: number, psid: string): Contact | undefined {
    const r = db.prepare("SELECT * FROM contacts WHERE channel_id = ? AND psid = ?").get(channelId, psid) as Row | undefined;
    return r ? rowToContact(r) : undefined;
  },
  /** 找到或建立聯絡人，並更新 last_seen */
  touch(db: DB, channel: Channel, psid: string): { contact: Contact; isNew: boolean } {
    const existing = contacts.find(db, channel.id, psid);
    if (existing) {
      db.prepare("UPDATE contacts SET last_seen = datetime('now') WHERE id = ?").run(existing.id);
      return { contact: existing, isNew: false };
    }
    db.prepare("INSERT INTO contacts (user_id, channel_id, platform, psid) VALUES (?, ?, ?, ?)").run(
      channel.user_id,
      channel.id,
      channel.platform,
      psid,
    );
    return { contact: contacts.find(db, channel.id, psid)!, isNew: true };
  },
  setProfile(db: DB, id: number, p: { first_name?: string; last_name?: string; profile_pic?: string }) {
    db.prepare(
      `UPDATE contacts SET first_name = COALESCE(?, first_name), last_name = COALESCE(?, last_name),
         profile_pic = COALESCE(?, profile_pic) WHERE id = ?`,
    ).run(p.first_name ?? null, p.last_name ?? null, p.profile_pic ?? null, id);
  },
  setSource(db: DB, id: number, s: { ad_id: string | null; ref: string | null; automation_id: number | null }) {
    db.prepare(
      `UPDATE contacts SET source_ad_id = COALESCE(source_ad_id, ?), source_ref = COALESCE(source_ref, ?),
         source_automation_id = COALESCE(source_automation_id, ?) WHERE id = ?`,
    ).run(s.ad_id, s.ref, s.automation_id, id);
  },
  /** 小編接手：在 until 之前不跑自動回覆；null = 恢復 */
  setPausedUntil(db: DB, id: number, until: string | null) {
    db.prepare("UPDATE contacts SET paused_until = ? WHERE id = ?").run(until, id);
  },
  removeByChannel(db: DB, channelId: number) {
    db.prepare("DELETE FROM contacts WHERE channel_id = ?").run(channelId);
  },
  /** 依廣告統計帶進來的聯絡人數 */
  countByAd(db: DB, userId: number): Record<string, number> {
    const rows = db.prepare("SELECT source_ad_id ad, COUNT(*) n FROM contacts WHERE user_id = ? AND source_ad_id IS NOT NULL GROUP BY source_ad_id").all(userId) as Row[];
    return Object.fromEntries(rows.map((r) => [String(r.ad), Number(r.n)]));
  },
  addTag(db: DB, id: number, tag: string) {
    const c = contacts.get(db, id);
    if (!c || c.tags.includes(tag)) return;
    db.prepare("UPDATE contacts SET tags = ? WHERE id = ?").run(JSON.stringify([...c.tags, tag]), id);
  },
  remove(db: DB, id: number, userId: number) {
    db.prepare("DELETE FROM contacts WHERE id = ? AND user_id = ?").run(id, userId);
  },
};

/* ---------- events ---------- */
export interface EventRow {
  id: number;
  user_id: number | null;
  channel_id: number | null;
  contact_id: number | null;
  automation_id: number | null;
  type: string;
  summary: string;
  payload: string | null;
  created_at: string;
}
export const events = {
  log(
    db: DB,
    e: {
      user_id?: number | null;
      channel_id?: number | null;
      contact_id?: number | null;
      automation_id?: number | null;
      type: string;
      summary: string;
      payload?: unknown;
    },
  ) {
    db.prepare(
      "INSERT INTO events (user_id, channel_id, contact_id, automation_id, type, summary, payload) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run(
      e.user_id ?? null,
      e.channel_id ?? null,
      e.contact_id ?? null,
      e.automation_id ?? null,
      e.type,
      e.summary,
      e.payload === undefined ? null : JSON.stringify(e.payload),
    );
  },
  /** 一般用戶看自己的；平台擁有者（userId = null）看全部含系統事件 */
  list(db: DB, userId: number | null, limit = 200): EventRow[] {
    if (userId === null) return db.prepare("SELECT * FROM events ORDER BY id DESC LIMIT ?").all(limit) as unknown as EventRow[];
    return db.prepare("SELECT * FROM events WHERE user_id = ? ORDER BY id DESC LIMIT ?").all(userId, limit) as unknown as EventRow[];
  },
  /** 這位聯絡人最近一次某種事件距今幾秒（沒有就是 null） */
  secondsSince(db: DB, contactId: number, type: string): number | null {
    const r = db
      .prepare("SELECT (julianday('now') - julianday(created_at)) * 86400 s FROM events WHERE contact_id = ? AND type = ? ORDER BY id DESC LIMIT 1")
      .get(contactId, type) as Row | undefined;
    return r ? Number(r.s) : null;
  },
  /** 最近 N 天內某種事件的次數 */
  countRecent(db: DB, userId: number, type: string, days: number): number {
    const r = db.prepare("SELECT COUNT(*) n FROM events WHERE user_id = ? AND type = ? AND created_at >= datetime('now', ?)").get(userId, type, `-${days} days`) as Row;
    return Number(r.n);
  },
  forContact(db: DB, contactId: number, limit = 100): EventRow[] {
    return db.prepare("SELECT * FROM events WHERE contact_id = ? ORDER BY id DESC LIMIT ?").all(contactId, limit) as unknown as EventRow[];
  },
  /** 以 (channel, sender, timestamp, kind) 去重，避免 Meta 重送同一事件時回覆兩次 */
  markProcessed(db: DB, key: string): boolean {
    try {
      db.prepare("INSERT INTO processed_events (key) VALUES (?)").run(key);
      db.prepare("DELETE FROM processed_events WHERE created_at < datetime('now', '-1 day')").run();
      return true;
    } catch {
      return false;
    }
  },
};

/* ---------- links ---------- */
export interface LinkRow {
  id: number;
  user_id: number;
  slug: string;
  url: string;
  automation_id: number | null;
  clicks: number;
  created_at: string;
}
export const links = {
  list(db: DB, userId: number): LinkRow[] {
    return db.prepare("SELECT * FROM links WHERE user_id = ? ORDER BY id DESC").all(userId) as unknown as LinkRow[];
  },
  bySlug(db: DB, slug: string): LinkRow | undefined {
    return db.prepare("SELECT * FROM links WHERE slug = ?").get(slug) as unknown as LinkRow | undefined;
  },
  /** 同一個自動化 + 同一個目的網址只建立一個追蹤連結 */
  ensure(db: DB, userId: number, url: string, automationId: number | null, slug: string): LinkRow {
    const existing = db.prepare("SELECT * FROM links WHERE url = ? AND automation_id IS ? AND user_id = ?").get(url, automationId, userId) as
      | unknown
      | undefined;
    if (existing) return existing as LinkRow;
    db.prepare("INSERT INTO links (user_id, slug, url, automation_id) VALUES (?, ?, ?, ?)").run(userId, slug, url, automationId);
    return links.bySlug(db, slug)!;
  },
  recordClick(db: DB, linkId: number, contactId: number | null, userAgent: string | null) {
    db.prepare("UPDATE links SET clicks = clicks + 1 WHERE id = ?").run(linkId);
    db.prepare("INSERT INTO link_clicks (link_id, contact_id, user_agent) VALUES (?, ?, ?)").run(linkId, contactId, userAgent);
  },
};

/* ---------- settings (key/value) ---------- */
export const settingsStore = {
  get(db: DB, key: string): string | null {
    const r = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as Row | undefined;
    return r ? String(r.value) : null;
  },
  set(db: DB, key: string, value: string) {
    db.prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')",
    ).run(key, value);
  },
  remove(db: DB, key: string) {
    db.prepare("DELETE FROM settings WHERE key = ?").run(key);
  },
};

export function stats(db: DB, userId: number) {
  const one = (sql: string) => Number((db.prepare(sql).get(userId) as Row).n ?? 0);
  return {
    contacts: one("SELECT COUNT(*) n FROM contacts WHERE user_id = ?"),
    contacts_from_ads: one("SELECT COUNT(*) n FROM contacts WHERE user_id = ? AND (source_ad_id IS NOT NULL OR source_ref IS NOT NULL)"),
    contacts_today: one("SELECT COUNT(*) n FROM contacts WHERE user_id = ? AND first_seen >= date('now')"),
    automations: one("SELECT COUNT(*) n FROM automations WHERE user_id = ? AND enabled = 1"),
    triggered: one("SELECT COALESCE(SUM(triggered_count),0) n FROM automations WHERE user_id = ?"),
    link_clicks: one("SELECT COALESCE(SUM(clicks),0) n FROM links WHERE user_id = ?"),
  };
}

export function platformStats(db: DB) {
  const one = (sql: string) => Number((db.prepare(sql).get() as Row).n ?? 0);
  return {
    users: one("SELECT COUNT(*) n FROM users"),
    paying_users: one("SELECT COUNT(*) n FROM users WHERE paid_until > strftime('%Y-%m-%dT%H:%M:%fZ','now')"),
    revenue: one("SELECT COALESCE(SUM(amount),0) n FROM orders WHERE status = 'paid'"),
    channels: one("SELECT COUNT(*) n FROM channels"),
  };
}

/* ---------- Meta 資料刪除要求 ---------- */
export const deletionRequests = {
  create(db: DB, code: string, fbUserId: string, detail: string) {
    db.prepare("INSERT INTO deletion_requests (code, fb_user_id, detail) VALUES (?, ?, ?)").run(code, fbUserId, detail);
  },
  get(db: DB, code: string): { code: string; fb_user_id: string; detail: string | null; created_at: string } | undefined {
    return db.prepare("SELECT * FROM deletion_requests WHERE code = ?").get(code) as never;
  },
};
