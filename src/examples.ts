import type { DB, AutomationInput } from "./db.js";
import { automations } from "./db.js";
import type { Step } from "./types.js";

/**
 * 每個帳號預先建立的範例自動回覆。
 * 全部預設「不啟用」，所以不會對真的客人送出；使用者打開、修改並儲存後就變成自己的。
 */
type Example = Omit<AutomationInput, "user_id" | "enabled" | "channel_id">;

const btn = (title: string, url: string) => ({ type: "url" as const, title, url, track: true });

export const EXAMPLES: Example[] = [
  {
    name: "【範例】廣告點擊 → 導向商品頁",
    priority: 10,
    platform: "any",
    trigger_type: "any_ad",
    trigger_value: "",
    steps: [
      {
        type: "buttons",
        text: "嗨 {{first_name}} 👋 謝謝你對我們的廣告有興趣！\n現在下單享首購 9 折，點下方按鈕直接選購 👇",
        buttons: [btn("立即選購", "https://example.com/shop?utm_source=meta&utm_medium=messenger")],
      },
      { type: "tag", tag: "廣告名單" },
    ] satisfies Step[],
  },
  {
    name: "【範例】活動廣告（ref）→ 報名頁",
    priority: 20,
    platform: "any",
    trigger_type: "ref",
    trigger_value: "event_signup",
    steps: [
      {
        type: "buttons",
        text: "嗨 {{first_name}}，名額有限！\n點下方按鈕完成報名，我們會寄送行前通知給你 📩",
        buttons: [btn("立即報名", "https://example.com/event")],
      },
      { type: "tag", tag: "活動報名" },
    ],
  },
  {
    name: "【範例】關鍵字：詢問價格",
    priority: 0,
    platform: "any",
    trigger_type: "keyword",
    trigger_value: "價格, 多少錢, 費用, 價錢",
    steps: [
      {
        type: "buttons",
        text: "{{first_name}} 你好！所有方案與價格都整理在這裡 👇\n有其他問題直接留言，我們會盡快回覆你。",
        buttons: [btn("查看價格", "https://example.com/pricing")],
      },
    ],
  },
  {
    name: "【範例】歡迎新朋友",
    priority: 0,
    platform: "any",
    trigger_type: "get_started",
    trigger_value: "",
    steps: [
      {
        type: "quick_replies",
        text: "歡迎 {{first_name}} 😊 想先了解什麼呢？",
        replies: [
          { title: "看價格", payload: "EXAMPLE_PRICE" },
          { title: "營業時間", payload: "EXAMPLE_HOURS" },
        ],
      },
    ],
  },
  {
    name: "【範例】選單回答：營業時間",
    priority: 0,
    platform: "any",
    trigger_type: "postback",
    trigger_value: "EXAMPLE_HOURS",
    steps: [{ type: "text", text: "我們的營業時間是週一到週五 10:00–19:00，週末 11:00–18:00 🕙" }],
  },
];

export function seedExamples(db: DB, userId: number) {
  for (const e of EXAMPLES) {
    automations.create(db, { ...e, user_id: userId, enabled: 0, channel_id: null }, { isExample: true });
  }
  db.prepare("UPDATE users SET examples_seeded = 1 WHERE id = ?").run(userId);
}

/** 啟動時替還沒拿過範例的既有帳號補上 */
export function seedExamplesForExistingUsers(db: DB) {
  const rows = db.prepare("SELECT id FROM users WHERE examples_seeded = 0").all() as { id: number }[];
  for (const r of rows) seedExamples(db, Number(r.id));
}
