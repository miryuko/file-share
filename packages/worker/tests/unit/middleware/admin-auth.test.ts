import { describe, it, expect, vi } from "vitest";
import { adminAuth } from "../../../src/middleware/admin-auth";
import { AppError } from "../../../src/utils/error";
import { signJwt } from "../../../src/utils/jwt";

const TEST_SECRET = "test-admin-secret";

function createMockContext(authHeader?: string) {
  return {
    req: {
      header: vi.fn((name: string) =>
        name === "Authorization" ? (authHeader ?? null) : null,
      ),
    },
  };
}

describe("adminAuth", () => {
  it("给定有效的 Bearer token，应调用 next", async () => {
    const token = await signJwt(
      { sub: "admin", iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 },
      TEST_SECRET,
    );
    const middleware = adminAuth(TEST_SECRET);
    const c = createMockContext(`Bearer ${token}`);
    const next = vi.fn();

    await middleware(c as never, next);

    expect(next).toHaveBeenCalled();
  });

  it("给定无 Authorization header，应抛出 UNAUTHORIZED", async () => {
    const middleware = adminAuth(TEST_SECRET);
    const c = createMockContext(undefined);
    const next = vi.fn();

    await expect(middleware(c as never, next)).rejects.toThrow(AppError);
    await expect(middleware(c as never, next)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      status: 401,
    });
  });

  it("给定非 Bearer token，应抛出 UNAUTHORIZED", async () => {
    const middleware = adminAuth(TEST_SECRET);
    const c = createMockContext("Basic YWRtaW46YWRtaW4=");
    const next = vi.fn();

    await expect(middleware(c as never, next)).rejects.toThrow(AppError);
  });

  it("给定过期的 token，应抛出 TOKEN_EXPIRED", async () => {
    const token = await signJwt(
      { sub: "admin", iat: 1, exp: 1 }, // already expired (1970)
      TEST_SECRET,
    );
    const middleware = adminAuth(TEST_SECRET);
    const c = createMockContext(`Bearer ${token}`);
    const next = vi.fn();

    await expect(middleware(c as never, next)).rejects.toThrow(AppError);
    await expect(middleware(c as never, next)).rejects.toMatchObject({
      code: "TOKEN_EXPIRED",
      status: 401,
    });
  });

  it("给定伪造的 token，应抛出 TOKEN_EXPIRED", async () => {
    const middleware = adminAuth(TEST_SECRET);
    const c = createMockContext("Bearer fake.token.here");
    const next = vi.fn();

    await expect(middleware(c as never, next)).rejects.toThrow(AppError);
  });
});
