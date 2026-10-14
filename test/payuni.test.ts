import { describe, expect, it } from "vitest";
import { buildCheckout, decrypt, encrypt, hashInfo, makeTradeNo, parseResult, toQueryString } from "../src/billing/payuni.js";

const cfg = { merId: "ABC", hashKey: "12345678901234567890123456789012", hashIv: "1234567890123456", sandbox: true };

describe("PayUni 加解密", () => {
  it("加密後可解回原文，格式為 hex(base64:::base64)", () => {
    const plain = "MerID=ABC&MerTradeNo=T1&TradeAmt=100";
    const enc = encrypt(cfg, plain);
    expect(/^[0-9a-f]+$/.test(enc)).toBe(true);
    const joined = Buffer.from(enc, "hex").toString("utf8");
    expect(joined.includes(":::")).toBe(true);
    expect(decrypt(cfg, enc)).toBe(plain);
  });

  it("HashInfo 為 SHA256(key + enc + iv) 大寫", () => {
    const h = hashInfo(cfg, "abc");
    expect(h).toBe(h.toUpperCase());
    expect(h).toHaveLength(64);
  });

  it("金鑰長度錯誤會丟錯", () => {
    expect(() => encrypt({ hashKey: "short", hashIv: cfg.hashIv }, "x")).toThrow();
  });

  it("buildCheckout 產生 UPP 表單且可被解密驗證", () => {
    const form = buildCheckout(cfg, {
      merTradeNo: "LG123",
      amount: 990,
      description: "月繳方案",
      returnUrl: "https://go.example.com/payuni/return",
      notifyUrl: "https://go.example.com/payuni/notify",
      email: "a@b.c",
      timestamp: 1700000000,
    });
    expect(form.action).toBe("https://sandbox-api.payuni.com.tw/api/upp");
    expect(form.fields.MerID).toBe("ABC");
    expect(form.fields.Version).toBe("1.0");
    expect(form.fields.HashInfo).toBe(hashInfo(cfg, form.fields.EncryptInfo));
    const plain = decrypt(cfg, form.fields.EncryptInfo);
    expect(plain).toContain("MerTradeNo=LG123");
    expect(plain).toContain("TradeAmt=990");
    expect(plain).toContain("Timestamp=1700000000");
    expect(plain).toContain("UsrMail=a%40b.c");
  });

  it("parseResult 驗章成功並判斷付款狀態", () => {
    const payload = toQueryString({ Status: "SUCCESS", MerTradeNo: "LG123", TradeNo: "16661", TradeAmt: 990, TradeStatus: 1, PaymentType: "1" });
    const enc = encrypt(cfg, payload);
    const r = parseResult(cfg, { MerID: "ABC", Status: "SUCCESS", EncryptInfo: enc, HashInfo: hashInfo(cfg, enc) });
    expect(r.paid).toBe(true);
    expect(r.data.MerTradeNo).toBe("LG123");
    expect(r.data.TradeAmt).toBe("990");

    const failed = encrypt(cfg, toQueryString({ Status: "FAIL", MerTradeNo: "LG123", TradeStatus: 0 }));
    expect(parseResult(cfg, { Status: "SUCCESS", EncryptInfo: failed, HashInfo: hashInfo(cfg, failed) }).paid).toBe(false);
  });

  it("parseResult 驗章失敗會丟錯", () => {
    const enc = encrypt(cfg, "a=1");
    expect(() => parseResult(cfg, { Status: "SUCCESS", EncryptInfo: enc, HashInfo: "deadbeef" })).toThrow(/驗章/);
  });

  it("makeTradeNo 為 20 字英數", () => {
    const n = makeTradeNo();
    expect(n).toHaveLength(20);
    expect(/^LG\d{18}$/.test(n)).toBe(true);
  });
});
