import { randomBytes } from "node:crypto";
import type { Automation, Step } from "../types.js";
import type { DB } from "../db.js";
import { links } from "../db.js";

/**
 * 把自動回覆的第一則訊息轉成「點擊後開啟 Messenger 廣告」可貼上的 JSON。
 * 客人一點廣告，Messenger 就直接顯示這則訊息（含前往網址的按鈕），不用等客人先傳訊息。
 *
 * 廣告裡沒有客人資料，所以 {{first_name}} 之類的變數會被拿掉；
 * 網址按鈕改走本系統的追蹤連結（沒有聯絡人參數），仍可統計點擊。
 */
export interface AdJsonResult {
  json: { message: Record<string, unknown> };
  /** 被放進廣告的步驟索引（runner 會在客人從廣告進來時略過它） */
  step_index: number;
  warnings: string[];
}

const CONTENT_TYPES = new Set<Step["type"]>(["text", "buttons", "quick_replies", "image"]);

export function firstContentStep(steps: Step[]): number {
  return steps.findIndex((s) => CONTENT_TYPES.has(s.type));
}

/** 移除個人化變數並整理留下的空白與標點 */
export function stripVariables(s: string): { text: string; removed: boolean } {
  const removed = /\{\{[^}]*\}\}/.test(s);
  const text = s
    .replace(/\{\{[^}]*\}\}/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([，,！!。.？?])/g, "$1")
    .replace(/^[ \t]*[，,][ \t]*/gm, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/^[ \t]+/gm, "")
    .trim();
  return { text, removed };
}

export function buildAdJson(a: Automation, opts: { db: DB; publicUrl: string }): AdJsonResult {
  const idx = firstContentStep(a.steps);
  if (idx < 0) throw new Error("這個自動回覆沒有可以放進廣告的訊息");
  const step = a.steps[idx];
  const warnings: string[] = [];
  let removedVar = false;
  const clean = (s: string) => {
    const r = stripVariables(s);
    removedVar ||= r.removed;
    return r.text;
  };
  const trackedUrl = (url: string, track: boolean | undefined) => {
    if (track === false) return url;
    const link = links.ensure(opts.db, a.user_id, url, a.id, randomBytes(5).toString("base64url"));
    return `${opts.publicUrl}/r/${link.slug}`;
  };

  let message: Record<string, unknown>;
  switch (step.type) {
    case "text":
      message = { text: clean(step.text) };
      break;
    case "buttons":
      message = {
        attachment: {
          type: "template",
          payload: {
            template_type: "button",
            text: clean(step.text),
            buttons: step.buttons.slice(0, 3).map((b) =>
              b.type === "postback"
                ? { type: "postback", title: clean(b.title).slice(0, 20), payload: b.payload }
                : { type: "web_url", title: clean(b.title).slice(0, 20), url: trackedUrl(b.url, b.track) },
            ),
          },
        },
      };
      break;
    case "quick_replies":
      message = {
        text: clean(step.text),
        quick_replies: step.replies.slice(0, 13).map((r) => ({ content_type: "text", title: clean(r.title).slice(0, 20), payload: r.payload })),
      };
      break;
    case "image":
      message = { attachment: { type: "image", payload: { url: step.url } } };
      break;
    default:
      throw new Error("這個自動回覆沒有可以放進廣告的訊息");
  }

  if (removedVar) warnings.push("廣告裡拿不到客人的名字，已自動拿掉 {{first_name}} 等變數。");
  const laterContent = a.steps.slice(idx + 1).filter((s) => CONTENT_TYPES.has(s.type)).length;
  if (laterContent) warnings.push(`廣告裡只會顯示第一則訊息；後面 ${laterContent} 則會在客人回覆或點選後送出。`);
  if (opts.publicUrl.includes("localhost")) warnings.push("對外網址還是 localhost，請先在平台設定填入正式網址，追蹤連結才打得開。");
  if (a.platform === "instagram") warnings.push("Instagram 廣告不支援 JSON，這段只適用於 Messenger 廣告。");
  return { json: { message }, step_index: idx, warnings };
}
