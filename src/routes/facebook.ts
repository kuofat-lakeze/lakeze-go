import { randomBytes } from "node:crypto";
import { Router } from "express";
import type { DB } from "../db.js";
import { events, users } from "../db.js";
import { metaConfig, resolvePublicUrl } from "../settings.js";
import {
  ADS_SCOPE,
  exchangeCode,
  getMe,
  getPermissions,
  INSTAGRAM_SCOPES,
  listPages,
  longLivedUserToken,
  oauthDialogUrl,
  REQUIRED_SCOPES,
  type PageInfo,
} from "../meta/graph.js";
import { currentUser, readCookie, setCookie } from "./auth.js";

const STATE_COOKIE = "lg_fb_state";
const PENDING_TTL_MS = 15 * 60 * 1000;

export interface PendingConnect {
  userId: number;
  fbUserId: string | null;
  pages: PageInfo[];
  /** 授權時被取消勾選、但收發訊息需要的權限 */
  missing: string[];
  /** 被取消勾選的 Instagram 權限（有 IG 的專頁才需要） */
  missingInstagram: string[];
  expires: number;
}

/** OAuth 完成後暫存「可連接的粉絲專頁清單」，等後台勾選（綁定使用者，別人拿不到） */
const pending = new Map<string, PendingConnect>();

export function getPending(id: string, userId: number): PendingConnect | null {
  const p = pending.get(id);
  if (!p) return null;
  if (p.expires < Date.now() || p.userId !== userId) {
    if (p.expires < Date.now()) pending.delete(id);
    return null;
  }
  return p;
}
export function clearPending(id: string) {
  pending.delete(id);
}

export function callbackUrl(db: DB, req: Parameters<typeof resolvePublicUrl>[1]): string {
  return `${resolvePublicUrl(db, req)}/auth/facebook/callback`;
}

/** 授權完成後要回到的後台頁面（只接受站內的 #hash，避免被拿去轉址） */
const safeReturn = (v: unknown) => (typeof v === "string" && /^#[\w/-]*$/.test(v) ? v : "");

/**
 * /auth/facebook              → 導去 Facebook 授權（連接粉絲專頁）
 * /auth/facebook?rerequest=1  → 重新詢問上次被取消勾選的權限
 * /auth/facebook?ads=1        → 另外授權讀取廣告清單（廣告挑選器用）
 * /auth/facebook/callback     → 換權杖、檢查權限、列出專頁、導回後台
 */
export function facebookRouter(db: DB, fetchImpl: typeof fetch = fetch): Router {
  const router = Router();

  router.get("/", (req, res) => {
    const user = currentUser(db, req);
    if (!user) {
      res.redirect("/#connections");
      return;
    }
    const cfg = metaConfig(db);
    if (!cfg.appId || !cfg.appSecret) {
      res.redirect("/#connections?error=" + encodeURIComponent("平台尚未設定 Meta App，請聯絡管理員"));
      return;
    }
    const mode = req.query.ads ? "ads" : "pages";
    const state = randomBytes(16).toString("hex");
    setCookie(req, res, STATE_COOKIE, JSON.stringify({ state, mode, ret: safeReturn(req.query.return) }), 600);
    res.redirect(
      oauthDialogUrl(cfg, callbackUrl(db, req), state, {
        extraScopes: mode === "ads" ? [ADS_SCOPE] : [],
        rerequest: !!req.query.rerequest || mode === "ads",
      }),
    );
  });

  router.get("/callback", async (req, res) => {
    const user = currentUser(db, req);
    let saved: { state?: string; mode?: string; ret?: string } = {};
    try {
      saved = JSON.parse(readCookie(req, STATE_COOKIE) ?? "{}");
    } catch {
      /* 舊格式或被竄改 */
    }
    const back = saved.ret || (saved.mode === "ads" ? "#automations" : "#connections");
    const fail = (msg: string) => {
      events.log(db, { user_id: user?.id ?? null, type: "warning", summary: `Facebook 連接失敗：${msg}` });
      res.redirect(`/${back}?error=${encodeURIComponent(msg)}`);
    };
    if (!user) return fail("尚未登入");
    if (!saved.state || saved.state !== req.query.state) return fail("state 驗證失敗，請重試");
    if (typeof req.query.error === "string") {
      return fail(req.query.error === "access_denied" ? "你取消了 Facebook 授權，沒有連接任何東西" : String(req.query.error_description ?? req.query.error));
    }
    const code = req.query.code;
    if (typeof code !== "string") return fail("沒有收到授權碼");

    try {
      const cfg = metaConfig(db);
      const shortToken = await exchangeCode(cfg, code, callbackUrl(db, req), fetchImpl);
      const userToken = await longLivedUserToken(cfg, shortToken, fetchImpl);
      const me = await getMe(cfg, userToken, fetchImpl).catch(() => null);
      const perms = await getPermissions(cfg, userToken, fetchImpl).catch(() => null);
      users.setFbUser(db, user.id, me?.id ?? null, userToken);
      res.appendHeader("set-cookie", `${STATE_COOKIE}=; Path=/; HttpOnly; Max-Age=0`);

      if (saved.mode === "ads") {
        if (perms && !perms.granted.includes(ADS_SCOPE)) return fail("沒有允許「讀取廣告清單」，所以無法列出廣告。可以再試一次並勾選允許");
        events.log(db, { user_id: user.id, type: "info", summary: "已允許讀取廣告清單" });
        res.redirect(`/${back}?ads=granted`);
        return;
      }

      const granted = perms?.granted ?? [];
      const missing = perms ? REQUIRED_SCOPES.filter((p) => !granted.includes(p)) : [];
      const missingInstagram = perms ? INSTAGRAM_SCOPES.filter((p) => !granted.includes(p)) : [];
      const pages = await listPages(cfg, userToken, fetchImpl);
      if (pages.length === 0) {
        return fail(
          missing.includes("pages_show_list")
            ? "授權時沒有允許「列出你的粉絲專頁」，請重新連接並全部允許"
            : "這個 Facebook 帳號沒有可管理的粉絲專頁，或授權時沒有勾選任何專頁。請重新連接，在 Facebook 視窗按「編輯設定」勾選專頁",
        );
      }
      const id = randomBytes(12).toString("hex");
      pending.set(id, { userId: user.id, fbUserId: me?.id ?? null, pages, missing, missingInstagram, expires: Date.now() + PENDING_TTL_MS });
      res.redirect(`/#connections/connect/${id}`);
    } catch (err) {
      fail(err instanceof Error ? err.message : String(err));
    }
  });

  return router;
}
