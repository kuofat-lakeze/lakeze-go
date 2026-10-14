import { Router, raw } from "express";
import type { DB } from "../db.js";
import { events } from "../db.js";
import type { Sender } from "../meta/sendApi.js";
import { handleIncomingEvent } from "../engine/handler.js";
import { parseWebhook } from "../meta/parser.js";
import { verifySignature } from "../meta/signature.js";
import { metaConfig, resolvePublicUrl } from "../settings.js";

/** Meta Webhook：GET 驗證、POST 接收事件 */
export function webhookRouter(db: DB, sender: Sender): Router {
  const router = Router();

  router.get("/", (req, res) => {
    const { verifyToken } = metaConfig(db);
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (mode === "subscribe" && verifyToken && token === verifyToken && typeof challenge === "string") {
      res.status(200).type("text/plain").send(challenge);
      return;
    }
    events.log(db, { type: "warning", summary: "Webhook 驗證失敗：verify token 不符" });
    res.status(403).send("verify token 不符");
  });

  router.post("/", raw({ type: "*/*", limit: "2mb" }), (req, res) => {
    const rawBody = req.body as Buffer;
    const { appSecret } = metaConfig(db);
    if (appSecret) {
      if (!verifySignature(appSecret, rawBody, req.header("x-hub-signature-256"))) {
        events.log(db, { type: "warning", summary: "Webhook 簽章驗證失敗，已拒絕（請確認 App Secret）" });
        res.status(401).send("invalid signature");
        return;
      }
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody.toString("utf8"));
    } catch {
      res.status(400).send("bad json");
      return;
    }

    // Meta 要求 20 秒內回 200，所以先回應再非同步處理
    res.status(200).send("EVENT_RECEIVED");

    const publicUrl = resolvePublicUrl(db, req);
    const incoming = parseWebhook(body);
    void (async () => {
      for (const ev of incoming) {
        try {
          await handleIncomingEvent(ev, { db, sender, publicUrl });
        } catch (err) {
          events.log(db, {
            type: "error",
            summary: `處理事件時發生錯誤：${err instanceof Error ? err.message : String(err)}`,
            payload: ev.raw,
          });
        }
      }
    })();
  });

  return router;
}
