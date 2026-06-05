import { describe, it, expect } from "vitest";
import { validateFiles } from "../../../src/utils/validation";
import { AppError } from "../../../src/utils/error";
import type { AdminConfig } from "../../../src/models/session";

const TEST_CONFIG: AdminConfig = {
  maxFileSize: 100 * 1024 * 1024, // 100MB
  maxTotalSize: 500 * 1024 * 1024, // 500MB
  maxFiles: 20,
  ttlSeconds: 3600,
  maxDownloads: 20,
  rateLimitPerMinute: 10,
};

describe("validateFiles", () => {
  it("给定合法文件列表，应不抛出错误", () => {
    expect(() =>
      validateFiles(
        {
          files: [{ filename: "test.txt", size: 1024 }],
        },
        TEST_CONFIG,
      ),
    ).not.toThrow();
  });

  it("给定空文件列表，应抛出 NO_FILES 错误", () => {
    try {
      validateFiles({ files: [] }, TEST_CONFIG);
      expect.fail("应抛出错误");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe("NO_FILES");
      expect((err as AppError).status).toBe(400);
    }
  });

  it("给定超过 maxFiles 的文件数，应抛出 TOO_MANY_FILES 错误", () => {
    const files = Array.from({ length: 21 }, (_, i) => ({
      filename: `file${i}.txt`,
      size: 1024,
    }));
    try {
      validateFiles({ files }, TEST_CONFIG);
      expect.fail("应抛出错误");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe("TOO_MANY_FILES");
    }
  });

  it("给定超大总大小的文件列表，应抛出 TOTAL_SIZE_EXCEEDED 错误", () => {
    try {
      validateFiles(
        {
          files: [
            { filename: "big1.bin", size: 300 * 1024 * 1024 },
            { filename: "big2.bin", size: 300 * 1024 * 1024 },
          ],
        },
        TEST_CONFIG,
      );
      expect.fail("应抛出错误");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe("TOTAL_SIZE_EXCEEDED");
    }
  });

  it("给定单文件超大，应抛出 FILE_TOO_LARGE 错误", () => {
    try {
      validateFiles(
        {
          files: [{ filename: "huge.bin", size: 200 * 1024 * 1024 }],
        },
        TEST_CONFIG,
      );
      expect.fail("应抛出错误");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe("FILE_TOO_LARGE");
    }
  });

  it("给定空文件名，应抛出 INVALID_FILENAME 错误", () => {
    try {
      validateFiles({ files: [{ filename: "", size: 1024 }] }, TEST_CONFIG);
      expect.fail("应抛出错误");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe("INVALID_FILENAME");
    }
  });

  it("给定文件名超长（>255），应抛出 FILENAME_TOO_LONG 错误", () => {
    try {
      validateFiles(
        {
          files: [
            {
              filename: "a".repeat(256),
              size: 1024,
            },
          ],
        },
        TEST_CONFIG,
      );
      expect.fail("应抛出错误");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe("FILENAME_TOO_LONG");
    }
  });

  it("给定文件大小为 0，应抛出 INVALID_FILE_SIZE 错误", () => {
    try {
      validateFiles(
        { files: [{ filename: "empty.bin", size: 0 }] },
        TEST_CONFIG,
      );
      expect.fail("应抛出错误");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe("INVALID_FILE_SIZE");
    }
  });
});
