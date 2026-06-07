/**
 * 站点配置 composable
 *
 * 从 GET /api/site/config 获取公开站点配置（标题、限制等），
 * 模块级缓存：首次调用 fetch，后续返回已缓存值。
 * 加载失败时静默降级为内置默认值。
 */

import { ref, type Ref } from "vue";
import { getSiteConfig, type SiteConfig } from "../lib/api";

/** 与后端 DEFAULT_ADMIN_CONFIG 保持一致的默认值 */
const DEFAULT_SITE_CONFIG: SiteConfig = {
  siteTitle: "File Share",
  siteDescription: "",
  footerNotice: "",
  maxFileSize: 100 * 1024 * 1024,
  maxTotalSize: 500 * 1024 * 1024,
  maxFiles: 20,
  maxTextSize: 100000,
  ttlSeconds: 3600,
  maxDownloads: 20,
};

/** 模块级缓存 */
const config = ref<SiteConfig>({ ...DEFAULT_SITE_CONFIG });
const loaded = ref(false);
const loading = ref(false);

export function useSiteConfig(): {
  config: Ref<SiteConfig>;
  loaded: Ref<boolean>;
  load: () => Promise<void>;
} {
  async function load(): Promise<void> {
    if (loaded.value || loading.value) return;
    loading.value = true;

    try {
      const remote = await getSiteConfig();
      // 合并远程配置，用默认值兜底（处理字段缺失或无效值的情况）
      config.value = {
        siteTitle: remote.siteTitle || DEFAULT_SITE_CONFIG.siteTitle,
        siteDescription: remote.siteDescription || DEFAULT_SITE_CONFIG.siteDescription,
        footerNotice: remote.footerNotice || DEFAULT_SITE_CONFIG.footerNotice,
        maxFileSize: isValidLimit(remote.maxFileSize)
          ? remote.maxFileSize
          : DEFAULT_SITE_CONFIG.maxFileSize,
        maxTotalSize: isValidLimit(remote.maxTotalSize)
          ? remote.maxTotalSize
          : DEFAULT_SITE_CONFIG.maxTotalSize,
        maxFiles: isValidLimit(remote.maxFiles)
          ? remote.maxFiles
          : DEFAULT_SITE_CONFIG.maxFiles,
        maxTextSize: isValidLimit(remote.maxTextSize)
          ? remote.maxTextSize
          : DEFAULT_SITE_CONFIG.maxTextSize,
        ttlSeconds: isValidTTL(remote.ttlSeconds)
          ? remote.ttlSeconds
          : DEFAULT_SITE_CONFIG.ttlSeconds,
        maxDownloads: isValidMaxDownloads(remote.maxDownloads)
          ? remote.maxDownloads
          : DEFAULT_SITE_CONFIG.maxDownloads,
      };
      loaded.value = true;
    } catch (err) {
      console.warn(
        "Site config unavailable, using defaults",
        err instanceof Error ? err.message : String(err),
      );
      // 已使用默认值，标记为已加载以防止无限重试
      loaded.value = true;
    } finally {
      loading.value = false;
    }
  }

  return { config, loaded, load };
}

/** 校验限制值是否为正数 */
function isValidLimit(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/** 校验 TTL 值：正数或 -1（无限制） */
function isValidTTL(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && (value > 0 || value === -1);
}

/** 校验最大下载次数：正数或 -1（无限制） */
function isValidMaxDownloads(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && (value > 0 || value === -1);
}
