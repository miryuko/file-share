/**
 * 文件分享 API 客户端
 */

const BASE_URL = import.meta.env.VITE_API_BASE || "";

interface CreateSessionRequest {
  files: { filename: string; size: number; contentType?: string }[];
}

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
  const res = await fetch(`${BASE_URL}${url}`, options);

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
): Promise<{ partNumber: number; etag: string }> {
  return request(`/api/upload/${code}/${fileId}/part?partNumber=${partNumber}`, {
    method: "POST",
    body: data,
  });
}

/** 完成上传 */
export async function completeUpload(
  code: string,
  fileId: string,
  parts: { partNumber: number; etag: string }[],
): Promise<{ fileId: string; size: number }> {
  return request(`/api/upload/${code}/${fileId}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ parts }),
  });
}

/** 获取下载 URL */
export function getDownloadUrl(code: string, fileId: string): string {
  return `${BASE_URL}/api/download/${code}/${fileId}`;
}

export { ApiError };
