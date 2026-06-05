import type { Session } from "../models/session";
import { AppError } from "../utils/error";

/** 统一分享码查询结果：文件类型 */
export interface CodeFileResult {
  type: "file";
  code: string;
  files: Session["files"];
  expiresAt: number;
  remainingDownloads: number;
}

/** 统一分享码查询结果：文本类型 */
export interface CodeTextResult {
  type: "text";
  content: string;
  expiresAt: number;
  createdAt: number;
}

export type CodeResult = CodeFileResult | CodeTextResult;

/**
 * 统一解析分享码类型
 *
 * 并行查询文件会话和文本分享两个 KV 命名空间，
 * 根据存在性和有效期自动判定类型。
 *
 * 优先级：文件会话 > 文本分享（如两者同时有效）
 *
 * @param code - 6 位分享码（已转为大写）
 * @param env - 含 FILE_KV 的运行时绑定
 * @returns 文件或文本类型的查询结果
 * @throws {AppError} CODE_NOT_FOUND — 两个命名空间均无匹配
 * @throws {AppError} CODE_EXPIRED — 匹配但已过期
 */
export async function resolveCode(
  code: string,
  env: { FILE_KV: KVNamespace },
): Promise<CodeResult> {
  // 并行查询两个 KV 命名空间
  const [fileRaw, textRaw] = await Promise.all([
    env.FILE_KV.get(`code:${code}`),
    env.FILE_KV.get(`text:${code}`),
  ]);

  // 尝试解析文件会话
  if (fileRaw) {
    const session: Session = JSON.parse(fileRaw);
    if (
      session.status !== "expired" &&
      Date.now() <= session.expiresAt &&
      session.downloadCount < session.maxDownloads
    ) {
      return {
        type: "file",
        code: session.code,
        files: session.files,
        expiresAt: session.expiresAt,
        remainingDownloads: session.maxDownloads - session.downloadCount,
      };
    }
  }

  // 尝试解析文本分享
  if (textRaw) {
    const entry: { content: string; createdAt: number; expiresAt: number } =
      JSON.parse(textRaw);
    if (Date.now() <= entry.expiresAt) {
      return {
        type: "text",
        content: entry.content,
        expiresAt: entry.expiresAt,
        createdAt: entry.createdAt,
      };
    }
  }

  // 两个都查到但都已过期
  if (fileRaw || textRaw) {
    throw new AppError(
      "CODE_EXPIRED",
      410,
      "内容已过期",
    );
  }

  // 两个都查不到
  throw new AppError(
    "CODE_NOT_FOUND",
    404,
    "分享码无效，请检查后重试",
  );
}
