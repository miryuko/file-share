/** 会话状态联合类型 */
export type SessionStatus = "uploading" | "ready" | "downloading" | "expired";

/** 单个文件信息 */
export interface FileInfo {
  /** 文件唯一标识（会话内） */
  fileId: string;
  /** 原始文件名 */
  filename: string;
  /** 文件大小（bytes） */
  size: number;
  /** MIME 类型 */
  contentType: string;
}

/** 存储在 KV 中的会话元数据 */
export interface Session {
  /** 6 位分享码 */
  code: string;
  /** 文件列表 */
  files: FileInfo[];
  /** 会话状态 */
  status: SessionStatus;
  /** 总文件大小（bytes） */
  totalSize: number;
  /** 创建时间（Unix ms） */
  createdAt: number;
  /** 过期时间（Unix ms） */
  expiresAt: number;
  /** 最大下载次数 */
  maxDownloads: number;
  /** 当前下载次数 */
  downloadCount: number;
  /** 创建者 IP */
  creatorIP: string;
}

/** 管理员配置 */
export interface AdminConfig {
  /** 单文件最大大小（bytes），默认 100MB */
  maxFileSize: number;
  /** 单次分享总大小上限（bytes），默认 500MB */
  maxTotalSize: number;
  /** 单次分享最大文件数，默认 20 */
  maxFiles: number;
  /** 文件过期时间（秒），默认 3600（1h） */
  ttlSeconds: number;
  /** 最大下载次数，默认 20 */
  maxDownloads: number;
  /** 单 IP 每分钟最多分享数，默认 10 */
  rateLimitPerMinute: number;
  /** 文本分享最大大小（bytes），默认 1MB */
  maxTextSize: number;
  /** 站点标题（浏览器标签页），默认 "File Share" */
  siteTitle: string;
  /** 站点副标题/描述（SEO），默认 "" */
  siteDescription: string;
  /** 自定义页脚公告，默认 ""（空=使用内置 i18n） */
  footerNotice: string;
}

/** 公开站点配置（从 AdminConfig 提取，无需认证即可读取） */
export interface SiteConfig {
  siteTitle: string;
  siteDescription: string;
  footerNotice: string;
}

/** 默认管理员配置 */
export const DEFAULT_ADMIN_CONFIG: AdminConfig = {
  maxFileSize: 100 * 1024 * 1024, // 100MB
  maxTotalSize: 500 * 1024 * 1024, // 500MB
  maxFiles: 20,
  ttlSeconds: 3600, // 1 hour
  maxDownloads: 20,
  rateLimitPerMinute: 10,
  maxTextSize: 1 * 1024 * 1024, // 1MB
  siteTitle: "File Share",
  siteDescription: "",
  footerNotice: "",
};
