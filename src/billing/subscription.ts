import type { DB, Order, User } from "../db.js";
import { users } from "../db.js";

export interface SubscriptionStatus {
  active: boolean;
  source: "owner" | "paid" | "trial" | "expired" | "none";
  until: string | null; // ISO
  days_left: number | null;
}

export function subscriptionStatus(user: User, now = new Date()): SubscriptionStatus {
  if (user.role === "owner") return { active: true, source: "owner", until: null, days_left: null };
  const paid = user.paid_until ? new Date(user.paid_until) : null;
  const trial = user.trial_until ? new Date(user.trial_until) : null;
  const days = (d: Date) => Math.max(0, Math.ceil((d.getTime() - now.getTime()) / 86400000));
  if (paid && paid > now) return { active: true, source: "paid", until: paid.toISOString(), days_left: days(paid) };
  if (trial && trial > now) return { active: true, source: "trial", until: trial.toISOString(), days_left: days(trial) };
  const last = [paid, trial].filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  return { active: false, source: last ? "expired" : "none", until: last ? last.toISOString() : null, days_left: 0 };
}

export function isSubscriptionActive(db: DB, userId: number): boolean {
  const u = users.get(db, userId);
  return !!u && subscriptionStatus(u).active;
}

export function trialEnd(days: number, from = new Date()): string | null {
  if (days <= 0) return null;
  return new Date(from.getTime() + days * 86400000).toISOString();
}

/** 付款成功：從「目前到期日」或「現在」較晚者起算，延長 N 個月 */
export function applyPaidOrder(db: DB, order: Order, now = new Date()): string {
  const user = users.get(db, order.user_id);
  if (!user) throw new Error("找不到訂單對應的使用者");
  const current = user.paid_until ? new Date(user.paid_until) : null;
  const base = current && current > now ? current : now;
  const next = new Date(base);
  next.setUTCMonth(next.getUTCMonth() + order.months);
  const iso = next.toISOString();
  users.setPaidUntil(db, user.id, iso);
  return iso;
}
