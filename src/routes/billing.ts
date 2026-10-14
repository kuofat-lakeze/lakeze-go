import { Router, urlencoded } from "express";
import type { DB } from "../db.js";
import { events, orders, plans, users } from "../db.js";
import { payuniConfig, resolvePublicUrl } from "../settings.js";
import { buildCheckout, makeTradeNo, parseResult } from "../billing/payuni.js";
import { applyPaidOrder, subscriptionStatus } from "../billing/subscription.js";
import { requireOwner, userOf } from "./auth.js";
import { HttpError } from "./errors.js";

/** 已登入的 /api/billing/* */
export function billingApiRouter(db: DB): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    const u = userOf(res);
    res.json({
      subscription: subscriptionStatus(u),
      plans: plans.list(db, true),
      orders: orders.listForUser(db, u.id),
      payuni_configured: payuniConfig(db) !== null,
      payuni_sandbox: payuniConfig(db)?.sandbox ?? true,
    });
  });

  /** 建立訂單並回傳 PayUni 整合式支付頁的表單，前端自動 POST 送出 */
  router.post("/checkout", (req, res) => {
    const u = userOf(res);
    const cfg = payuniConfig(db);
    if (!cfg) throw new HttpError(400, "平台尚未設定金流，請聯絡管理員");
    const plan = plans.get(db, Number(req.body?.plan_id));
    if (!plan || !plan.active) throw new HttpError(400, "方案不存在或已停售");
    const order = orders.create(db, {
      order_no: makeTradeNo(),
      user_id: u.id,
      plan_id: plan.id,
      plan_name: plan.name,
      amount: plan.price,
      months: plan.months,
    });
    const base = resolvePublicUrl(db, req);
    const form = buildCheckout(cfg, {
      merTradeNo: order.order_no,
      amount: order.amount,
      description: `${plan.name}（${plan.months} 個月）`,
      returnUrl: `${base}/payuni/return`,
      notifyUrl: `${base}/payuni/notify`,
      backUrl: `${base}/#billing`,
      email: u.email,
    });
    events.log(db, { user_id: u.id, type: "info", summary: `建立訂單 ${order.order_no}：${plan.name} NT$${plan.price}` });
    res.json({ order_no: order.order_no, ...form });
  });

  /* ---- 平台擁有者：方案管理與全部訂單 ---- */
  router.get("/plans", requireOwner, (_req, res) => res.json(plans.list(db)));
  router.post("/plans", requireOwner, (req, res) => {
    const b = req.body ?? {};
    const code = String(b.code ?? "").trim();
    const name = String(b.name ?? "").trim();
    const price = Number(b.price);
    const months = Number(b.months);
    if (!code || !/^[a-z0-9_-]+$/i.test(code)) throw new HttpError(400, "代碼只能用英數、底線、連字號");
    if (!name) throw new HttpError(400, "請填方案名稱");
    if (!Number.isInteger(price) || price <= 0) throw new HttpError(400, "價格需為正整數（新台幣）");
    if (!Number.isInteger(months) || months <= 0 || months > 60) throw new HttpError(400, "月數需為 1 到 60");
    res.json(
      plans.upsert(db, {
        id: b.id ? Number(b.id) : undefined,
        code,
        name,
        price,
        months,
        active: b.active === false || b.active === 0 ? 0 : 1,
        sort: Number.isFinite(Number(b.sort)) ? Number(b.sort) : 0,
      }),
    );
  });
  router.delete("/plans/:id", requireOwner, (req, res) => {
    plans.remove(db, Number(req.params.id));
    res.json({ ok: true });
  });
  router.get("/orders/all", requireOwner, (_req, res) => res.json(orders.listAll(db)));
  /** 擁有者手動延長某用戶（例如匯款、贈送） */
  router.post("/grant", requireOwner, (req, res) => {
    const target = users.get(db, Number(req.body?.user_id));
    const months = Number(req.body?.months);
    if (!target) throw new HttpError(404, "找不到使用者");
    if (!Number.isInteger(months) || months <= 0) throw new HttpError(400, "月數需為正整數");
    const order = orders.create(db, { order_no: `MANUAL${Date.now()}`, user_id: target.id, plan_id: null, plan_name: "手動延長", amount: 0, months });
    orders.markPaid(db, order.id, { payuni_trade_no: null, payment_type: "manual", raw: { by: userOf(res).id } });
    const until = applyPaidOrder(db, orders.get(db, order.id)!);
    events.log(db, { user_id: target.id, type: "info", summary: `管理員手動延長 ${months} 個月，到期日 ${until}` });
    res.json({ ok: true, paid_until: until });
  });

  return router;
}

/** 公開的 /payuni/notify 與 /payuni/return（PayUni 伺服器與瀏覽器回呼） */
export function payuniCallbackRouter(db: DB): Router {
  const router = Router();
  router.use(urlencoded({ extended: false }));

  function settle(body: Record<string, unknown>): { ok: boolean; message: string; orderNo?: string } {
    const cfg = payuniConfig(db);
    if (!cfg) return { ok: false, message: "金流未設定" };
    const result = parseResult(cfg, body);
    const orderNo = result.data.MerTradeNo;
    const order = orderNo ? orders.byOrderNo(db, orderNo) : undefined;
    if (!order) {
      events.log(db, { type: "warning", summary: `收到 PayUni 回呼但找不到訂單 ${orderNo ?? "?"}`, payload: result.data });
      return { ok: false, message: "找不到訂單", orderNo };
    }
    if (order.status === "paid") return { ok: true, message: "已入帳", orderNo };
    if (!result.paid) {
      orders.markFailed(db, order.id, result.data);
      events.log(db, { user_id: order.user_id, type: "warning", summary: `訂單 ${order.order_no} 付款未成功：${result.message || result.data.Message || result.status}`, payload: result.data });
      return { ok: false, message: result.message || "付款未成功", orderNo };
    }
    if (Number(result.data.TradeAmt) !== order.amount) {
      events.log(db, { user_id: order.user_id, type: "error", summary: `訂單 ${order.order_no} 金額不符：預期 ${order.amount}，收到 ${result.data.TradeAmt}`, payload: result.data });
      return { ok: false, message: "金額不符", orderNo };
    }
    orders.markPaid(db, order.id, { payuni_trade_no: result.data.TradeNo ?? null, payment_type: result.data.PaymentType ?? null, raw: result.data });
    const until = applyPaidOrder(db, orders.get(db, order.id)!);
    events.log(db, { user_id: order.user_id, type: "info", summary: `訂單 ${order.order_no} 付款成功（${order.plan_name} NT$${order.amount}），方案到期日延長至 ${until}` });
    return { ok: true, message: "付款成功", orderNo };
  }

  router.post("/notify", (req, res) => {
    try {
      const r = settle(req.body ?? {});
      res.status(200).send(r.ok ? "SUCCESS" : r.message);
    } catch (err) {
      events.log(db, { type: "error", summary: `PayUni Notify 處理失敗：${err instanceof Error ? err.message : String(err)}`, payload: req.body });
      res.status(400).send("ERROR");
    }
  });

  router.post("/return", (req, res) => {
    try {
      const r = settle(req.body ?? {});
      res.redirect(`/#billing?${r.ok ? "paid=1" : "error=" + encodeURIComponent(r.message)}`);
    } catch (err) {
      res.redirect(`/#billing?error=${encodeURIComponent(err instanceof Error ? err.message : String(err))}`);
    }
  });
  // 有些情況 PayUni 會用 GET 導回（例如取消）
  router.get("/return", (_req, res) => res.redirect("/#billing"));

  return router;
}
