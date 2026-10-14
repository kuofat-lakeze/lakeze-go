import "dotenv/config";

/**
 * 只有「程式啟動前就必須知道」的東西放環境變數。
 * Meta App、對外網址、管理員密碼等都可以在後台「設定」頁填；
 * 環境變數裡若有同名設定，只會在第一次啟動時當初始值灌入資料庫。
 */
export const config = {
  port: Number(process.env.PORT ?? 3000),
  databasePath: process.env.DATABASE_PATH ?? "./data/app.db",
};
