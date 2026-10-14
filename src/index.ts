import { config } from "./config.js";
import { openDb, settingsStore } from "./db.js";
import { createGraphSender } from "./meta/sendApi.js";
import { createApp } from "./app.js";
import { hasAdminPassword, KEYS, metaConfig, resolvePublicUrl, seedFromEnv } from "./settings.js";

const db = openDb(config.databasePath);
seedFromEnv(db);

const app = createApp({ db, sender: createGraphSender(() => metaConfig(db).graphVersion) });

app.listen(config.port, () => {
  console.log(`✅ Lakeze Go 已啟動：http://localhost:${config.port}`);
  const configured = settingsStore.get(db, KEYS.publicUrl);
  console.log(`   對外網址：${configured ? resolvePublicUrl(db) : "尚未設定，會依每個請求的網域自動判斷（可在後台「設定」頁指定）"}`);
  if (!hasAdminPassword(db)) console.log("👉 第一次使用：打開網址設定管理員密碼");
  if (!metaConfig(db).appSecret) console.log("👉 到後台「設定」頁填入 Meta App ID / App Secret 後即可連接粉絲專頁");
});
