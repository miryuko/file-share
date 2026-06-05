import { Hono } from "hono";
import { createTextShare, getTextShare } from "../services/text.service";

const app = new Hono<{ Bindings: CloudflareBindings }>();

// POST /api/text/create — 创建文本分享
app.post("/api/text/create", async (c) => {
  const { content } = await c.req.json<{ content: string }>();

  const result = await createTextShare(content, { FILE_KV: c.env.FILE_KV });

  return c.json(result, 201);
});

// GET /api/text/:code — 获取文本分享
app.get("/api/text/:code", async (c) => {
  const code = c.req.param("code").toUpperCase();

  const entry = await getTextShare(code, { FILE_KV: c.env.FILE_KV });

  return c.json({
    content: entry.content,
    expiresAt: entry.expiresAt,
    createdAt: entry.createdAt,
  });
});

export default app;
