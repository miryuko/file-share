import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn<typeof fetch>();
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
    } as unknown as Response);

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
    } as unknown as Response);

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
    } as unknown as Response);

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
    } as unknown as Response);

    await expect(api.getSession("XXXXXX")).rejects.toThrow("分享码无效");
  });
});

describe("getCodeInfo", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("给定文件分享码，应返回 type:file 的数据", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        type: "file",
        code: "A3K9M2",
        files: [{ fileId: "file_0", filename: "doc.pdf", size: 5000, contentType: "application/pdf" }],
        expiresAt: Date.now() + 3600000,
        remainingDownloads: 18,
      }),
    } as unknown as Response);

    const result = await api.getCodeInfo("A3K9M2");

    expect(result.type).toBe("file");
    expect((result as { code: string }).code).toBe("A3K9M2");
    expect((result as { files: unknown[] }).files).toHaveLength(1);
    expect((result as { remainingDownloads: number }).remainingDownloads).toBe(18);
    expect(mockFetch).toHaveBeenCalledWith("/api/code/A3K9M2", {});
  });

  it("给定文本分享码，应返回 type:text 的数据", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        type: "text",
        content: "Hello World",
        expiresAt: Date.now() + 3600000,
        createdAt: Date.now(),
      }),
    } as unknown as Response);

    const result = await api.getCodeInfo("B4N8P3");

    expect(result.type).toBe("text");
    expect((result as { content: string }).content).toBe("Hello World");
    expect(mockFetch).toHaveBeenCalledWith("/api/code/B4N8P3", {});
  });

  it("给定无效分享码，应抛出 ApiError", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({
        code: "CODE_NOT_FOUND",
        message: "分享码无效，请检查后重试",
      }),
    } as unknown as Response);

    await expect(api.getCodeInfo("XXXXXX")).rejects.toThrow("分享码无效");
  });
});

describe("getDownloadUrl", () => {
  it("应返回正确的下载 URL", () => {
    const url = api.getDownloadUrl("A3K9M2", "file_0");
    expect(url).toBe("/api/download/A3K9M2/file_0");
  });
});
