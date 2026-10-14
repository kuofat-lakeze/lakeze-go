import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response, Router } from "express";
import { Router as makeRouter } from "express";
import type { DB, User } from "../db.js";
import { users } from "../db.js";
import { allowSignup, appName, hashPassword, sessionSecret, trialDays, verifyPassword } from "../settings.js";
import { subscriptionStatus, trialEnd } from "../billing/subscription.js";

const COOKIE = "lg_session";
const SESSION_DAYS = 30;

function sign(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}
function makeToken(secret: string, userId: number): string {
  const payload = `${userId}.${Date.now() + SESSION_DAYS * 86400 * 1000}`;
  return `${payload}.${sign(secret, payload)}`;
}
function parseToken(secret: string, token: string | undefined): number | null {
  if (!token || !secret) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [uid, exp, sig] = parts;
  const expected = sign(secret, `${uid}.${exp}`);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  if (Number(exp) < Date.now()) return null;
  const id = Number(uid);
  return Number.isInteger(id) ? id : null;
}
export function readCookie(req: Request, name: string): string | undefined {
  const header = req.header("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}
export function isSecure(req: Request): boolean {
  return req.secure || req.header("x-forwarded-proto") === "https";
}
export function setCookie(req: Request, res: Response, name: string, value: string, maxAgeSec: number) {
  res.appendHeader(
    "set-cookie",
    `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${isSecure(req) ? "; Secure" : ""}`,
  );
}

/** 從 cookie 或 Basic auth（email:password，給腳本用）取得目前使用者 */
export function currentUser(db: DB, req: Request): User | null {
  const id = parseToken(sessionSecret(db), readCookie(req, COOKIE));
  if (id) return users.get(db, id) ?? null;
  const auth = req.header("authorization");
  if (auth?.startsWith("Basic ")) {
    const [email, ...pw] = Buffer.from(auth.slice(6), "base64").toString("utf8").split(":");
    const u = users.byEmail(db, email ?? "");
    if (u && verifyPassword(pw.join(":"), u.password_hash)) return u;
  }
  return null;
}

export function requireAuth(db: DB) {
  return (req: Request, res: Response, next: NextFunction) => {
    const u = currentUser(db, req);
    if (!u) {
      res.status(401).json({ error: "未登入" });
      return;
    }
    res.locals.user = u;
    next();
  };
}
export function requireOwner(_req: Request, res: Response, next: NextFunction) {
  const u = res.locals.user as User | undefined;
  if (u?.role !== "owner") {
    res.status(403).json({ error: "只有平台擁有者可以執行此操作" });
    return;
  }
  next();
}
export const userOf = (res: Response): User => res.locals.user as User;

export function publicUser(u: User) {
  return { id: u.id, email: u.email, name: u.name, role: u.role, created_at: u.created_at, subscription: subscriptionStatus(u) };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function authRouter(db: DB): Router {
  const router = makeRouter();

  router.get("/me", (req, res) => {
    const u = currentUser(db, req);
    res.json({
      authenticated: !!u,
      user: u ? publicUser(u) : null,
      needs_setup: users.count(db) === 0,
      allow_signup: allowSignup(db),
      app_name: appName(db),
      trial_days: trialDays(db),
    });
  });

  /** 註冊：第一位註冊者成為平台擁有者 */
  router.post("/signup", (req, res) => {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const name = String(req.body?.name ?? "").trim();
    const first = users.count(db) === 0;
    if (!first && !allowSignup(db)) {
      res.status(403).json({ error: "目前未開放註冊" });
      return;
    }
    if (!EMAIL_RE.test(email)) {
      res.status(400).json({ error: "Email 格式不正確" });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: "密碼至少 8 個字元" });
      return;
    }
    if (users.byEmail(db, email)) {
      res.status(409).json({ error: "這個 Email 已經註冊過，請直接登入" });
      return;
    }
    const u = users.create(db, {
      email,
      name: name || email.split("@")[0],
      password_hash: hashPassword(password),
      role: first ? "owner" : "member",
      trial_until: first ? null : trialEnd(trialDays(db)),
    });
    setCookie(req, res, COOKIE, makeToken(sessionSecret(db), u.id), SESSION_DAYS * 86400);
    res.status(201).json({ ok: true, user: publicUser(u) });
  });

  router.post("/login", (req, res) => {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const u = users.byEmail(db, email);
    if (!u || !verifyPassword(password, u.password_hash)) {
      res.status(401).json({ error: "Email 或密碼錯誤" });
      return;
    }
    setCookie(req, res, COOKIE, makeToken(sessionSecret(db), u.id), SESSION_DAYS * 86400);
    res.json({ ok: true, user: publicUser(u) });
  });

  router.post("/logout", (_req, res) => {
    res.setHeader("set-cookie", `${COOKIE}=; Path=/; HttpOnly; Max-Age=0`);
    res.json({ ok: true });
  });

  router.post("/password", requireAuth(db), (req, res) => {
    const u = userOf(res);
    const current = typeof req.body?.current === "string" ? req.body.current : "";
    const next = typeof req.body?.password === "string" ? req.body.password : "";
    if (!verifyPassword(current, u.password_hash)) {
      res.status(400).json({ error: "目前密碼錯誤" });
      return;
    }
    if (next.length < 8) {
      res.status(400).json({ error: "新密碼至少 8 個字元" });
      return;
    }
    users.setPassword(db, u.id, hashPassword(next));
    res.json({ ok: true });
  });

  return router;
}
