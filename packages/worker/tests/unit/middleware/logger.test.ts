import { describe, it, expect, vi } from "vitest";
import { logger } from "../../../src/middleware/logger";

describe("logger", () => {
  it("应调用 next 并记录请求日志", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const middleware = logger();
    const c = {
      req: { method: "POST", path: "/api/session/create" },
      res: { status: 201 },
    };
    const next = vi.fn();

    await middleware(c as never, next);

    expect(next).toHaveBeenCalled();

    // 验证日志被记录
    expect(logSpy).toHaveBeenCalled();
    const logArg = JSON.parse(logSpy.mock.calls[0][0]);
    expect(logArg.event).toBe("request");
    expect(logArg.method).toBe("POST");
    expect(logArg.path).toBe("/api/session/create");
    expect(logArg.status).toBe(201);
    expect(logArg.durationMs).toBeGreaterThanOrEqual(0);

    logSpy.mockRestore();
  });

  it("即使 next 抛出错误也应记录日志", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const middleware = logger();
    const c = {
      req: { method: "GET", path: "/api/session/A3K9M2" },
      res: { status: 404 },
    };
    const next = vi.fn(async () => {
      c.res.status = 404;
    });

    await middleware(c as never, next);

    const logArg = JSON.parse(logSpy.mock.calls[0][0]);
    expect(logArg.method).toBe("GET");
    expect(logArg.status).toBe(404);

    logSpy.mockRestore();
  });
});
