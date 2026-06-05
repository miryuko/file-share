import { describe, it, expect } from "vitest";
import { signJwt, verifyJwt } from "../../../src/utils/jwt";

const TEST_SECRET = "test-secret-key-12345";

describe("signJwt", () => {
  it("应返回三段式的 JWT token", async () => {
    const token = await signJwt(
      { sub: "admin", iat: 1234567890, exp: 1234567890 + 86400 },
      TEST_SECRET,
    );

    const parts = token.split(".");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBeTruthy();
    expect(parts[1]).toBeTruthy();
    expect(parts[2]).toBeTruthy();
  });

  it("每次签发的 token 应不同（iat 不同导致签名不同）", async () => {
    // 使用明确不同的 iat 确保签名不同
    const token1 = await signJwt(
      { sub: "admin", iat: 1000, exp: 10000 },
      TEST_SECRET,
    );
    const token2 = await signJwt(
      { sub: "admin", iat: 2000, exp: 20000 },
      TEST_SECRET,
    );

    expect(token1).not.toBe(token2);
  });
});

describe("verifyJwt", () => {
  it("给定有效 token，应返回 payload", async () => {
    const payload = { sub: "admin", iat: 1111111111, exp: 9999999999 };
    const token = await signJwt(payload, TEST_SECRET);

    const result = await verifyJwt(token, TEST_SECRET);
    expect(result).toEqual(payload);
  });

  it("给定错误 secret 签名的 token，应返回 null", async () => {
    const token = await signJwt(
      { sub: "admin", iat: 111, exp: 999 },
      TEST_SECRET,
    );

    const result = await verifyJwt(token, "wrong-secret");
    expect(result).toBeNull();
  });

  it("给定已过期的 token，应返回 null", async () => {
    const token = await signJwt(
      { sub: "admin", iat: 1, exp: 100 }, // 1970
      TEST_SECRET,
    );

    const result = await verifyJwt(token, TEST_SECRET);
    expect(result).toBeNull();
  });

  it("给定格式错误的字符串，应返回 null", async () => {
    expect(await verifyJwt("not-a-jwt", TEST_SECRET)).toBeNull();
    expect(await verifyJwt("a.b", TEST_SECRET)).toBeNull();
    expect(await verifyJwt("", TEST_SECRET)).toBeNull();
  });
});
