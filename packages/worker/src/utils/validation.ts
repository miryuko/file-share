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
