import { Hono } from "hono";

import { errorHandler } from "./middleware/error-handler";
import { logger } from "./middleware/logger";
import { rateLimiter } from "./middleware/rate-limiter";
import { runCleanup } from "./services/cleanup.service";

import sessionApi from "./api/session.api";
import uploadApi from "./api/upload.api";
import downloadApi from "./api/download.api";
import adminApi from "./api/admin.api";
import textApi from "./api/text.api";
import { SignalingDO } from "./do/signaling.do";

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
app.route("/", adminApi);
app.route("/", textApi);

// ── WebSocket 信令 ──
app.get("/ws/signaling/:code", (c) => {
  const code = c.req.param("code").toUpperCase();
  const role = c.req.query("role") || "sender";

  // 获取或创建 DO
  const doId = c.env.SIGNALING.idFromName(code);
  const stub = c.env.SIGNALING.get(doId);

  // 转发请求到 DO
  return stub.fetch(
    new Request(`https://do/ws?role=${role}`, {
      headers: { Upgrade: "websocket" },
    }),
  );
});

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

// Durable Object 导出
export { SignalingDO };
