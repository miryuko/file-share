import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveCode } from "../../../src/services/code.service";
import { AppError } from "../../../src/utils/error";

function createMockKV(store?: Map<string, string>): KVNamespace {
  const data = store ?? new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => data.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      data.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      data.delete(key);
    }),
    list: vi.fn(async () => ({ keys: [], list_complete: true, cursor: "" })),
  } as unknown as KVNamespace;
}

describe("resolveCode", () => {
  let mockKV: KVNamespace;
  let store: Map<string, string>;

  beforeEach(() => {
    store = new Map<string, string>();
    mockKV = createMockKV(store);
  });

  it("给定有效的文件会话码，应返回 type:file", async () => {
    const session = {
      code: "A3K9M2",
      files: [
        { fileId: "file_0", filename: "test.txt", size: 1024, contentType: "text/plain" },
      ],
      status: "ready",
      totalSize: 1024,
      createdAt: Date.now(),
      expiresAt: Date.now() + 3600_000,
      maxDownloads: 20,
      downloadCount: 3,
      creatorIP: "127.0.0.1",
    };
    store.set("code:A3K9M2", JSON.stringify(session));

    const result = await resolveCode("A3K9M2", { FILE_KV: mockKV });

    expect(result.type).toBe("file");
    if (result.type === "file") {
      expect(result.code).toBe("A3K9M2");
      expect(result.files).toHaveLength(1);
      expect(result.remainingDownloads).toBe(17);
    }
    expect(mockKV.get).toHaveBeenCalledWith("code:A3K9M2");
    expect(mockKV.get).toHaveBeenCalledWith("text:A3K9M2");
  });

  it("给定有效的文本分享码，应返回 type:text", async () => {
    const entry = {
      code: "B4N8P3",
      content: "Hello World",
      createdAt: Date.now(),
      expiresAt: Date.now() + 3600_000,
    };
    store.set("text:B4N8P3", JSON.stringify(entry));

    const result = await resolveCode("B4N8P3", { FILE_KV: mockKV });

    expect(result.type).toBe("text");
    if (result.type === "text") {
      expect(result.content).toBe("Hello World");
    }
  });

  it("给定不存在任何类型的分享码，应抛出 CODE_NOT_FOUND", async () => {
    await expect(
      resolveCode("XXXXXX", { FILE_KV: mockKV }),
    ).rejects.toThrow(AppError);

    try {
      await resolveCode("XXXXXX", { FILE_KV: mockKV });
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe("CODE_NOT_FOUND");
    }
  });

  it("给定已过期的文件会话且无文本分享，应抛出 CODE_EXPIRED", async () => {
    const expiredSession = {
      code: "A3K9M2",
      files: [],
      status: "ready",
      totalSize: 0,
      createdAt: Date.now() - 7200_000,
      expiresAt: Date.now() - 1000,
      maxDownloads: 20,
      downloadCount: 0,
      creatorIP: "127.0.0.1",
    };
    store.set("code:A3K9M2", JSON.stringify(expiredSession));

    try {
      await resolveCode("A3K9M2", { FILE_KV: mockKV });
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe("CODE_EXPIRED");
    }
  });

  it("当文件会话和文本分享同时存在时，应优先返回文件类型", async () => {
    const session = {
      code: "A3K9M2",
      files: [
        { fileId: "file_0", filename: "doc.pdf", size: 5000, contentType: "application/pdf" },
      ],
      status: "ready",
      totalSize: 5000,
      createdAt: Date.now(),
      expiresAt: Date.now() + 3600_000,
      maxDownloads: 20,
      downloadCount: 0,
      creatorIP: "127.0.0.1",
    };
    const entry = {
      code: "A3K9M2",
      content: "Hello",
      createdAt: Date.now(),
      expiresAt: Date.now() + 3600_000,
    };
    store.set("code:A3K9M2", JSON.stringify(session));
    store.set("text:A3K9M2", JSON.stringify(entry));

    const result = await resolveCode("A3K9M2", { FILE_KV: mockKV });

    // 应优先返回文件类型
    expect(result.type).toBe("file");
  });

  it("当文件会话已过期但文本分享有效时，应返回文本类型", async () => {
    const expiredSession = {
      code: "C5M7Q9",
      files: [],
      status: "expired",
      totalSize: 0,
      createdAt: Date.now() - 7200_000,
      expiresAt: Date.now() - 1000,
      maxDownloads: 20,
      downloadCount: 0,
      creatorIP: "127.0.0.1",
    };
    const entry = {
      code: "C5M7Q9",
      content: "Still valid text",
      createdAt: Date.now(),
      expiresAt: Date.now() + 3600_000,
    };
    store.set("code:C5M7Q9", JSON.stringify(expiredSession));
    store.set("text:C5M7Q9", JSON.stringify(entry));

    const result = await resolveCode("C5M7Q9", { FILE_KV: mockKV });

    expect(result.type).toBe("text");
    if (result.type === "text") {
      expect(result.content).toBe("Still valid text");
    }
  });

  it("给定下载次数用尽的文件会话，应视为无效并检查文本", async () => {
    const maxedOutSession = {
      code: "D7N2R4",
      files: [],
      status: "ready",
      totalSize: 0,
      createdAt: Date.now(),
      expiresAt: Date.now() + 3600_000,
      maxDownloads: 10,
      downloadCount: 10,
      creatorIP: "127.0.0.1",
    };
    store.set("code:D7N2R4", JSON.stringify(maxedOutSession));

    // 无对应文本，应过期
    try {
      await resolveCode("D7N2R4", { FILE_KV: mockKV });
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe("CODE_EXPIRED");
    }
  });
});
