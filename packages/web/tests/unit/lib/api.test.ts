import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Re-import after mock is set
const api = await import("../../../src/lib/api");

describe("createSession", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("给定合法文件列表，应返回会话信息", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        code: "A3K9M2",
        files: [{ fileId: "file_0", filename: "test.txt", uploadUrl: "/api/upload/A3K9M2/file_0/part" }],
        expiresAt: Date.now() + 3600000,
      }),
    });

    const result = await api.createSession([
      { filename: "test.txt", size: 1024 },
    ]);

    expect(result.code).toBe("A3K9M2");
    expect(result.files).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledWith("/api/session/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [{ filename: "test.txt", size: 1024 }],
      }),
    });
  });

  it("当服务器返回错误时，应抛出 ApiError", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 413,
      json: async () => ({
        code: "FILE_TOO_LARGE",
        message: "文件过大",
      }),
    });

    await expect(
      api.createSession([{ filename: "huge.bin", size: 999999999 }]),
    ).rejects.toThrow("文件过大");
  });
});

describe("getSession", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("给定有效分享码，应返回会话信息", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        code: "A3K9M2",
        files: [{ fileId: "file_0", filename: "doc.pdf", size: 5000, contentType: "application/pdf" }],
        expiresAt: Date.now() + 3600000,
        remainingDownloads: 18,
        status: "ready",
      }),
    });

    const result = await api.getSession("A3K9M2");

    expect(result.code).toBe("A3K9M2");
    expect(result.remainingDownloads).toBe(18);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/session/A3K9M2",
      {},
    );
  });

  it("给定不存在的分享码，应抛出 ApiError", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({
        code: "SESSION_NOT_FOUND",
        message: "分享码无效",
      }),
    });

    await expect(api.getSession("XXXXXX")).rejects.toThrow("分享码无效");
  });
});

describe("getDownloadUrl", () => {
  it("应返回正确的下载 URL", () => {
    const url = api.getDownloadUrl("A3K9M2", "file_0");
    expect(url).toBe("/api/download/A3K9M2/file_0");
  });
});
