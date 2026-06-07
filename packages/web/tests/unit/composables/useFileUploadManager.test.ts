import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock useSiteConfig to return custom config
const mockConfig = {
  maxFileSize: 100 * 1024 * 1024,
  maxTotalSize: 500 * 1024 * 1024,
  maxFiles: 20,
};

vi.mock("../../../src/composables/useSiteConfig", () => ({
  useSiteConfig: () => ({
    config: { value: mockConfig },
    loaded: { value: true },
    load: vi.fn<() => Promise<void>>(),
  }),
}));

// Mock api module
vi.mock("../../../src/lib/api", () => ({
  createSession: vi.fn<() => Promise<unknown>>(),
  uploadPart: vi.fn<() => Promise<unknown>>(),
  completeUpload: vi.fn<() => Promise<unknown>>(),
  uploadFileDirect: vi.fn<() => Promise<unknown>>(),
  ApiError: class ApiError extends Error {
    code: string;
    status: number;
    constructor(code: string, status: number, message: string) {
      super(message);
      this.code = code;
      this.status = status;
      this.name = "ApiError";
    }
  },
}));

// Need to mock crypto.subtle.digest for SHA-256
// Return a different hash per file to avoid false duplicate detection
let hashCounter = 0;
const mockDigest = vi.fn<() => Promise<ArrayBuffer>>();
vi.stubGlobal("crypto", {
  subtle: { digest: mockDigest },
});

describe("useFileUploadManager", () => {
  let useFileUploadManager: typeof import("../../../src/composables/useFileUploadManager").useFileUploadManager;

  function setupUniqueHashes(): void {
    mockDigest.mockImplementation(() => {
      const buf = new ArrayBuffer(32);
      const view = new Uint8Array(buf);
      view[0] = ++hashCounter;
      return Promise.resolve(buf);
    });
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    mockConfig.maxFileSize = 100 * 1024 * 1024;
    mockConfig.maxTotalSize = 500 * 1024 * 1024;
    mockConfig.maxFiles = 20;
    setupUniqueHashes();
    // Re-import to get fresh module state
    const mod = await import("../../../src/composables/useFileUploadManager");
    useFileUploadManager = mod.useFileUploadManager;
  });

  function makeFile(name: string, size: number): File {
    return new File([new ArrayBuffer(size)], name, { type: "application/octet-stream" });
  }

  // ── addFiles：文件数量限制 ──

  describe("addFiles - 文件数量限制", () => {
    it("给定未达上限，添加文件时应成功添加", async () => {
      const { addFiles, selectedFiles } = useFileUploadManager();
      const file = makeFile("test.bin", 1024);
      const result = await addFiles([file]);

      expect(result.added).toBe(1);
      expect(result.rejected).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(selectedFiles.value).toHaveLength(1);
    });

    it("给定已达上限，添加文件时应拒绝", async () => {
      mockConfig.maxFiles = 3;
      const { addFiles, selectedFiles } = useFileUploadManager();

      // Add 3 files to reach limit
      await addFiles([makeFile("a.bin", 100), makeFile("b.bin", 100), makeFile("c.bin", 100)]);
      expect(selectedFiles.value).toHaveLength(3);

      // 第 4 个应被拒绝
      const result = await addFiles([makeFile("d.bin", 100)]);
      expect(result.added).toBe(0);
      expect(result.rejected).toBe(1);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(selectedFiles.value).toHaveLength(3);
    });

    it("给定批量添加超过上限，应在达到上限后停止添加", async () => {
      mockConfig.maxFiles = 2;
      const { addFiles, selectedFiles } = useFileUploadManager();

      const result = await addFiles([
        makeFile("a.bin", 100),
        makeFile("b.bin", 100),
        makeFile("c.bin", 100),
      ]);

      expect(result.added).toBe(2);
      expect(result.rejected).toBe(1);
      expect(selectedFiles.value).toHaveLength(2);
    });
  });

  // ── addFiles：单文件大小限制 ──

  describe("addFiles - 单文件大小限制", () => {
    it("给定文件超过 maxFileSize，应拒绝并提示", async () => {
      mockConfig.maxFileSize = 1024; // 1KB
      const { addFiles, selectedFiles } = useFileUploadManager();

      const result = await addFiles([makeFile("big.bin", 2048)]);

      expect(result.added).toBe(0);
      expect(result.rejected).toBe(1);
      expect(result.errors[0]).toContain("big.bin");
      expect(selectedFiles.value).toHaveLength(0);
    });

    it("给定文件在限制内，应正常添加", async () => {
      mockConfig.maxFileSize = 1024 * 1024;
      const { addFiles, selectedFiles } = useFileUploadManager();

      const result = await addFiles([makeFile("small.bin", 512 * 1024)]);

      expect(result.added).toBe(1);
      expect(selectedFiles.value).toHaveLength(1);
    });
  });

  // ── addFiles：总大小限制 ──

  describe("addFiles - 总大小限制", () => {
    it("给定累计大小超过 maxTotalSize，应拒绝", async () => {
      mockConfig.maxTotalSize = 1024; // 1KB
      const { addFiles, selectedFiles } = useFileUploadManager();

      await addFiles([makeFile("a.bin", 800)]);
      const result = await addFiles([makeFile("b.bin", 500)]);

      expect(result.rejected).toBe(1);
      expect(selectedFiles.value).toHaveLength(1);
    });
  });

  // ── addFiles：无限制配置（-1）─

  describe("addFiles - 无限制配置", () => {
    it("给定 maxFiles 为 -1，应允许添加任意数量文件", async () => {
      mockConfig.maxFiles = -1;
      const { addFiles, selectedFiles } = useFileUploadManager();

      const files = Array.from({ length: 30 }, (_, i) => makeFile(`file${i}.bin`, 100));
      const result = await addFiles(files);

      expect(result.added).toBe(30);
      expect(result.rejected).toBe(0);
      expect(selectedFiles.value).toHaveLength(30);
    });

    it("给定 maxFileSize 为 -1，应允许超过常规限制的文件", async () => {
      mockConfig.maxFileSize = -1;
      const { addFiles, selectedFiles } = useFileUploadManager();

      // 2MB file would be rejected under default 100MB limit check, but with -1 it passes
      const result = await addFiles([makeFile("large.bin", 2 * 1024 * 1024)]);

      expect(result.added).toBe(1);
      expect(selectedFiles.value).toHaveLength(1);
    });

    it("给定 maxTotalSize 为 -1，应允许累计超过常规限制", async () => {
      mockConfig.maxTotalSize = -1;
      const { addFiles, selectedFiles } = useFileUploadManager();

      await addFiles([makeFile("a.bin", 1024)]);
      const result = await addFiles([makeFile("b.bin", 2048)]);

      expect(result.added).toBe(1);
      expect(selectedFiles.value).toHaveLength(2);
    });
  });

  // ── addFiles：空文件 ──

  describe("addFiles - 空文件处理", () => {
    it("给定大小为 0 的文件，应跳过", async () => {
      const { addFiles, selectedFiles } = useFileUploadManager();

      const result = await addFiles([makeFile("empty.bin", 0)]);

      expect(result.rejected).toBe(1);
      expect(selectedFiles.value).toHaveLength(0);
    });
  });

  // ── addFiles：重复检测 ──

  describe("addFiles - 重复文件检测", () => {
    it("给定内容相同的文件，应跳过重复", async () => {
      // Make mockDigest return the same hash for consecutive calls to simulate duplicates
      let callCount = 0;
      mockDigest.mockImplementation(() => {
        const buf = new ArrayBuffer(32);
        // First file gets hash starting with 0xAA, second file also gets 0xAA (duplicate)
        if (callCount === 0) callCount++;
        const view = new Uint8Array(buf);
        view[0] = 0xAA;
        return Promise.resolve(buf);
      });

      const { addFiles, selectedFiles } = useFileUploadManager();

      const file1 = makeFile("a.bin", 100);
      const file2 = makeFile("b.bin", 100); // Same content → same hash now

      await addFiles([file1]);
      const result = await addFiles([file2]);

      expect(result.rejected).toBe(1);
      expect(result.errors[0]).toContain("已存在");
      expect(selectedFiles.value).toHaveLength(1);
    });
  });

  // ── canAddMoreFiles ──

  describe("canAddMoreFiles", () => {
    it("给定未达上限，应返回 true", async () => {
      const { canAddMoreFiles, addFiles } = useFileUploadManager();
      await addFiles([makeFile("a.bin", 100)]);
      expect(canAddMoreFiles.value).toBe(true);
    });

    it("给定 maxFiles 为 -1，应始终返回 true", () => {
      mockConfig.maxFiles = -1;
      const { canAddMoreFiles } = useFileUploadManager();
      expect(canAddMoreFiles.value).toBe(true);
    });
  });
});
