import { Hono } from "hono";
import type { CreateSessionRequest, CreateSessionResponse } from "../models/api";
import { createSession, getSession } from "../services/session.service";

const app = new Hono<{ Bindings: CloudflareBindings }>();

// POST /api/session/create — 创建传输会话
app.post("/api/session/create", async (c) => {
  const body = await c.req.json<CreateSessionRequest>();
  const clientIP = c.req.header("CF-Connecting-IP") || "unknown";

  const result: CreateSessionResponse = await createSession(
    body,
    {
      FILE_KV: c.env.FILE_KV,
      FILE_BUCKET: c.env.FILE_BUCKET,
    },
    clientIP,
  );

  console.log(JSON.stringify({
    event: "api.session.created",
    code: result.code,
    ip: clientIP,
  }));

  return c.json(result, 201);
});

// GET /api/session/:code — 查询会话信息
app.get("/api/session/:code", async (c) => {
  const code = c.req.param("code").toUpperCase();

  const session = await getSession(code, {
    FILE_KV: c.env.FILE_KV,
  });

  return c.json({
    code: session.code,
    files: session.files,
    expiresAt: session.expiresAt,
    remainingDownloads: session.maxDownloads - session.downloadCount,
    status: session.status,
  });
});

export default app;
