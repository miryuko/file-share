import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        kvNamespaces: ["FILE_KV"],
        r2Buckets: ["FILE_BUCKET"],
      },
    }),
  ],
  test: {
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 30_000,
  },
});
