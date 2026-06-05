import { Hono } from "hono";
import { downloadFile } from "../services/download.service";

const app = new Hono<{ Bindings: CloudflareBindings }>();

// GET /api/download/:code/:fileId — 下载文件
app.get("/api/download/:code/:fileId", async (c) => {
  const code = c.req.param("code").toUpperCase();
  const fileId = c.req.param("fileId");

  const { body, filename, contentType, size } = await downloadFile(
    code,
    fileId,
    {
      FILE_KV: c.env.FILE_KV,
      FILE_BUCKET: c.env.FILE_BUCKET,
    },
  );

  const encodedFilename = encodeURIComponent(filename);

  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodedFilename}`,
      "Content-Length": String(size),
    },
  });
});

export default app;
