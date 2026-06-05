import { describe, expect, it } from "vitest";
import app from "../../src/index";

describe("GET /message", () => {
  it("returns Hello Hono!", async () => {
    const res = await app.request("/message");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("Hello Hono!");
  });
});
