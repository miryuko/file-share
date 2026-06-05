import { generateCode } from "../utils/code";
import { AppError } from "../utils/error";
import { getAdminConfig } from "./admin.service";
import { DEFAULT_ADMIN_CONFIG } from "../models/session";

/** 文本分享条目 */
interface TextEntry {
  code: string;
  content: string;
  createdAt: number;
  expiresAt: number;
}

/**
 * 创建文本分享
 *
 * @throws {AppError} TEXT_EMPTY — 内容为空
 * @throws {AppError} TEXT_TOO_LARGE — 超过 1MB 限制
 * @throws {AppError} CODE_COLLISION — 分享码碰撞重试耗尽
 * @throws {AppError} STORAGE_ERROR — KV 写入失败
 */
export async function createTextShare(
  content: string,
  env: { FILE_KV: KVNamespace },
): Promise<{ code: string; expiresAt: number }> {
  // 从管理员配置读取限制（配置读取失败时使用默认值兜底）
  const config = await getAdminConfig(env).catch(() => DEFAULT_ADMIN_CONFIG);
  const maxTextSize = config.maxTextSize;

  // 校验
  if (!content || content.trim().length === 0) {
    throw new AppError("TEXT_EMPTY", 400, "请输入要分享的文本内容");
  }

  const contentBytes = new TextEncoder().encode(content);
  if (contentBytes.byteLength > maxTextSize) {
    const sizeMB = (contentBytes.byteLength / (1024 * 1024)).toFixed(1);
    const limitMB = (maxTextSize / (1024 * 1024)).toFixed(0);
    throw new AppError(
      "TEXT_TOO_LARGE",
      400,
      `文本过长（${sizeMB}MB），当前限制 ${limitMB}MB，请使用文件传输`,
    );
  }

  // 生成唯一分享码
  const MAX_RETRIES = 3;
  let code = "";
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    code = generateCode();
    // 检查与文件 session 和文本 entry 的碰撞
    const [fileExists, textExists] = await Promise.all([
      env.FILE_KV.get(`code:${code}`),
      env.FILE_KV.get(`text:${code}`),
    ]);
    if (!fileExists && !textExists) break;
    if (attempt === MAX_RETRIES - 1) {
      throw new AppError("CODE_COLLISION", 503, "服务繁忙，请稍后重试");
    }
  }

  const now = Date.now();
  const ttlSeconds = config.ttlSeconds;

  const entry: TextEntry = {
    code,
    content,
    createdAt: now,
    expiresAt: now + ttlSeconds * 1000,
  };

  try {
    await env.FILE_KV.put(`text:${code}`, JSON.stringify(entry), {
      expirationTtl: ttlSeconds,
    });
  } catch {
    throw new AppError("STORAGE_ERROR", 503, "服务异常，请稍后重试");
  }

  console.log(JSON.stringify({
    event: "text.created",
    code,
    size: contentBytes.byteLength,
  }));

  return { code, expiresAt: entry.expiresAt };
}

/**
 * 获取文本分享
 *
 * @throws {AppError} TEXT_NOT_FOUND — 分享码不存在
 * @throws {AppError} TEXT_EXPIRED — 已过期
 */
export async function getTextShare(
  code: string,
  env: { FILE_KV: KVNamespace },
): Promise<TextEntry> {
  const raw = await env.FILE_KV.get(`text:${code}`);

  if (!raw) {
    throw new AppError(
      "TEXT_NOT_FOUND",
      404,
      "分享码无效，请检查后重试",
    );
  }

  const entry: TextEntry = JSON.parse(raw);

  if (Date.now() > entry.expiresAt) {
    throw new AppError(
      "TEXT_EXPIRED",
      410,
      "内容已过期，文本保留 1 小时后自动清理",
    );
  }

  console.log(JSON.stringify({
    event: "text.accessed",
    code,
  }));

  return entry;
}
