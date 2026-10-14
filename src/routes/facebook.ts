import { randomBytes } from "node:crypto";
import { Router } from "express";
import type { DB } from "../db.js";
import { events } from "../db.js";
import { metaConfig, resolvePublicUrl } from "../settings.js";
import { exchangeCode, listPages, longLivedUserToken, oauthDialogUrl, type PageInfo } from "../meta/graph.js";
import { currentUser, readCookie, setCookie } from "./auth.js";

const STATE_COOKIE = "lg_fb_state";
const PENDING_TTL_MS = 15 * 60 * 1000;

/** OAuth 完成後暫存「可連接的粉絲專頁清單」，等後台勾選（綁定使用者，別人拿不到） */
const pending = new Map<string, { userId: number; pages: PageInfo[]; expires: number }>();

export function getPending(id: string, userId: number): PageInfo[] | null {
  const p = pending.get(id);
  if (!p) return null;
  if (p.expires < Date.now() || p.userId !== userId) {
    if (p.expires < Date.now()) pending.delete(id);
    return null;
  }
  return p.pages;
}
export function clearPending(id: string) {
  pending.delete(id);
}

export function callbackUrl(db: DB, req: Parameters<typeof resolvePublicUrl>[1]): string {
  return `${resolvePublicUrl(db, req)}/auth/facebook/callback`;
}

/**
 * /auth/facebook          → 導去 Facebook 授權
 * /auth/facebook/callback → 換權杖、列出專頁、導回後台選擇頁
 */
export function facebookRouter(db: DB, fetchImpl: typeof fetch = fetch): Router {
  const router = Router();

  router.get("/", (req, res) => {
    const user = currentUser(db, req);
    if (!user) {
      res.redirect("/#channels");
      return;
    }
    const cfg = metaConfig(db);
    if (!cfg.appId || !cfg.appSecret) {
      res.redirect("/#channels?error=" + encodeURIComponent("平台尚未設定 Meta App，請聯絡管理員"));
      return;
    }
    const state = randomBytes(16).toString("hex");
    setCookie(req, res, STATE_COOKIE, state, 600);
    res.redirect(oauthDialogUrl(cfg, callbackUrl(db, req), state));
  });

  router.get("/callback", async (req, res) => {
    const user = currentUser(db, req);
    const fail = (msg: string) => {
      events.log(db, { user_id: user?.id ?? null, type: "warning", summary: `Facebook 連接失敗：${msg}` });
      res.redirect("/#channels?error=" + encodeURIComponent(msg));
    };
    if (!user) return fail("尚未登入");
    const state = readCookie(req, STATE_COOKIE);
    if (!state || state !== req.query.state) return fail("state 驗證失敗，請重試");
    if (typeof req.query.error === "string") return fail(String(req.query.error_description ?? req.query.error));
    const code = req.query.code;
    if (typeof code !== "string") return fail("沒有收到授權碼");

    try {
      const cfg = metaConfig(db);
      const shortToken = await exchangeCode(cfg, code, callbackUrl(db, req), fetchImpl);
      const userToken = await longLivedUserToken(cfg, shortToken, fetchImpl);
      const pages = await listPages(cfg, userToken, fetchImpl);
      if (pages.length === 0) return fail("這個 Facebook 帳號沒有可管理的粉絲專頁，或授權時沒有勾選專頁");
      const id = randomBytes(12).toString("hex");
      pending.set(id, { userId: user.id, pages, expires: Date.now() + PENDING_TTL_MS });
      res.setHeader("set-cookie", `${STATE_COOKIE}=; Path=/; HttpOnly; Max-Age=0`);
      res.redirect(`/#channels/connect/${id}`);
    } catch (err) {
      fail(err instanceof Error ? err.message : String(err));
    }
  });

  return router;
}
