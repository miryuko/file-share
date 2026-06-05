import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "miniflare",
    environmentOptions: {
      bindings: {
        FILE_BUCKET: { type: "r2" },
        FILE_KV: { type: "kv" },
      },
    },
    // Integration tests take longer — 30s timeout
    testTimeout: 30_000,
  },
});
