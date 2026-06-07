import { describe, it, expect } from "vitest";
import { formatFileSize, cn } from "../../../src/lib/utils";

describe("formatFileSize", () => {
  // ── 正常路径 ──
  it("给定 0 字节，应返回 0 B", () => {
    expect(formatFileSize(0)).toBe("0 B");
  });

  it("给定小于 1KB 的字节数，应以 B 为单位显示", () => {
    expect(formatFileSize(500)).toBe("500 B");
    expect(formatFileSize(1023)).toBe("1023 B");
  });

  it("给定恰好 1KB，应显示 1 KB", () => {
    expect(formatFileSize(1024)).toBe("1 KB");
  });

  it("给定 KB 级别的字节数，应以 KB 为单位显示整数", () => {
    expect(formatFileSize(20 * 1024)).toBe("20 KB");
    expect(formatFileSize(300 * 1024)).toBe("300 KB");
  });

  it("给定 MB 级别的字节数，应以 MB 为单位显示整数", () => {
    expect(formatFileSize(10 * 1024 * 1024)).toBe("10 MB");
    expect(formatFileSize(200 * 1024 * 1024)).toBe("200 MB");
  });

  it("给定 GB 级别的字节数，应以 GB 为单位显示整数", () => {
    expect(formatFileSize(100 * 1024 * 1024 * 1024)).toBe("100 GB");
  });

  // ── 边界 ──
  it("给定刚好超过 1KB 边界，应显示 KB 值", () => {
    expect(formatFileSize(1025)).toBe("1 KB");
  });

  it("给定刚好超过 1MB 边界，应显示 MB 值", () => {
    expect(formatFileSize(1024 * 1024 + 1)).toBe("1 MB");
  });

  it("给定非常大的字节数，应正确转换为 GB", () => {
    expect(formatFileSize(5 * 1024 * 1024 * 1024)).toBe("5 GB");
  });

  // ── 异常 ──
  it("给定负数，应返回 0 B", () => {
    expect(formatFileSize(-1)).toBe("0 B");
    expect(formatFileSize(-100)).toBe("0 B");
  });
});

describe("cn", () => {
  it("给定多个 class 值，应合并并去重 Tailwind 冲突", () => {
    expect(cn("px-4", "py-2")).toBe("px-4 py-2");
  });

  it("给定条件 class，应过滤掉 falsy 值", () => {
    expect(cn("base", false, undefined, null, "extra")).toBe("base extra");
  });
});
