/**
 * 文件分享 API 客户端
 */

const BASE_URL = import.meta.env.VITE_API_BASE || "";

interface CreateSessionResponse {
  code: string;
  files: { fileId: string; filename: string; uploadUrl: string }[];
  expiresAt: number;
}

interface GetSessionResponse {
  code: string;
  files: { fileId: string; filename: string; size: number; contentType: string }[];
  expiresAt: number;
  remainingDownloads: number;
  status: string;
}

interface ErrorResponse {
  code: string;
  message: string;
}

class ApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
    this.name = "ApiError";
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${url}`, options ?? {});

  if (!res.ok) {
    let body: ErrorResponse;
    try {
      body = await res.json();
    } catch {
      body = { code: "NETWORK_ERROR", message: "网络异常，请检查连接" };
    }
    throw new ApiError(body.code, res.status, body.message);
  }

  return res.json();
}

/** 创建上传会话 */
export async function createSession(
  files: { filename: string; size: number; contentType?: string }[],
): Promise<CreateSessionResponse> {
  return request<CreateSessionResponse>("/api/session/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files }),
  });
}

/** 获取会话信息 */
export async function getSession(code: string): Promise<GetSessionResponse> {
  return request<GetSessionResponse>(`/api/session/${code}`);
}

/** 上传文件分片 */
export async function uploadPart(
  code: string,
  fileId: string,
  partNumber: number,
  data: ArrayBuffer,
  signal?: AbortSignal,
): Promise<{ partNumber: number; etag: string }> {
  return request(`/api/upload/${code}/${fileId}/part?partNumber=${partNumber}`, {
    method: "POST",
    body: data,
    signal,
  });
}

/** 完成上传 */
export async function completeUpload(
  code: string,
  fileId: string,
  parts: { partNumber: number; etag: string }[],
  signal?: AbortSignal,
): Promise<{ fileId: string; size: number }> {
  return request(`/api/upload/${code}/${fileId}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ parts }),
    signal,
  });
}

/** 直接上传小文件（< 5MB），不分片 */
export async function uploadFileDirect(
  code: string,
  fileId: string,
  data: ArrayBuffer,
  signal?: AbortSignal,
): Promise<{ fileId: string; size: number }> {
  return request(`/api/upload/${code}/${fileId}/direct`, {
    method: "POST",
    body: data,
    signal,
  });
}

/** 获取下载 URL */
export function getDownloadUrl(code: string, fileId: string): string {
  return `${BASE_URL}/api/download/${code}/${fileId}`;
}

// ── 统一分享码查询 ──

/** 统一分享码查询响应：文件类型 */
export interface CodeFileData {
  type: "file";
  code: string;
  files: { fileId: string; filename: string; size: number; contentType: string }[];
  expiresAt: number;
  remainingDownloads: number;
}

/** 统一分享码查询响应：文本类型 */
export interface CodeTextData {
  type: "text";
  content: string;
  expiresAt: number;
  createdAt: number;
}

export type CodeData = CodeFileData | CodeTextData;

/** 统一查询分享码（自动识别文件/文本类型） */
export async function getCodeInfo(code: string): Promise<CodeData> {
  return request<CodeData>(`/api/code/${code}`);
}

// ── 站点配置 ──

/** 公开站点配置（从 GET /api/site/config 获取） */
export interface SiteConfig {
  siteTitle: string;
  siteDescription: string;
  footerNotice: string;
  maxFileSize: number;
  maxTotalSize: number;
  maxFiles: number;
  maxTextSize: number;
}

/** 获取公开站点配置（无需认证） */
export async function getSiteConfig(): Promise<SiteConfig> {
  return request<SiteConfig>("/api/site/config");
}

export { ApiError };
