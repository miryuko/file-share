import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTextShare, getTextShare } from "../../../src/services/text.service";
import { AppError } from "../../../src/utils/error";

function createMockKV(): KVNamespace {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    list: vi.fn(async () => ({ keys: [], list_complete: true, cursor: "" })),
  } as unknown as KVNamespace;
}

describe("createTextShare", () => {
  let mockKV: KVNamespace;

  beforeEach(() => {
    mockKV = createMockKV();
  });

  it("给定合法文本内容，应返回 6 位分享码和过期时间", async () => {
    const result = await createTextShare("Hello World", { FILE_KV: mockKV });

    expect(result.code).toMatch(/^[A-Z2-9]{6}$/);
    expect(result.expiresAt).toBeGreaterThan(Date.now());
    expect(mockKV.put).toHaveBeenCalled();
  });

  it("给定空字符串，应抛出 TEXT_EMPTY 错误", async () => {
    await expect(
      createTextShare("", { FILE_KV: mockKV }),
    ).rejects.toThrow(AppError);
  });

  it("给定纯空白字符串，应抛出 TEXT_EMPTY 错误", async () => {
    await expect(
      createTextShare("   ", { FILE_KV: mockKV }),
    ).rejects.toThrow(AppError);
  });

  it("给定超过 1MB 的内容，应抛出 TEXT_TOO_LARGE 错误", async () => {
    const huge = "a".repeat(1024 * 1024 + 1);
    await expect(
      createTextShare(huge, { FILE_KV: mockKV }),
    ).rejects.toThrow(AppError);
  });
});

describe("getTextShare", () => {
  let mockKV: KVNamespace;

  beforeEach(() => {
    mockKV = createMockKV();
  });

  it("给定存在的文本 entry，应返回内容", async () => {
    const entry = {
      code: "A3K9M2",
      content: "Hello World",
      createdAt: Date.now(),
      expiresAt: Date.now() + 3600000,
    };
    (mockKV.get as ReturnType<typeof vi.fn>).mockResolvedValue(
      JSON.stringify(entry),
    );

    const result = await getTextShare("A3K9M2", { FILE_KV: mockKV });

    expect(result.content).toBe("Hello World");
    expect(result.code).toBe("A3K9M2");
  });

  it("给定不存在的分享码，应抛出 TEXT_NOT_FOUND", async () => {
    await expect(
      getTextShare("XXXXXX", { FILE_KV: mockKV }),
    ).rejects.toThrow(AppError);
  });

  it("给定已过期的 text entry，应抛出 TEXT_EXPIRED", async () => {
    const entry = {
      code: "A3K9M2",
      content: "stale",
      createdAt: Date.now() - 7200000,
      expiresAt: Date.now() - 1000,
    };
    (mockKV.get as ReturnType<typeof vi.fn>).mockResolvedValue(
      JSON.stringify(entry),
    );

    await expect(
      getTextShare("A3K9M2", { FILE_KV: mockKV }),
    ).rejects.toThrow(AppError);
  });
});
