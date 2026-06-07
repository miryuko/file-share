import { AppError } from "./error";
import type { AdminConfig } from "../models/session";
import { DEFAULT_ADMIN_CONFIG } from "../models/session";

/**
 * 文件列表校验结果
 */
export interface ValidationInput {
  files: { filename: string; size: number; contentType?: string }[];
}

/**
 * 用户配置偏好校验输入
 */
export interface UserPreferences {
  ttlSeconds?: number;
  maxDownloads?: number;
}

/**
 * 校验上传文件列表
 *
 * 校验规则：
 * 1. 文件列表不能为空
 * 2. 单个文件不超过 maxFileSize
 * 3. 总大小不超过 maxTotalSize
 * 4. 文件数不超过 maxFiles
 * 5. 文件名不能为空
 *
 * @param input - 文件列表
 * @param config - 管理员配置（使用默认值兜底）
 * @throws {AppError} 校验失败时抛出对应错误
 */
export function validateFiles(
  input: ValidationInput,
  config: AdminConfig = DEFAULT_ADMIN_CONFIG,
): void {
  const { files } = input;

  if (!files || files.length === 0) {
    throw new AppError(
      "NO_FILES",
      400,
      "请至少选择一个文件",
    );
  }

  if (config.maxFiles !== -1 && files.length > config.maxFiles) {
    throw new AppError(
      "TOO_MANY_FILES",
      400,
      `文件数量不能超过 ${config.maxFiles} 个`,
    );
  }

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  if (config.maxTotalSize !== -1 && totalSize > config.maxTotalSize) {
    const limitMB = (config.maxTotalSize / (1024 * 1024)).toFixed(0);
    throw new AppError(
      "TOTAL_SIZE_EXCEEDED",
      413,
      `总文件大小不能超过 ${limitMB}MB`,
    );
  }

  for (const file of files) {
    if (!file.filename || file.filename.trim().length === 0) {
      throw new AppError(
        "INVALID_FILENAME",
        400,
        "文件名不能为空",
      );
    }

    if (file.filename.length > 255) {
      throw new AppError(
        "FILENAME_TOO_LONG",
        400,
        "文件名不能超过 255 个字符",
      );
    }

    if (file.size <= 0) {
      throw new AppError(
        "INVALID_FILE_SIZE",
        400,
        `文件 "${file.filename}" 大小为 0，请检查文件是否有效`,
      );
    }

    if (config.maxFileSize !== -1 && file.size > config.maxFileSize) {
      const limitMB = (config.maxFileSize / (1024 * 1024)).toFixed(0);
      throw new AppError(
        "FILE_TOO_LARGE",
        413,
        `文件 "${file.filename}" 超过 ${limitMB}MB 限制`,
      );
    }
  }
}

/**
 * 校验用户配置偏好（ttlSeconds、maxDownloads）
 *
 * 用户选择的值不得超过管理员配置的上限。
 * -1 表示无限制，只有管理员也设为 -1 时才允许用户选 -1。
 *
 * @param prefs - 用户上传时选择的偏好
 * @param config - 管理员配置
 * @throws {AppError} 校验失败时抛出对应错误
 */
export function validateUserPreferences(
  prefs: UserPreferences,
  config: AdminConfig,
): void {
  // 校验过期时间
  if (prefs.ttlSeconds !== undefined) {
    if (prefs.ttlSeconds <= 0 && prefs.ttlSeconds !== -1) {
      throw new AppError(
        "INVALID_TTL",
        400,
        "过期时间必须为正数",
      );
    }

    // 管理员有限制时，用户不能超过该限制
    if (config.ttlSeconds !== -1) {
      if (prefs.ttlSeconds === -1) {
        throw new AppError(
          "TTL_EXCEEDS_LIMIT",
          400,
          `过期时间不能超过 ${formatTtl(config.ttlSeconds)}`,
        );
      }
      if (prefs.ttlSeconds > config.ttlSeconds) {
        throw new AppError(
          "TTL_EXCEEDS_LIMIT",
          400,
          `过期时间不能超过 ${formatTtl(config.ttlSeconds)}`,
        );
      }
    }
  }

  // 校验最大下载次数
  if (prefs.maxDownloads !== undefined) {
    if (prefs.maxDownloads <= 0 && prefs.maxDownloads !== -1) {
      throw new AppError(
        "INVALID_DOWNLOADS",
        400,
        "下载次数必须为正数",
      );
    }

    // 管理员有限制时，用户不能超过该限制
    if (config.maxDownloads !== -1) {
      if (prefs.maxDownloads === -1) {
        throw new AppError(
          "DOWNLOADS_EXCEEDS_LIMIT",
          400,
          `下载次数不能超过 ${config.maxDownloads} 次`,
        );
      }
      if (prefs.maxDownloads > config.maxDownloads) {
        throw new AppError(
          "DOWNLOADS_EXCEEDS_LIMIT",
          400,
          `下载次数不能超过 ${config.maxDownloads} 次`,
        );
      }
    }
  }
}

/** 格式化 TTL 秒数为可读字符串 */
function formatTtl(seconds: number): string {
  if (seconds < 60) return `${seconds} 秒`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} 分钟`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} 小时`;
  return `${Math.round(seconds / 86400)} 天`;
}
