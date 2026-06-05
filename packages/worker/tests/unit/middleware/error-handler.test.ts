import { describe, it, expect, vi } from "vitest";
import { errorHandler } from "../../../src/middleware/error-handler";
import { AppError } from "../../../src/utils/error";

function createMockContext() {
  return {
    req: { url: "https://localhost/test", method: "GET" },
    json: vi.fn((body: unknown, status: number) => ({
      body,
      status,
    })),
  };
}

describe("errorHandler", () => {
  it("给定 AppError，应返回对应的 code 和 status", () => {
    const err = new AppError("TEST_ERROR", 418, "测试错误信息");
    const c = createMockContext();

    errorHandler(err, c as never);

    expect(c.json).toHaveBeenCalledWith(
      { code: "TEST_ERROR", message: "测试错误信息" },
      418,
    );
  });

  it("给定普通 Error，应返回 500 INTERNAL 且不暴露内部错误信息", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error("secret database password: xyz123");
    const c = createMockContext();

    errorHandler(err, c as never);

    expect(c.json).toHaveBeenCalledWith(
      { code: "INTERNAL", message: "服务异常，请稍后重试" },
      500,
    );

    // 内部错误应记录日志
    expect(consoleSpy).toHaveBeenCalled();
    const logArg = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(logArg.event).toBe("unhandled");
    expect(logArg.error).toBe("secret database password: xyz123");

    consoleSpy.mockRestore();
  });

  it("给定 404 AppError，应返回 404", () => {
    const err = new AppError("SESSION_NOT_FOUND", 404, "分享码无效");
    const c = createMockContext();

    errorHandler(err, c as never);

    expect(c.json).toHaveBeenCalledWith(
      { code: "SESSION_NOT_FOUND", message: "分享码无效" },
      404,
    );
  });

  it("给定 429 AppError，应返回 429", () => {
    const err = new AppError("RATE_LIMIT", 429, "操作过于频繁");
    const c = createMockContext();

    errorHandler(err, c as never);

    expect(c.json).toHaveBeenCalledWith(
      { code: "RATE_LIMIT", message: "操作过于频繁" },
      429,
    );
  });
});
