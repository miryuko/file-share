import { Hono } from "hono";

import { errorHandler } from "./middleware/error-handler";
import { logger } from "./middleware/logger";
import { rateLimiter } from "./middleware/rate-limiter";
import { runCleanup } from "./services/cleanup.service";

import sessionApi from "./api/session.api";
import uploadApi from "./api/upload.api";
import downloadApi from "./api/download.api";

const app = new Hono<{ Bindings: CloudflareBindings }>();

// ── 全局中间件 ──
app.use("*", logger());

// ── 速率限制（仅对创建 session 接口） ──
app.use("/api/session/create", async (c, next) => {
  const limiter = rateLimiter(c.env.FILE_KV, 10);
  await limiter(c, next);
});

// ── 路由 ──
app.route("/", sessionApi);
app.route("/", uploadApi);
app.route("/", downloadApi);

// ── 健康检查 ──
app.get("/api/health", (c) => {
  return c.json({ status: "ok", timestamp: Date.now() });
});

// ── 全局错误处理 ──
app.onError((err, c) => {
  return errorHandler(err, c);
});

// CF Workers 模块格式导出
export default {
  fetch: app.fetch,
  async scheduled(
    _event: ScheduledEvent,
    env: CloudflareBindings,
    _ctx: ExecutionContext,
  ): Promise<void> {
    await runCleanup({
      FILE_KV: env.FILE_KV,
      FILE_BUCKET: env.FILE_BUCKET,
    });
  },
};
