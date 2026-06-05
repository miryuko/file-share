import { describe, it, expect, vi, beforeEach } from "vitest";
import { rateLimiter } from "../../../src/middleware/rate-limiter";

function createMockKV(store: Map<string, string>): KVNamespace {
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string, opts?: { expirationTtl?: number }) => {
      store.set(key, value);
    }),
    delete: vi.fn(),
    list: vi.fn(async () => ({ keys: [], list_complete: true, cursor: "" })),
  } as unknown as KVNamespace;
}

function createMockContext(ip: string): {
  req: { header: (name: string) => string | undefined };
  json: ReturnType<typeof vi.fn>;
  status: number;
} {
  return {
    req: {
      header: vi.fn((name: string) => (name === "CF-Connecting-IP" ? ip : undefined)),
    },
    json: vi.fn(),
    status: 200,
  };
}

describe("rateLimiter", () => {
  let store: Map<string, string>;
  let mockKV: KVNamespace;

  beforeEach(() => {
    store = new Map();
    mockKV = createMockKV(store);
  });

  it("给定未超过限制的请求，应正常调用 next", async () => {
    const middleware = rateLimiter(mockKV, 10);
    const c = createMockContext("1.2.3.4");
    const next = vi.fn();

    await middleware(c as never, next as never);

    expect(next).toHaveBeenCalled();
    expect(mockKV.put).toHaveBeenCalled();
  });

  it("给定超过限制的请求，应抛出 RATE_LIMIT 错误", async () => {
    // 预置计数器已达上限
    const windowTs = Math.floor(Date.now() / 60000);
    store.set(`rate:1.2.3.4:${windowTs}`, "10");

    const middleware = rateLimiter(mockKV, 10);
    const c = createMockContext("1.2.3.4");
    const next = vi.fn();

    await expect(
      middleware(c as never, next as never),
    ).rejects.toThrow("操作过于频繁");
  });

  it("给定 KV 不可用时，应放行请求（不阻塞正常流量）", async () => {
    const brokenKV = {
      ...mockKV,
      get: vi.fn(async () => {
        throw new Error("KV unavailable");
      }),
    } as unknown as KVNamespace;

    const middleware = rateLimiter(brokenKV, 10);
    const c = createMockContext("1.2.3.4");
    const next = vi.fn();

    // 不应抛出错误
    await middleware(c as never, next as never);
    expect(next).toHaveBeenCalled();
  });

  it("给定无 IP header 的请求，应使用 unknown 作为 IP", async () => {
    const middleware = rateLimiter(mockKV, 10);
    const c = {
      req: { header: vi.fn(() => undefined) },
    };
    const next = vi.fn();

    await middleware(c as never, next as never);
    expect(next).toHaveBeenCalled();
    // 应使用 "unknown" 作为 IP
    expect(mockKV.put).toHaveBeenCalled();
  });
});
