import { Hono } from "hono";
import { resolveCode } from "../services/code.service";
import { isValidCode } from "../utils/code";
import { AppError } from "../utils/error";

const app = new Hono<{ Bindings: CloudflareBindings }>();

// GET /api/code/:code — 统一查询分享码（自动识别文件/文本类型）
app.get("/api/code/:code", async (c) => {
  const code = c.req.param("code").toUpperCase();

  // 校验分享码格式
  if (!isValidCode(code)) {
    throw new AppError(
      "INVALID_CODE",
      400,
      "分享码格式无效，请检查后重试",
    );
  }

  const result = await resolveCode(code, { FILE_KV: c.env.FILE_KV });

  return c.json(result);
});

export default app;
