import { Hono } from "hono";
import { verifyJwt } from "../utils/jwt";
import { AppError } from "../utils/error";
import {
  adminLogin,
  getAdminConfig,
  updateAdminConfig,
  listActiveSessions,
  terminateSession,
} from "../services/admin.service";

const app = new Hono<{ Bindings: CloudflareBindings }>();

/** 从环境获取 JWT secret */
function getSecret(env: CloudflareBindings): string {
  return env.ADMIN_JWT_SECRET || "file-share-admin-secret-change-me";
}

/** 验证管理员认证，失败时抛出 AppError(401) */
async function requireAdmin(c: { req: { header: (name: string) => string | undefined }; env: CloudflareBindings }): Promise<void> {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AppError("UNAUTHORIZED", 401, "未登录，请先登录管理员账号");
  }

  const token = authHeader.slice(7);
  const payload = await verifyJwt(token, getSecret(c.env));

  if (!payload) {
    throw new AppError("TOKEN_EXPIRED", 401, "登录已过期，请重新登录");
  }
}

// POST /api/admin/login
app.post("/api/admin/login", async (c) => {
  const { password } = await c.req.json<{ password: string }>();
  const secret = getSecret(c.env);

  const result = await adminLogin(password, { FILE_KV: c.env.FILE_KV }, secret);
  return c.json(result);
});

// GET /api/admin/config
app.get("/api/admin/config", async (c) => {
  await requireAdmin(c);
  const config = await getAdminConfig({ FILE_KV: c.env.FILE_KV });
  return c.json(config);
});

// PUT /api/admin/config
app.put("/api/admin/config", async (c) => {
  await requireAdmin(c);
  const body = await c.req.json<Partial<import("../models/session").AdminConfig>>();
  const config = await updateAdminConfig(body, { FILE_KV: c.env.FILE_KV });
  return c.json(config);
});

// GET /api/admin/sessions
app.get("/api/admin/sessions", async (c) => {
  await requireAdmin(c);
  const result = await listActiveSessions({ FILE_KV: c.env.FILE_KV });
  return c.json(result);
});

// DELETE /api/admin/sessions/:code
app.delete("/api/admin/sessions/:code", async (c) => {
  await requireAdmin(c);
  const code = c.req.param("code").toUpperCase();
  const result = await terminateSession(code, {
    FILE_KV: c.env.FILE_KV,
    FILE_BUCKET: c.env.FILE_BUCKET,
  });
  return c.json(result);
});

export default app;
