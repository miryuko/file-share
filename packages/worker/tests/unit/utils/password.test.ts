import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../../../src/utils/password";

describe("hashPassword", () => {
  it("应返回 pbkdf2: 格式的哈希字符串", async () => {
    const hash = await hashPassword("admin123");

    expect(hash).toMatch(/^pbkdf2:[a-f0-9]{32}:[a-f0-9]{64}$/);
  });

  it("相同密码两次哈希应产生不同的盐（不同的哈希）", async () => {
    const hash1 = await hashPassword("mypassword");
    const hash2 = await hashPassword("mypassword");

    expect(hash1).not.toBe(hash2);
  });

  it("应能处理特殊字符密码", async () => {
    const hash = await hashPassword("p@ss!世界𠮷");
    expect(hash).toMatch(/^pbkdf2:/);
  });

  it("空密码也应能哈希", async () => {
    const hash = await hashPassword("");
    expect(hash).toMatch(/^pbkdf2:/);
  });
});

describe("verifyPassword", () => {
  it("正确密码应返回 true", async () => {
    const hash = await hashPassword("secure123");
    const result = await verifyPassword("secure123", hash);
    expect(result).toBe(true);
  });

  it("错误密码应返回 false", async () => {
    const hash = await hashPassword("secure123");
    const result = await verifyPassword("wrong456", hash);
    expect(result).toBe(false);
  });

  it("兼容旧版明文密码（无 pbkdf2: 前缀）", async () => {
    // 旧版明文存储的密码
    const result = await verifyPassword("admin123", "admin123");
    expect(result).toBe(true);

    const wrong = await verifyPassword("wrong", "admin123");
    expect(wrong).toBe(false);
  });

  it("格式错误的哈希应返回 false", async () => {
    expect(await verifyPassword("p", "pbkdf2:invalid")).toBe(false);
    expect(await verifyPassword("p", "")).toBe(false);
  });
});
