import { config } from "./config.js";
import { openDb, plans, settingsStore, users } from "./db.js";
import { createGraphSender } from "./meta/sendApi.js";
import { createApp } from "./app.js";
import { seedExamplesForExistingUsers } from "./examples.js";
import { hashPassword, KEYS, metaConfig, payuniConfig, resolvePublicUrl, seedFromEnv } from "./settings.js";

const db = openDb(config.databasePath);
seedFromEnv(db);
plans.seedDefaults(db);

// 選填：用環境變數建立第一位平台擁有者（沒有的話第一位從網頁註冊的人就是擁有者）
if (users.count(db) === 0 && process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
  users.create(db, {
    email: process.env.ADMIN_EMAIL,
    name: process.env.ADMIN_NAME ?? "Admin",
    password_hash: hashPassword(process.env.ADMIN_PASSWORD),
    role: "owner",
    trial_until: null,
  });
}
// 替還沒有範例的帳號（含本版之前註冊的）補上範例自動回覆
seedExamplesForExistingUsers(db);

const app = createApp({ db, sender: createGraphSender(() => metaConfig(db).graphVersion) });

app.listen(config.port, () => {
  const configured = settingsStore.get(db, KEYS.publicUrl);
  console.log(`✅ Lakeze Go 已啟動：http://localhost:${config.port}`);
  console.log(`   對外網址：${configured ? resolvePublicUrl(db) : "尚未設定，會依每個請求的網域自動判斷（可在後台「設定」頁指定）"}`);
  if (users.count(db) === 0) console.log("👉 第一次使用：打開網址註冊，第一位註冊者即為平台擁有者");
  if (!metaConfig(db).appSecret) console.log("👉 到後台「設定」頁填入 Meta App ID / App Secret 後，用戶才能連接粉絲專頁");
  if (!payuniConfig(db)) console.log("👉 到後台「設定」頁填入 PayUni 商店代號 / HashKey / HashIV 後，用戶才能付費");
});
