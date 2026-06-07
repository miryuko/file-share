import type { FileInfo } from "./session";

// ── 请求类型 ──

/** POST /api/session/create 请求体 */
export interface CreateSessionRequest {
  files: {
    filename: string;
    size: number;
    contentType?: string;
  }[];
  /** 用户选择的过期时间（秒），不得超过站点配置上限，-1 = 永久 */
  ttlSeconds?: number;
  /** 用户选择的最大下载次数，不得超过站点配置上限，-1 = 无限制 */
  maxDownloads?: number;
}

/** POST /api/upload/:code/:fileId/complete 请求体 */
export interface CompleteUploadRequest {
  uploadId: string;
  parts: {
    partNumber: number;
    etag: string;
  }[];
}

// ── 响应类型 ──

/** POST /api/session/create 成功响应 */
export interface CreateSessionResponse {
  code: string;
  files: {
    fileId: string;
    filename: string;
    uploadUrl: string;
  }[];
  expiresAt: number;
}

/** GET /api/session/:code 成功响应 */
export interface GetSessionResponse {
  code: string;
  files: FileInfo[];
  expiresAt: number;
  remainingDownloads: number;
  status: string;
}

/** 统一错误响应 */
export interface ErrorResponse {
  code: string;
  message: string;
}
