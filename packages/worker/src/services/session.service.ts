import type { Session, AdminConfig } from "../models/session";
import { DEFAULT_ADMIN_CONFIG } from "../models/session";
import type {
  CreateSessionRequest,
  CreateSessionResponse,
} from "../models/api";
import { generateCode } from "../utils/code";
import { validateFiles } from "../utils/validation";
import { AppError } from "../utils/error";
import { storeUploadRef } from "./upload.service";

/**
 * 创建传输会话
 *
 * 调用链：校验文件 → 生成分享码 → 创建 R2 multipart uploads → 写入 KV
 *
 * @throws {AppError} VALIDATION_ERROR — 文件列表校验失败
 * @throws {AppError} CODE_COLLISION — 分享码碰撞重试耗尽
 * @throws {AppError} STORAGE_ERROR — KV 写入失败
 */
export async function createSession(
  input: CreateSessionRequest,
  env: { FILE_KV: KVNamespace; FILE_BUCKET: R2Bucket },
  clientIP: string,
  config: AdminConfig = DEFAULT_ADMIN_CONFIG,
): Promise<CreateSessionResponse> {
  // 1. 校验
  validateFiles(input, config);

  // 2. 生成唯一分享码（碰撞重试最多 3 次）
  const MAX_RETRIES = 3;
  let code = "";
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    code = generateCode();
    const existing = await env.FILE_KV.get(`code:${code}`);
    if (!existing) break;
    if (attempt === MAX_RETRIES - 1) {
      throw new AppError(
        "CODE_COLLISION",
        503,
        "服务繁忙，请稍后重试",
      );
    }
  }

  // 3. 为每个文件创建 R2 multipart upload
  const now = Date.now();
  // -1 = unlimited TTL: use a far-future expiry, skip KV expirationTtl
  const isUnlimitedTtl = config.ttlSeconds === -1;
  const ttlMs = isUnlimitedTtl ? 100 * 365 * 24 * 3600 * 1000 : config.ttlSeconds * 1000; // 100 years
  const files: CreateSessionResponse["files"] = [];

  for (let i = 0; i < input.files.length; i++) {
    const file = input.files[i];
    const fileId = `file_${i}`;
    const r2Key = `files/${code}/${fileId}`;

    try {
      const multipart = await env.FILE_BUCKET.createMultipartUpload(r2Key, {
        customMetadata: {
          filename: file.filename,
          contentType: file.contentType || "application/octet-stream",
        },
      });

      // 存储 upload 引用以支持跨请求恢复
      await storeUploadRef(code, fileId, multipart.uploadId, r2Key, env);

      files.push({
        fileId,
        filename: file.filename,
        uploadUrl: `/api/upload/${code}/${fileId}/part`,
      });
    } catch (err) {
      // 创建失败时清理已创建的上传
      console.error(JSON.stringify({
        event: "r2.multipart.create.failed",
        code,
        fileId,
        r2Key,
        error: String(err),
      }));
      throw new AppError(
        "STORAGE_ERROR",
        503,
        "服务异常，请稍后重试",
      );
    }
  }

  // 4. 写入 KV 会话
  const session: Session = {
    code,
    files: input.files.map((f, i) => ({
      fileId: `file_${i}`,
      filename: f.filename,
      size: f.size,
      contentType: f.contentType || "application/octet-stream",
    })),
    status: "uploading",
    totalSize: input.files.reduce((sum, f) => sum + f.size, 0),
    createdAt: now,
    expiresAt: now + ttlMs,
    maxDownloads: config.maxDownloads,
    downloadCount: 0,
    creatorIP: clientIP,
  };

  try {
    await env.FILE_KV.put(
      `code:${code}`,
      JSON.stringify(session),
      isUnlimitedTtl ? undefined : { expirationTtl: config.ttlSeconds },
    );
  } catch (err) {
    console.error(JSON.stringify({
      event: "kv.write.failed",
      code,
      error: String(err),
    }));
    throw new AppError(
      "STORAGE_ERROR",
      503,
      "服务异常，请稍后重试",
    );
  }

  console.log(JSON.stringify({
    event: "session.created",
    code,
    fileCount: files.length,
    totalSize: session.totalSize,
  }));

  return {
    code,
    files,
    expiresAt: session.expiresAt,
  };
}

/**
 * 查询会话信息
 *
 * @throws {AppError} SESSION_NOT_FOUND — 分享码不存在
 * @throws {AppError} SESSION_EXPIRED — 已过期或下载次数用尽
 */
export async function getSession(
  code: string,
  env: { FILE_KV: KVNamespace },
): Promise<Session> {
  const raw = await env.FILE_KV.get(`code:${code}`);

  if (!raw) {
    throw new AppError(
      "SESSION_NOT_FOUND",
      404,
      "分享码无效，请检查后重试",
    );
  }

  const session: Session = JSON.parse(raw);

  // 检查过期
  if (session.status === "expired" || Date.now() > session.expiresAt) {
    throw new AppError(
      "SESSION_EXPIRED",
      410,
      "文件已过期，文件保留 1 小时后自动清理",
    );
  }

  // 检查下载次数
  if (session.downloadCount >= session.maxDownloads) {
    throw new AppError(
      "DOWNLOAD_LIMIT_REACHED",
      410,
      "该分享已达到下载次数上限",
    );
  }

  return session;
}

/**
 * 读取管理员配置（从 KV 或返回默认值）
 */
export async function getAdminConfig(
  env: { FILE_KV: KVNamespace },
): Promise<AdminConfig> {
  const raw = await env.FILE_KV.get("admin:config");
  if (!raw) return DEFAULT_ADMIN_CONFIG;
  try {
    return { ...DEFAULT_ADMIN_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_ADMIN_CONFIG;
  }
}
