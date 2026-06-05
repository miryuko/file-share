import { describe, it, expect } from "vitest";
import { generateCode, isValidCode } from "../../../src/utils/code";

describe("generateCode", () => {
  it("给定正常调用，应返回 6 位字符串", () => {
    const code = generateCode();
    expect(code).toHaveLength(6);
    expect(typeof code).toBe("string");
  });

  it("返回的字符应全部来自合法字符集（无 0/O/1/I/L）", () => {
    // 运行多次确保覆盖
    for (let i = 0; i < 100; i++) {
      const code = generateCode();
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    }
  });

  it("连续生成 100 次，应无连续重复（随机性基本保证）", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 100; i++) {
      codes.add(generateCode());
    }
    // 100 次生成应至少有 50 个不同码（大概率事件）
    expect(codes.size).toBeGreaterThan(50);
  });
});

describe("isValidCode", () => {
  it("给定合法 6 位码，应返回 true", () => {
    expect(isValidCode("A3K9M2")).toBe(true);
    expect(isValidCode("B7NX5P")).toBe(true);
    expect(isValidCode("Z9Y8W4")).toBe(true);
  });

  it("给定包含非法字符的码，应返回 false", () => {
    expect(isValidCode("A3K9M0")).toBe(false); // 含 0
    expect(isValidCode("A3K9MO")).toBe(false); // 含 O
    expect(isValidCode("A3K9M1")).toBe(false); // 含 1
    expect(isValidCode("A3K9MI")).toBe(false); // 含 I
    expect(isValidCode("A3K9ML")).toBe(false); // 含 L
  });

  it("给定长度不对的码，应返回 false", () => {
    expect(isValidCode("A3K9M")).toBe(false); // 5 位
    expect(isValidCode("A3K9M22")).toBe(false); // 7 位
    expect(isValidCode("")).toBe(false);
  });

  it("给定非字符串类型，应返回 false", () => {
    expect(isValidCode(null)).toBe(false);
    expect(isValidCode(undefined)).toBe(false);
    expect(isValidCode(123456)).toBe(false);
  });
});
