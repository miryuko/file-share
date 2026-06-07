import { AppError } from "../utils/error";

/**
 * R2MultipartUpload 存储映射
 *
 * 因 Workers 无法在请求间持久化 R2MultipartUpload 对象引用，
 * 需将 uploadId 与 r2Key 的关系存储在 KV 中，以便后续恢复。
 */
interface StoredUpload {
  uploadId: string;
  r2Key: string;
  code: string;
  fileId: string;
}

/**
 * 存储 multipart upload 引用到 KV（用于跨请求恢复）
 */
async function storeUploadRef(
  code: string,
  fileId: string,
  uploadId: string,
  r2Key: string,
  env: { FILE_KV: KVNamespace },
): Promise<void> {
  const upload: StoredUpload = { uploadId, r2Key, code, fileId };
  await env.FILE_KV.put(
    `upload:${code}:${fileId}`,
    JSON.stringify(upload),
    { expirationTtl: 3600 },
  );
}

/**
 * 获取存储的 multipart upload 引用
 */
async function getUploadRef(
  code: string,
  fileId: string,
  env: { FILE_KV: KVNamespace },
): Promise<StoredUpload | null> {
  const raw = await env.FILE_KV.get(`upload:${code}:${fileId}`);
  if (!raw) return null;
  return JSON.parse(raw) as StoredUpload;
}

/**
 * 上传文件分片
 *
 * 接收单个分片的二进制数据，写入 R2 multipart upload。
 * 适用于大文件分片上传场景。
 *
 * @throws {AppError} SESSION_NOT_FOUND — 会话不存在
 * @throws {AppError} UPLOAD_NOT_FOUND — upload 引用不存在
 * @throws {AppError} STORAGE_ERROR — R2 写入失败
 */
export async function uploadPart(
  code: string,
  fileId: string,
  partNumber: number,
  data: ArrayBuffer,
  env: { FILE_KV: KVNamespace; FILE_BUCKET: R2Bucket },
): Promise<{ partNumber: number; etag: string }> {
  // 验证会话存在
  const sessionRaw = await env.FILE_KV.get(`code:${code}`);
  if (!sessionRaw) {
    throw new AppError(
      "SESSION_NOT_FOUND",
      404,
      "分享码无效，请检查后重试",
    );
  }

  // 获取 upload 引用
  const uploadRef = await getUploadRef(code, fileId, env);
  if (!uploadRef) {
    throw new AppError(
      "UPLOAD_NOT_FOUND",
      404,
      "上传会话不存在或已过期，请重新创建",
    );
  }

  const { uploadId, r2Key } = uploadRef;

  try {
    const multipart = env.FILE_BUCKET.resumeMultipartUpload(r2Key, uploadId);
    const uploadedPart = await multipart.uploadPart(partNumber, data);

    return {
      partNumber,
      etag: uploadedPart.etag,
    };
  } catch (err) {
    console.error(JSON.stringify({
      event: "r2.upload_part.failed",
      code,
      fileId,
      partNumber,
      error: String(err),
    }));
    throw new AppError(
      "STORAGE_ERROR",
      503,
      "分片上传失败，请重试",
    );
  }
}

/**
 * 完成 R2 multipart upload
 *
 * @throws {AppError} SESSION_NOT_FOUND — 分享码或文件不存在
 * @throws {AppError} UPLOAD_INCOMPLETE — parts 不匹配或 uploadId 无效
 * @throws {AppError} STORAGE_ERROR — R2 操作失败
 */
export async function completeUpload(
  code: string,
  fileId: string,
  parts: { partNumber: number; etag: string }[],
  env: { FILE_KV: KVNamespace; FILE_BUCKET: R2Bucket },
): Promise<{ fileId: string; size: number }> {
  // 验证会话存在
  const sessionRaw = await env.FILE_KV.get(`code:${code}`);
  if (!sessionRaw) {
    throw new AppError(
      "SESSION_NOT_FOUND",
      404,
      "分享码无效，请检查后重试",
    );
  }

  const session = JSON.parse(sessionRaw);
  const fileInfo = session.files?.find(
    (f: { fileId: string }) => f.fileId === fileId,
  );
  if (!fileInfo) {
    throw new AppError(
      "FILE_NOT_FOUND",
      404,
      "文件不存在",
    );
  }

  // 获取 upload 引用
  const uploadRef = await getUploadRef(code, fileId, env);
  if (!uploadRef) {
    throw new AppError(
      "UPLOAD_NOT_FOUND",
      404,
      "上传会话不存在或已过期",
    );
  }

  const { uploadId, r2Key } = uploadRef;

  try {
    const multipart = env.FILE_BUCKET.resumeMultipartUpload(r2Key, uploadId);

    // 按 partNumber 升序排列
    const sortedParts = [...parts].sort(
      (a, b) => a.partNumber - b.partNumber,
    );

    const completed = await multipart.complete(sortedParts);

    console.log(JSON.stringify({
      event: "upload.completed",
      code,
      fileId,
      size: completed.size,
    }));

    // 清理 upload 引用
    await env.FILE_KV.delete(`upload:${code}:${fileId}`);

    return {
      fileId,
      size: completed.size,
    };
  } catch (err) {
    if (err instanceof AppError) throw err;

    console.error(JSON.stringify({
      event: "r2.complete.failed",
      code,
      fileId,
      r2Key,
      uploadId,
      error: String(err),
    }));

    throw new AppError(
      "UPLOAD_FAILED",
      409,
      "上传完成失败，请检查上传状态后重试",
    );
  }
}

/**
 * 标记会话为 ready（所有文件上传完成后调用）
 */
export async function markSessionReady(
  code: string,
  env: { FILE_KV: KVNamespace },
): Promise<void> {
  const sessionRaw = await env.FILE_KV.get(`code:${code}`);
  if (!sessionRaw) return;

  const session = JSON.parse(sessionRaw);
  session.status = "ready";

  // 计算剩余 TTL，超过 KV 32 位有符号整数上限则不设过期
  const remainingTtl = Math.ceil((session.expiresAt - Date.now()) / 1000);
  const KV_TTL_MAX = 2147483647; // Max signed 32-bit integer
  if (remainingTtl > 0 && remainingTtl <= KV_TTL_MAX) {
    await env.FILE_KV.put(`code:${code}`, JSON.stringify(session), {
      expirationTtl: remainingTtl,
    });
  } else if (remainingTtl > KV_TTL_MAX) {
    // TTL exceeds KV limit (unlimited or very long TTL), write without expiration
    await env.FILE_KV.put(`code:${code}`, JSON.stringify(session));
  }

  console.log(JSON.stringify({
    event: "session.ready",
    code,
    fileCount: session.files.length,
  }));
}

/**
 * 直接上传小文件到 R2（不分片）
 *
 * @throws {AppError} STORAGE_ERROR — R2 写入失败
 */
export async function uploadFileDirect(
  code: string,
  fileId: string,
  data: ArrayBuffer,
  env: { FILE_KV: KVNamespace; FILE_BUCKET: R2Bucket },
): Promise<void> {
  const r2Key = `files/${code}/${fileId}`;

  try {
    await env.FILE_BUCKET.put(r2Key, data);

    console.log(JSON.stringify({
      event: "upload.direct.completed",
      code,
      fileId,
      size: data.byteLength,
    }));
  } catch (err) {
    console.error(JSON.stringify({
      event: "r2.direct_upload.failed",
      code,
      fileId,
      error: String(err),
    }));
    throw new AppError(
      "STORAGE_ERROR",
      503,
      "文件上传失败，请稍后重试",
    );
  }
}

/**
 * 暴露 storeUploadRef 供 session service 使用
 */
export { storeUploadRef };
