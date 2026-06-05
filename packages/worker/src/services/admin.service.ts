import type { AdminConfig, Session } from "../models/session";
import { DEFAULT_ADMIN_CONFIG } from "../models/session";
import { AppError } from "../utils/error";
import { signJwt } from "../utils/jwt";

/**
 * 管理员登录
 *
 * 验证密码，签发 JWT token（有效期 24 小时）。
 *
 * @throws {AppError} INVALID_PASSWORD — 密码错误
 */
export async function adminLogin(
  password: string,
  env: { FILE_KV: KVNamespace },
  secret: string,
): Promise<{ token: string }> {
  const storedHash = await env.FILE_KV.get("admin:password");

  if (!storedHash) {
    // 首次使用：设置默认密码
    if (password === "admin123") {
      await env.FILE_KV.put("admin:password", password);
    } else {
      throw new AppError(
        "INVALID_PASSWORD",
        401,
        "密码错误，请重试",
      );
    }
  }

  if (password !== storedHash) {
    throw new AppError(
      "INVALID_PASSWORD",
      401,
      "密码错误，请重试",
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const token = await signJwt(
    {
      sub: "admin",
      iat: now,
      exp: now + 86400, // 24 小时
    },
    secret,
  );

  console.log(JSON.stringify({
    event: "admin.login",
  }));

  return { token };
}

/**
 * 获取管理员配置
 */
export async function getAdminConfig(
  env: { FILE_KV: KVNamespace },
): Promise<AdminConfig> {
  const raw = await env.FILE_KV.get("admin:config");
  if (!raw) return { ...DEFAULT_ADMIN_CONFIG };
  try {
    return { ...DEFAULT_ADMIN_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_ADMIN_CONFIG };
  }
}

/**
 * 更新管理员配置
 */
export async function updateAdminConfig(
  updates: Partial<AdminConfig>,
  env: { FILE_KV: KVNamespace },
): Promise<AdminConfig> {
  const current = await getAdminConfig(env);
  const merged: AdminConfig = { ...current, ...updates };

  await env.FILE_KV.put("admin:config", JSON.stringify(merged));

  console.log(JSON.stringify({
    event: "admin.config.updated",
    ...merged,
  }));

  return merged;
}

/**
 * 列出活跃会话（status ≠ expired）
 */
export async function listActiveSessions(env: {
  FILE_KV: KVNamespace;
}): Promise<{ sessions: Session[]; total: number }> {
  const list = await env.FILE_KV.list({ prefix: "code:" });
  const sessions: Session[] = [];

  for (const key of list.keys) {
    const raw = await env.FILE_KV.get(key.name);
    if (!raw) continue;
    try {
      const session: Session = JSON.parse(raw);
      if (session.status !== "expired") {
        sessions.push(session);
      }
    } catch {
      // 跳过损坏的数据
    }
  }

  // 按创建时间倒序
  sessions.sort((a, b) => b.createdAt - a.createdAt);

  return { sessions, total: sessions.length };
}

/**
 * 强制终止会话
 *
 * @throws {AppError} SESSION_NOT_FOUND — 会话不存在
 */
export async function terminateSession(
  code: string,
  env: { FILE_KV: KVNamespace; FILE_BUCKET: R2Bucket },
): Promise<{ code: string; status: string }> {
  const raw = await env.FILE_KV.get(`code:${code}`);
  if (!raw) {
    throw new AppError(
      "SESSION_NOT_FOUND",
      404,
      "会话不存在",
    );
  }

  const session: Session = JSON.parse(raw);
  session.status = "expired";

  // 删除 R2 文件
  for (const file of session.files) {
    try {
      await env.FILE_BUCKET.delete(`files/${code}/${file.fileId}`);
    } catch (err) {
      console.error(JSON.stringify({
        event: "admin.terminate.r2_delete.failed",
        code,
        fileId: file.fileId,
        error: String(err),
      }));
    }
  }

  await env.FILE_KV.delete(`code:${code}`);

  console.log(JSON.stringify({
    event: "admin.session.terminated",
    code,
  }));

  return { code, status: "terminated" };
}
