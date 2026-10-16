import { randomBytes } from "node:crypto";
import express, { Router } from "express";
import type { DB } from "../db.js";
import { channels, contacts, deletionRequests, events, users } from "../db.js";
import { metaConfig, resolvePublicUrl } from "../settings.js";
import { parseSignedRequest } from "../meta/signedRequest.js";

/**
 * Meta App 設定裡要填的兩個回呼：
 *  POST /meta/deauthorize   使用者在 Facebook 移除了這個 App → 標記頻道需要重新連接
 *  POST /meta/data-deletion 使用者要求刪除資料 → 刪掉他連接的頻道、權杖與這些頻道的聯絡人
 */
export function metaCallbacksRouter(db: DB): Router {
  const router = Router();
  router.use(express.urlencoded({ extended: false }));

  const verify = (body: unknown) => {
    const signed = (body as { signed_request?: string } | undefined)?.signed_request ?? "";
    const data = parseSignedRequest(signed, metaConfig(db).appSecret);
    const fbUserId = data?.user_id != null ? String(data.user_id) : null;
    return fbUserId;
  };

  router.post("/deauthorize", (req, res) => {
    const fbUserId = verify(req.body);
    if (!fbUserId) {
      res.status(400).json({ error: "invalid signed_request" });
      return;
    }
    for (const ch of channels.byFbUser(db, fbUserId)) {
      channels.setStatus(db, ch.id, "broken", "已在 Facebook 移除授權，請重新連接");
      events.log(db, { user_id: ch.user_id, channel_id: ch.id, type: "warning", summary: `「${ch.name}」已在 Facebook 移除授權，自動回覆已停止。請重新連接。` });
    }
    for (const u of users.byFbUser(db, fbUserId)) users.setFbUser(db, u.id, null, null);
    res.json({ ok: true });
  });

  router.post("/data-deletion", (req, res) => {
    const fbUserId = verify(req.body);
    if (!fbUserId) {
      res.status(400).json({ error: "invalid signed_request" });
      return;
    }
    const removed: string[] = [];
    for (const ch of channels.byFbUser(db, fbUserId)) {
      contacts.removeByChannel(db, ch.id);
      channels.remove(db, ch.id, ch.user_id);
      events.log(db, { user_id: ch.user_id, type: "warning", summary: `依 Facebook 的資料刪除要求，已移除「${ch.name}」與它的聯絡人資料` });
      removed.push(ch.name);
    }
    for (const u of users.byFbUser(db, fbUserId)) users.setFbUser(db, u.id, null, null);
    const code = randomBytes(8).toString("hex");
    deletionRequests.create(db, code, fbUserId, removed.length ? `已刪除：${removed.join("、")}` : "沒有找到需要刪除的資料");
    res.json({ url: `${resolvePublicUrl(db, req)}/data-deletion?code=${code}`, confirmation_code: code });
  });

  return router;
}
