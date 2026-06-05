import { describe, expect, it } from "vitest";

// Unit test: Verify the app module can be imported correctly
describe("worker entry", () => {
  it("exports fetch and scheduled handlers", async () => {
    const app = await import("../../src/index");
    expect(app.default).toBeDefined();
    expect(typeof app.default.fetch).toBe("function");
    expect(typeof app.default.scheduled).toBe("function");
  });
});
