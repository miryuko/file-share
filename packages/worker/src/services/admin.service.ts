import type { AdminConfig, Session, SiteConfig } from "../models/session";
import { DEFAULT_ADMIN_CONFIG } from "../models/session";
import { AppError } from "../utils/error";
import { signJwt } from "../utils/jwt";
import { hashPassword, verifyPassword } from "../utils/password";

const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_SECONDS = 300; // 5 分钟

/** 从环境变量获取默认密码，未配置时使用 "123456" */
export function getDefaultPassword(env: { ADMIN_DEFAULT_PASSWORD?: string }): string {
  return env.ADMIN_DEFAULT_PASSWORD || "123456";
}

/**
 * 管理员登录
 *
 * 验证密码，签发 JWT token（有效期 24 小时）。
 * 首次访问时用默认密码初始化（哈希存储）。
 * 5 次失败后锁定 5 分钟。
 *
 * @param defaultPassword — 环境配置的默认密码，用于首次初始化及检测
 * @returns token 和 needsPasswordChange（是否使用了默认密码需要强制修改）
 * @throws {AppError} INVALID_PASSWORD — 密码错误
 * @throws {AppError} ACCOUNT_LOCKED — 登录尝试超限
 */
export async function adminLogin(
  password: string,
  env: { FILE_KV: KVNamespace },
  secret: string,
  defaultPassword: string,
): Promise<{ token: string; needsPasswordChange: boolean }> {
  // 检查锁定状态
  const lockKey = "admin:login_lock";
  const lockData = await env.FILE_KV.get(lockKey);
  if (lockData) {
    const { attempts, lockedUntil } = JSON.parse(lockData);
    if (Date.now() < lockedUntil) {
      const remainingMin = Math.ceil((lockedUntil - Date.now()) / 60000);
      throw new AppError(
        "ACCOUNT_LOCKED",
        429,
        `登录尝试过多，请 ${remainingMin} 分钟后重试`,
      );
    }
  }

  const storedHash = await env.FILE_KV.get("admin:password");
  let isDefault = false;

  if (!storedHash) {
    // 首次使用：哈希存储默认密码
    if (password === defaultPassword) {
      const hashed = await hashPassword(password);
      await env.FILE_KV.put("admin:password", hashed);
      isDefault = true;
    } else {
      await recordFailedAttempt(env);
      throw new AppError("INVALID_PASSWORD", 401, "密码错误，请重试");
    }
    // 首次设置成功，继续签发 token
  } else {
    const isValid = await verifyPassword(password, storedHash);
    if (!isValid) {
      await recordFailedAttempt(env);
      throw new AppError("INVALID_PASSWORD", 401, "密码错误，请重试");
    }
    // 检查是否使用了默认密码
    isDefault = await verifyPassword(defaultPassword, storedHash);
  }

  // 清除锁定记录
  await env.FILE_KV.delete("admin:login_lock");

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
    needsPasswordChange: isDefault,
  }));

  return { token, needsPasswordChange: isDefault };
}

/**
 * 记录失败的登录尝试
 */
async function recordFailedAttempt(env: { FILE_KV: KVNamespace }): Promise<void> {
  const lockKey = "admin:login_lock";
  const raw = await env.FILE_KV.get(lockKey);
  let attempts = 1;
  let lockedUntil = 0;

  if (raw) {
    const data = JSON.parse(raw);
    attempts = data.attempts + 1;
  }

  if (attempts >= MAX_LOGIN_ATTEMPTS) {
    lockedUntil = Date.now() + LOGIN_LOCKOUT_SECONDS * 1000;
  }

  await env.FILE_KV.put(
    lockKey,
    JSON.stringify({ attempts, lockedUntil }),
    { expirationTtl: LOGIN_LOCKOUT_SECONDS },
  );

  console.warn(JSON.stringify({
    event: "admin.login_failed",
    attempts,
    locked: attempts >= MAX_LOGIN_ATTEMPTS,
  }));
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

/**
 * 修改管理员密码
 *
 * 验证当前密码后，用 PBKDF2 哈希存储新密码。
 *
 * @throws {AppError} INVALID_PASSWORD — 当前密码错误
 * @throws {AppError} SAME_PASSWORD — 新密码与当前密码相同
 * @throws {AppError} EMPTY_PASSWORD — 新密码为空
 * @throws {AppError} STORAGE_ERROR — KV 写入失败
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
  env: { FILE_KV: KVNamespace },
): Promise<{ success: boolean }> {
  if (!newPassword || newPassword.trim().length === 0) {
    throw new AppError("EMPTY_PASSWORD", 400, "新密码不能为空");
  }

  const storedHash = await env.FILE_KV.get("admin:password");

  // 如果是首次设置（无存储密码），允许直接设置
  if (storedHash) {
    const isValid = await verifyPassword(currentPassword, storedHash);
    if (!isValid) {
      throw new AppError("INVALID_PASSWORD", 400, "当前密码错误");
    }

    if (currentPassword === newPassword) {
      throw new AppError("SAME_PASSWORD", 400, "新密码不能与当前密码相同");
    }
  }

  const newHash = await hashPassword(newPassword);
  await env.FILE_KV.put("admin:password", newHash);

  console.log(JSON.stringify({
    event: "admin.password.changed",
  }));

  return { success: true };
}

/**
 * 检查是否仍在使用默认密码
 *
 * @param defaultPassword — 环境配置的默认密码
 * @returns true 如果当前密码为默认密码或尚未设置密码
 */
export async function isDefaultPassword(
  env: { FILE_KV: KVNamespace },
  defaultPassword: string,
): Promise<boolean> {
  const storedHash = await env.FILE_KV.get("admin:password");

  if (!storedHash) {
    // 未设置密码 = 首次访问，使用默认密码
    return true;
  }

  // 验证是否匹配默认密码
  return verifyPassword(defaultPassword, storedHash);
}

/**
 * 获取公开站点配置
 *
 * 从 admin:config 提取对外公开的外观配置子集，无需管理员认证。
 */
export async function getSiteConfig(
  env: { FILE_KV: KVNamespace },
): Promise<SiteConfig> {
  const config = await getAdminConfig(env);
  return {
    siteTitle: config.siteTitle,
    siteDescription: config.siteDescription,
    footerNotice: config.footerNotice,
    maxFileSize: config.maxFileSize,
    maxTotalSize: config.maxTotalSize,
    maxFiles: config.maxFiles,
    maxTextSize: config.maxTextSize,
    ttlSeconds: config.ttlSeconds,
    maxDownloads: config.maxDownloads,
  };
}
