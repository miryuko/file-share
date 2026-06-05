import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSession, getSession } from "../../../src/services/session.service";
import { AppError } from "../../../src/utils/error";
import type { AdminConfig } from "../../../src/models/session";

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

function createMockR2(): R2Bucket {
  return {
    createMultipartUpload: vi.fn(async (key: string) => ({
      uploadId: `mock-upload-${key}`,
      key,
    })),
    resumeMultipartUpload: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  } as unknown as R2Bucket;
}

const TEST_CONFIG: AdminConfig = {
  maxFileSize: 100 * 1024 * 1024,
  maxTotalSize: 500 * 1024 * 1024,
  maxFiles: 20,
  ttlSeconds: 3600,
  maxDownloads: 20,
  rateLimitPerMinute: 10,
};

describe("createSession", () => {
  let mockKV: KVNamespace;
  let mockR2: R2Bucket;

  beforeEach(() => {
    mockKV = createMockKV();
    mockR2 = createMockR2();
  });

  it("给定合法文件列表，应返回 6 位分享码和文件信息", async () => {
    const result = await createSession(
      {
        files: [{ filename: "test.txt", size: 1024 }],
      },
      { FILE_KV: mockKV, FILE_BUCKET: mockR2 },
      "127.0.0.1",
      TEST_CONFIG,
    );

    expect(result.code).toMatch(/^[A-Z2-9]{6}$/);
    expect(result.files).toHaveLength(1);
    expect(result.files[0].fileId).toBe("file_0");
    expect(result.files[0].filename).toBe("test.txt");
    expect(result.expiresAt).toBeGreaterThan(Date.now());
    expect(mockKV.put).toHaveBeenCalled();
    expect(mockR2.createMultipartUpload).toHaveBeenCalled();
  });

  it("给定空文件列表，应抛出 NO_FILES 错误", async () => {
    await expect(
      createSession(
        { files: [] },
        { FILE_KV: mockKV, FILE_BUCKET: mockR2 },
        "127.0.0.1",
        TEST_CONFIG,
      ),
    ).rejects.toThrow(AppError);
  });

  it("给定碰撞的分享码，应重试并成功", async () => {
    // 第一次 get 返回已存在（模拟碰撞），第二次返回 null
    const getCalls: (string | null)[] = ["exists", null];
    const customKV = createMockKV();
    (customKV.get as ReturnType<typeof vi.fn>).mockImplementation(
      async () => getCalls.shift(),
    );

    const result = await createSession(
      { files: [{ filename: "test.txt", size: 1024 }] },
      { FILE_KV: customKV, FILE_BUCKET: mockR2 },
      "127.0.0.1",
      TEST_CONFIG,
    );

    expect(result.code).toBeDefined();
  });
});

describe("getSession", () => {
  let mockKV: KVNamespace;

  beforeEach(() => {
    mockKV = createMockKV();
  });

  it("给定不存在的分享码，应抛出 SESSION_NOT_FOUND", async () => {
    await expect(
      getSession("XXXXXX", { FILE_KV: mockKV }),
    ).rejects.toThrow(AppError);
  });

  it("给定已过期的 session，应抛出 SESSION_EXPIRED", async () => {
    const session = {
      code: "A3K9M2",
      files: [],
      status: "ready",
      totalSize: 0,
      createdAt: Date.now() - 7200_000,
      expiresAt: Date.now() - 1000, // 已过期
      maxDownloads: 20,
      downloadCount: 0,
      creatorIP: "127.0.0.1",
    };
    (mockKV.get as ReturnType<typeof vi.fn>).mockResolvedValue(
      JSON.stringify(session),
    );

    await expect(
      getSession("A3K9M2", { FILE_KV: mockKV }),
    ).rejects.toThrow(AppError);
  });

  it("给定下载次数用尽的 session，应抛出 DOWNLOAD_LIMIT_REACHED", async () => {
    const session = {
      code: "A3K9M2",
      files: [],
      status: "ready",
      totalSize: 0,
      createdAt: Date.now(),
      expiresAt: Date.now() + 3600_000,
      maxDownloads: 10,
      downloadCount: 10,
      creatorIP: "127.0.0.1",
    };
    (mockKV.get as ReturnType<typeof vi.fn>).mockResolvedValue(
      JSON.stringify(session),
    );

    await expect(
      getSession("A3K9M2", { FILE_KV: mockKV }),
    ).rejects.toThrow(AppError);
  });

  it("给定有效的 session，应返回完整会话信息", async () => {
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
    (mockKV.get as ReturnType<typeof vi.fn>).mockResolvedValue(
      JSON.stringify(session),
    );

    const result = await getSession("A3K9M2", { FILE_KV: mockKV });

    expect(result.code).toBe("A3K9M2");
    expect(result.files).toHaveLength(1);
    expect(result.downloadCount).toBe(3);
  });
});
