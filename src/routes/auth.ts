import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response, Router } from "express";
import { Router as makeRouter } from "express";
import type { DB } from "../db.js";
import { checkAdminPassword, hasAdminPassword, sessionSecret, setAdminPassword } from "../settings.js";

const COOKIE = "lg_session";
const SESSION_DAYS = 30;

function sign(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}
function makeToken(secret: string): string {
  const payload = String(Date.now() + SESSION_DAYS * 86400 * 1000);
  return `${payload}.${sign(secret, payload)}`;
}
function validToken(secret: string, token: string | undefined): boolean {
  if (!token || !secret) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = sign(secret, payload);
  if (sig.length !== expected.length) return false;
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  return Number(payload) > Date.now();
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

export function isLoggedIn(db: DB, req: Request): boolean {
  if (validToken(sessionSecret(db), readCookie(req, COOKIE))) return true;
  // 也允許 Bearer 密碼，方便用 curl / 腳本呼叫 API
  const auth = req.header("authorization");
  return !!auth?.startsWith("Bearer ") && checkAdminPassword(db, auth.slice(7));
}

export function requireAuth(db: DB) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (isLoggedIn(db, req)) return next();
    res.status(401).json({ error: "未登入" });
  };
}

export function authRouter(db: DB): Router {
  const router = makeRouter();

  router.get("/me", (req, res) => {
    res.json({ authenticated: isLoggedIn(db, req), needs_setup: !hasAdminPassword(db) });
  });

  /** 第一次使用：設定管理員密碼（只有在尚未設定時可用） */
  router.post("/setup", (req, res) => {
    if (hasAdminPassword(db)) {
      res.status(400).json({ error: "已經設定過密碼，請直接登入" });
      return;
    }
    const pw = typeof req.body?.password === "string" ? req.body.password : "";
    if (pw.length < 8) {
      res.status(400).json({ error: "密碼至少 8 個字元" });
      return;
    }
    setAdminPassword(db, pw);
    setCookie(req, res, COOKIE, makeToken(sessionSecret(db)), SESSION_DAYS * 86400);
    res.json({ ok: true });
  });

  router.post("/login", (req, res) => {
    const pw = typeof req.body?.password === "string" ? req.body.password : "";
    if (!checkAdminPassword(db, pw)) {
      res.status(401).json({ error: "密碼錯誤" });
      return;
    }
    setCookie(req, res, COOKIE, makeToken(sessionSecret(db)), SESSION_DAYS * 86400);
    res.json({ ok: true });
  });

  router.post("/logout", (_req, res) => {
    res.setHeader("set-cookie", `${COOKIE}=; Path=/; HttpOnly; Max-Age=0`);
    res.json({ ok: true });
  });

  /** 已登入者更改密碼 */
  router.post("/password", requireAuth(db), (req, res) => {
    const current = typeof req.body?.current === "string" ? req.body.current : "";
    const next = typeof req.body?.password === "string" ? req.body.password : "";
    if (!checkAdminPassword(db, current)) {
      res.status(400).json({ error: "目前密碼錯誤" });
      return;
    }
    if (next.length < 8) {
      res.status(400).json({ error: "新密碼至少 8 個字元" });
      return;
    }
    setAdminPassword(db, next);
    res.json({ ok: true });
  });

  return router;
}
