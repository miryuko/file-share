import { Hono } from "hono";
import { uploadPart, completeUpload, uploadFileDirect, markSessionReady } from "../services/upload.service";

const app = new Hono<{ Bindings: CloudflareBindings }>();

// POST /api/upload/:code/:fileId/part — 上传文件分片
app.post("/api/upload/:code/:fileId/part", async (c) => {
  const code = c.req.param("code").toUpperCase();
  const fileId = c.req.param("fileId");
  const partNumber = parseInt(c.req.query("partNumber") || "1", 10);

  // 读取请求体（分片二进制数据）
  const data = await c.req.arrayBuffer();

  const result = await uploadPart(
    code,
    fileId,
    partNumber,
    data,
    {
      FILE_KV: c.env.FILE_KV,
      FILE_BUCKET: c.env.FILE_BUCKET,
    },
  );

  return c.json(result);
});

// POST /api/upload/:code/:fileId/complete — 完成分片上传
app.post("/api/upload/:code/:fileId/complete", async (c) => {
  const code = c.req.param("code").toUpperCase();
  const fileId = c.req.param("fileId");
  const body = await c.req.json<{ parts: { partNumber: number; etag: string }[] }>();

  if (!body.parts || body.parts.length === 0) {
    return c.json({ code: "NO_PARTS", message: "缺少分片信息" }, 400);
  }

  const result = await completeUpload(
    code,
    fileId,
    body.parts,
    {
      FILE_KV: c.env.FILE_KV,
      FILE_BUCKET: c.env.FILE_BUCKET,
    },
  );

  // 标记会话为 ready
  await markSessionReady(code, { FILE_KV: c.env.FILE_KV });

  return c.json(result);
});

// POST /api/upload/:code/:fileId/direct — 小文件直传
app.post("/api/upload/:code/:fileId/direct", async (c) => {
  const code = c.req.param("code").toUpperCase();
  const fileId = c.req.param("fileId");

  const data = await c.req.arrayBuffer();

  await uploadFileDirect(
    code,
    fileId,
    data,
    {
      FILE_KV: c.env.FILE_KV,
      FILE_BUCKET: c.env.FILE_BUCKET,
    },
  );

  await markSessionReady(code, { FILE_KV: c.env.FILE_KV });

  return c.json({ fileId, size: data.byteLength });
});

export default app;
