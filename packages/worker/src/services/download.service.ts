import { AppError } from "../utils/error";
import { getSession } from "./session.service";

/**
 * 下载文件
 *
 * 从 R2 读取文件内容，同时递增下载计数。
 *
 * @returns R2ObjectBody — 文件内容流，调用方负责设置 Content-Type 等响应头
 * @throws {AppError} SESSION_NOT_FOUND — 分享码或文件不存在
 * @throws {AppError} SESSION_EXPIRED — 已过期或下载次数用尽
 * @throws {AppError} FILE_NOT_FOUND — 文件在 R2 中不存在
 * @throws {AppError} STORAGE_ERROR — R2 读取失败
 */
export async function downloadFile(
  code: string,
  fileId: string,
  env: { FILE_KV: KVNamespace; FILE_BUCKET: R2Bucket },
): Promise<{ body: ReadableStream; filename: string; contentType: string; size: number }> {
  // 1. 验证会话
  const session = await getSession(code, env);

  const fileInfo = session.files.find((f) => f.fileId === fileId);
  if (!fileInfo) {
    throw new AppError(
      "FILE_NOT_FOUND",
      404,
      "文件不存在",
    );
  }

  // 2. 从 R2 读取
  const r2Key = `files/${code}/${fileId}`;
  let object: R2ObjectBody;

  try {
    const result = await env.FILE_BUCKET.get(r2Key);
    if (!result) {
      throw new AppError(
        "FILE_NOT_FOUND",
        404,
        "文件不存在或已被清理",
      );
    }
    object = result;
  } catch (err) {
    if (err instanceof AppError) throw err;
    console.error(JSON.stringify({
      event: "r2.read.failed",
      code,
      fileId,
      r2Key,
      error: String(err),
    }));
    throw new AppError(
      "STORAGE_ERROR",
      503,
      "文件读取失败，请稍后重试",
    );
  }

  // 3. 递增下载计数
  session.downloadCount++;
  if (session.status === "ready") {
    session.status = "downloading";
  }

  const isExpired =
    session.downloadCount >= session.maxDownloads ||
    Date.now() > session.expiresAt;

  if (isExpired) {
    session.status = "expired";
  }

  const remainingTtl = Math.ceil((session.expiresAt - Date.now()) / 1000);
  if (remainingTtl > 0) {
    try {
      await env.FILE_KV.put(`code:${code}`, JSON.stringify(session), {
        expirationTtl: remainingTtl,
      });
    } catch (err) {
      // 计数更新失败不阻塞下载
      console.warn(JSON.stringify({
        event: "kv.count_update.failed",
        code,
        error: String(err),
      }));
    }
  }

  console.log(JSON.stringify({
    event: "file.downloaded",
    code,
    fileId,
    downloadCount: session.downloadCount,
    maxDownloads: session.maxDownloads,
  }));

  return {
    body: object.body,
    filename: fileInfo.filename,
    contentType: fileInfo.contentType,
    size: object.size,
  };
}
