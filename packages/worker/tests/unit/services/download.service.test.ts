import { describe, it, expect, vi, beforeEach } from "vitest";
import { downloadFile } from "../../../src/services/download.service";
import { AppError } from "../../../src/utils/error";

function createMockKV(store: Map<string, string>): KVNamespace {
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    delete: vi.fn(),
    list: vi.fn(async () => ({ keys: [], list_complete: true, cursor: "" })),
  } as unknown as KVNamespace;
}

function createMockR2(): R2Bucket {
  return {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    createMultipartUpload: vi.fn(),
    resumeMultipartUpload: vi.fn(),
  } as unknown as R2Bucket;
}

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    code: "A3K9M2",
    files: [{ fileId: "file_0", filename: "test.txt", size: 1024, contentType: "text/plain" }],
    status: "ready",
    totalSize: 1024,
    createdAt: Date.now(),
    expiresAt: Date.now() + 3600000,
    maxDownloads: 20,
    downloadCount: 0,
    creatorIP: "127.0.0.1",
    ...overrides,
  };
}

describe("downloadFile", () => {
  let store: Map<string, string>;
  let mockKV: KVNamespace;
  let mockR2: R2Bucket;

  beforeEach(() => {
    store = new Map();
    mockKV = createMockKV(store);
    mockR2 = createMockR2();
  });

  it("给定有效的 session 和文件，应返回文件流", async () => {
    const session = makeSession();
    store.set("code:A3K9M2", JSON.stringify(session));

    (mockR2.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      body: new ReadableStream(),
      size: 1024,
    });

    const result = await downloadFile("A3K9M2", "file_0", {
      FILE_KV: mockKV,
      FILE_BUCKET: mockR2,
    });

    expect(result.filename).toBe("test.txt");
    expect(result.contentType).toBe("text/plain");
    expect(result.size).toBe(1024);
    expect(result.body).toBeDefined();
    expect(mockKV.put).toHaveBeenCalled(); // 计数更新
  });

  it("给定不存在的 session，应抛出 SESSION_NOT_FOUND", async () => {
    await expect(
      downloadFile("XXXXXX", "file_0", {
        FILE_KV: mockKV,
        FILE_BUCKET: mockR2,
      }),
    ).rejects.toThrow(AppError);
  });

  it("给定不存在的 fileId，应抛出 FILE_NOT_FOUND", async () => {
    const session = makeSession();
    store.set("code:A3K9M2", JSON.stringify(session));

    await expect(
      downloadFile("A3K9M2", "file_99", {
        FILE_KV: mockKV,
        FILE_BUCKET: mockR2,
      }),
    ).rejects.toThrow(AppError);
  });

  it("给定已过期的 session，应抛出 SESSION_EXPIRED", async () => {
    const session = makeSession({
      expiresAt: Date.now() - 1000,
      status: "expired",
    });
    store.set("code:A3K9M2", JSON.stringify(session));

    await expect(
      downloadFile("A3K9M2", "file_0", {
        FILE_KV: mockKV,
        FILE_BUCKET: mockR2,
      }),
    ).rejects.toThrow(AppError);
  });

  it("给定下载次数用尽的 session，应抛出 DOWNLOAD_LIMIT_REACHED", async () => {
    const session = makeSession({ downloadCount: 20, maxDownloads: 20 });
    store.set("code:A3K9M2", JSON.stringify(session));

    await expect(
      downloadFile("A3K9M2", "file_0", {
        FILE_KV: mockKV,
        FILE_BUCKET: mockR2,
      }),
    ).rejects.toThrow(AppError);
  });

  it("R2 返回 null 时应抛出 FILE_NOT_FOUND", async () => {
    const session = makeSession();
    store.set("code:A3K9M2", JSON.stringify(session));
    (mockR2.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(
      downloadFile("A3K9M2", "file_0", {
        FILE_KV: mockKV,
        FILE_BUCKET: mockR2,
      }),
    ).rejects.toThrow(AppError);
  });

  it("下载后应递增 downloadCount", async () => {
    const session = makeSession({ downloadCount: 5 });
    store.set("code:A3K9M2", JSON.stringify(session));

    (mockR2.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      body: new ReadableStream(),
      size: 1024,
    });

    await downloadFile("A3K9M2", "file_0", {
      FILE_KV: mockKV,
      FILE_BUCKET: mockR2,
    });

    // KV 应被更新（downloadCount 递增）
    const putCalls = (mockKV.put as ReturnType<typeof vi.fn>).mock.calls;
    expect(putCalls.length).toBeGreaterThan(0);

    // 最后一次 put 是更新 session
    const updatedRaw = putCalls[putCalls.length - 1][1] as string;
    const updated = JSON.parse(updatedRaw);
    expect(updated.downloadCount).toBe(6);
    expect(updated.status).toBe("downloading");
  });

  it("下载次数达到上限后应标记为 expired", async () => {
    const session = makeSession({ downloadCount: 19, maxDownloads: 20 });
    store.set("code:A3K9M2", JSON.stringify(session));

    (mockR2.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      body: new ReadableStream(),
      size: 1024,
    });

    await downloadFile("A3K9M2", "file_0", {
      FILE_KV: mockKV,
      FILE_BUCKET: mockR2,
    });

    const putCalls = (mockKV.put as ReturnType<typeof vi.fn>).mock.calls;
    const updatedRaw = putCalls[putCalls.length - 1][1] as string;
    const updated = JSON.parse(updatedRaw);
    expect(updated.status).toBe("expired");
  });
});
