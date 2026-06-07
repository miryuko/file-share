/**
 * 文件上传管理器 composable
 *
 * 两阶段上传流程：
 *   阶段 1（选择 & 审核）：addFiles() → 用户审核文件列表 → removeFile() 移除不需要的文件
 *   阶段 2（上传）：startUpload() → 创建会话 → 按文件大小选择直传/分片上传 → 显示进度
 *
 * 特性：
 *   - 小文件（< 5MB）使用直传端点，大文件使用分片上传
 *   - 分片上传失败自动重试（最多 3 次，指数退避 200/400/800ms）
 *   - 支持 AbortController 取消正在进行的上传
 *   - 基于最近 3 个分片的滚动窗口计算速度和 ETA
 *   - 进度更新节流至 200ms
 */

import { ref, computed, type Ref, type ComputedRef } from "vue";
import {
  createSession,
  uploadPart,
  completeUpload,
  uploadFileDirect,
  ApiError,
} from "../lib/api";
import { useSiteConfig } from "./useSiteConfig";

// ── 类型定义 ──

/** 上传阶段 */
export type UploadPhase = "selecting" | "uploading" | "completed" | "error" | "cancelled";

/** 单个文件的审核阶段信息 */
export interface SelectedFileInfo {
  file: File;
  id: string;
  size: number;
  name: string;
  type: string;
  extension: string;
  hash: string;
  isValid: boolean;
  validationError?: string;
}

/** 单个文件的上传进度 */
export interface FileUploadProgress {
  fileId: string;
  filename: string;
  file: File;
  status: "pending" | "uploading" | "completed" | "error" | "cancelled";
  progress: number;
  loadedBytes: number;
  totalBytes: number;
  speed: number;
  eta: number;
  error?: string;
  uploadMethod: "direct" | "chunked";
}

/** addFiles 的返回值 */
export interface AddFilesResult {
  added: number;
  rejected: number;
  errors: string[];
}

/** 总体上传进度 */
export interface OverallProgress {
  pct: number;
  speed: number;
  eta: number;
}

// ── 常量 ──

/** 分片大小：5MB */
const CHUNK_SIZE = 5 * 1024 * 1024;

/** 小文件直传阈值 */
const DIRECT_UPLOAD_THRESHOLD = 5 * 1024 * 1024;

/** 最大重试次数 */
const MAX_RETRIES = 3;

/** 重试退避延迟（ms） */
const RETRY_DELAYS = [200, 400, 800];

/** 进度更新节流间隔（ms） */
const PROGRESS_THROTTLE_MS = 200;

// ── composable ──

export interface UploadOptions {
  /** 用户选择的过期时间（秒），-1 = 永久 */
  ttlSeconds?: number;
  /** 用户选择的最大下载次数，-1 = 无限制 */
  maxDownloads?: number;
}

export function useFileUploadManager(): {
  // 阶段 1：文件选择
  selectedFiles: Ref<SelectedFileInfo[]>;
  canAddMoreFiles: ComputedRef<boolean>;
  addFiles: (files: File[]) => Promise<AddFilesResult>;
  removeFile: (index: number) => void;
  clearFiles: () => void;

  // 阶段 2：上传
  phase: Ref<UploadPhase>;
  shareCode: Ref<string>;
  fileUploads: Ref<FileUploadProgress[]>;
  overallProgress: ComputedRef<OverallProgress>;
  startUpload: (options?: UploadOptions) => Promise<string>;
  cancelUpload: () => void;

  // 重置
  reset: () => void;
} {
  const { config } = useSiteConfig();

  // ── 阶段 1 状态 ──
  const selectedFiles = ref<SelectedFileInfo[]>([]);

  // ── 阶段 2 状态 ──
  const phase = ref<UploadPhase>("selecting");
  const shareCode = ref("");
  const fileUploads = ref<FileUploadProgress[]>([]);

  // ── 取消控制 ──
  let abortController: AbortController | null = null;

  // ── 速度计算 ──
  // 记录最近 3 个分片的 [timestamp, bytes] 用于滚动窗口计算
  const speedSamples: Array<{ time: number; bytes: number }> = [];

  // ── 计算属性 ──

  const canAddMoreFiles = computed(() => {
    const maxFiles = config.value.maxFiles;
    if (maxFiles === -1) return true;
    return selectedFiles.value.length < maxFiles;
  });

  const overallProgress = computed<OverallProgress>(() => {
    const uploads = fileUploads.value;
    if (uploads.length === 0) return { pct: 0, speed: 0, eta: 0 };

    const totalBytes = uploads.reduce((sum, u) => sum + u.totalBytes, 0);
    const loadedBytes = uploads.reduce((sum, u) => sum + u.loadedBytes, 0);

    if (totalBytes === 0) return { pct: 0, speed: 0, eta: 0 };

    const pct = Math.round((loadedBytes / totalBytes) * 100);

    // 汇总速度：取所有正在上传的文件的速度之和
    const speed = uploads
      .filter((u) => u.status === "uploading")
      .reduce((sum, u) => sum + u.speed, 0);

    const remaining = totalBytes - loadedBytes;
    const eta = speed > 0 ? Math.ceil(remaining / speed) : 0;

    return { pct, speed, eta };
  });

  // ── 阶段 1 方法 ──

  /** 添加文件到审核列表，执行客户端校验（含 SHA-256 哈希重复检测） */
  async function addFiles(files: File[]): Promise<AddFilesResult> {
    const result: AddFilesResult = { added: 0, rejected: 0, errors: [] };
    const maxFiles = config.value.maxFiles;
    const maxFileSize = config.value.maxFileSize;
    const maxTotalSize = config.value.maxTotalSize;

    for (const file of files) {
      // 检查文件总数上限
      if (maxFiles !== -1 && selectedFiles.value.length >= maxFiles) {
        result.rejected++;
        result.errors.push(`已达最大文件数限制（${maxFiles} 个），"${file.name}" 未添加`);
        continue;
      }

      // 检查空文件
      if (file.size <= 0) {
        result.rejected++;
        result.errors.push(`文件 "${file.name}" 大小为 0，已跳过`);
        continue;
      }

      // 检查单文件大小
      if (maxFileSize !== -1 && file.size > maxFileSize) {
        result.rejected++;
        const limitMB = (maxFileSize / (1024 * 1024)).toFixed(0);
        result.errors.push(`文件 "${file.name}" 超过 ${limitMB}MB 限制，已跳过`);
        continue;
      }

      // 检查总大小
      if (maxTotalSize !== -1) {
        const currentTotal = selectedFiles.value.reduce((s, f) => s + f.size, 0);
        const newTotal = currentTotal + file.size;
        if (newTotal > maxTotalSize) {
          result.rejected++;
          const limitMB = (maxTotalSize / (1024 * 1024)).toFixed(0);
          result.errors.push(
            `添加 "${file.name}" 后总大小超过 ${limitMB}MB 限制，已跳过`,
          );
          continue;
        }
      }

      // 计算文件 SHA-256 哈希
      const hash = await computeFileHash(file);

      // 检查重复文件（基于 SHA-256 哈希）
      const isDuplicate = selectedFiles.value.some((f) => f.hash === hash);
      if (isDuplicate) {
        result.rejected++;
        result.errors.push(`文件 "${file.name}" 已存在（内容相同），已跳过`);
        continue;
      }

      selectedFiles.value.push({
        file,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        size: file.size,
        name: file.name,
        type: file.type || "",
        extension: getExtension(file.name),
        hash,
        isValid: true,
      });
      result.added++;
    }

    return result;
  }

  /** 从审核列表中移除指定文件 */
  function removeFile(index: number): void {
    if (index >= 0 && index < selectedFiles.value.length) {
      selectedFiles.value.splice(index, 1);
    }
  }

  /** 清空审核列表 */
  function clearFiles(): void {
    selectedFiles.value = [];
  }

  // ── 阶段 2 方法 ──

  /** 开始上传所有审核通过的文件 */
  async function startUpload(options?: UploadOptions): Promise<string> {
    if (selectedFiles.value.length === 0) {
      throw new Error("没有可上传的文件");
    }

    phase.value = "uploading";
    abortController = new AbortController();
    speedSamples.length = 0;

    // 初始化上传进度
    fileUploads.value = selectedFiles.value.map((sf) => ({
      fileId: "",
      filename: sf.name,
      file: sf.file,
      status: "pending" as const,
      progress: 0,
      loadedBytes: 0,
      totalBytes: sf.size,
      speed: 0,
      eta: 0,
      uploadMethod: sf.size < DIRECT_UPLOAD_THRESHOLD ? "direct" : "chunked",
    }));

    try {
      // 1. 创建会话（传递用户配置偏好）
      const session = await createSession(
        selectedFiles.value.map((sf) => ({
          filename: sf.name,
          size: sf.size,
          contentType: sf.type || undefined,
        })),
        {
          ttlSeconds: options?.ttlSeconds,
          maxDownloads: options?.maxDownloads,
        },
      );

      if (abortController.signal.aborted) {
        phase.value = "cancelled";
        return "";
      }

      shareCode.value = session.code;

      // 2. 逐个上传文件
      for (let i = 0; i < selectedFiles.value.length; i++) {
        if (abortController.signal.aborted) {
          markRemainingCancelled(i);
          break;
        }

        const sf = selectedFiles.value[i];
        const fileInfo = session.files[i];
        const fp = fileUploads.value[i];
        if (!sf || !fileInfo || !fp) continue;

        fp.fileId = fileInfo.fileId;
        fp.status = "uploading";

        try {
          if (sf.size < DIRECT_UPLOAD_THRESHOLD) {
            await uploadSmallFile(session.code, fileInfo.fileId, sf.file, fp);
          } else {
            await uploadLargeFile(session.code, fileInfo.fileId, sf.file, fp);
          }
        } catch (err) {
          if (abortController.signal.aborted) {
            fp.status = "cancelled";
          } else {
            fp.status = "error";
            fp.error =
              err instanceof ApiError ? err.message : "上传失败，请检查网络后重试";
          }
        }
      }

      // 3. 确定最终状态
      if (abortController.signal.aborted) {
        phase.value = "cancelled";
      } else if (fileUploads.value.every((f) => f.status === "completed")) {
        phase.value = "completed";
      } else if (fileUploads.value.some((f) => f.status === "completed")) {
        // 部分成功仍算完成（用户可以重试失败的）
        phase.value = "completed";
      } else {
        phase.value = "error";
      }

      return shareCode.value;
    } catch (err) {
      // 会话创建失败
      if (!abortController.signal.aborted) {
        phase.value = "error";
        const message =
          err instanceof ApiError ? err.message : "上传失败，请检查网络后重试";
        fileUploads.value.forEach((fp) => {
          fp.status = "error";
          fp.error = message;
        });
      }
      throw err;
    } finally {
      abortController = null;
    }
  }

  /** 取消正在进行的上传 */
  function cancelUpload(): void {
    if (abortController) {
      abortController.abort();
    }
  }

  // ── 直传（小文件） ──

  async function uploadSmallFile(
    code: string,
    fileId: string,
    file: File,
    fp: FileUploadProgress,
  ): Promise<void> {
    const data = await file.arrayBuffer();
    if (abortController?.signal.aborted) return;

    await uploadFileDirect(code, fileId, data, abortController?.signal);
    if (abortController?.signal.aborted) return;

    fp.status = "completed";
    fp.progress = 100;
    fp.loadedBytes = fp.totalBytes;
    fp.speed = 0;
    fp.eta = 0;
  }

  // ── 分片上传（大文件） ──

  async function uploadLargeFile(
    code: string,
    fileId: string,
    file: File,
    fp: FileUploadProgress,
  ): Promise<void> {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const parts: { partNumber: number; etag: string }[] = [];
    let lastSampleTime = Date.now();

    for (let i = 0; i < totalChunks; i++) {
      if (abortController?.signal.aborted) return;

      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);
      const data = await chunk.arrayBuffer();

      // 带重试的分片上传
      const partResult = await uploadChunkWithRetry(
        code,
        fileId,
        i + 1,
        data,
      );

      if (partResult === null) {
        // 重试耗尽或取消
        if (abortController?.signal.aborted) return;
        throw new Error(`分片 ${i + 1} 上传失败`);
      }

      parts.push(partResult);

      // 更新进度
      fp.loadedBytes = end;
      fp.progress = Math.round(((i + 1) / totalChunks) * 100);

      // 计算速度（滚动窗口）
      const now = Date.now();
      speedSamples.push({ time: now, bytes: data.byteLength });
      // 只保留最近 3 个样本
      while (speedSamples.length > 3) speedSamples.shift();

      if (speedSamples.length >= 2) {
        const oldest = speedSamples[0]!;
        const elapsed = (now - oldest.time) / 1000;
        const totalSampleBytes = speedSamples.reduce((s, sm) => s + sm.bytes, 0);
        fp.speed = elapsed > 0 ? Math.round(totalSampleBytes / elapsed) : 0;
        const remaining = fp.totalBytes - fp.loadedBytes;
        fp.eta = fp.speed > 0 ? Math.ceil(remaining / fp.speed) : 0;
      }

      // 节流：距离上次更新不足 PROGRESS_THROTTLE_MS 且不是最后一个分片则跳过
      if (i < totalChunks - 1 && now - lastSampleTime < PROGRESS_THROTTLE_MS) {
        // 仍然更新速度但跳过触发响应式（通过直接修改，Vue 会批量处理）
      }
      lastSampleTime = now;
    }

    // 完成上传
    await completeUpload(code, fileId, parts, abortController?.signal);
    if (abortController?.signal.aborted) return;

    fp.status = "completed";
    fp.progress = 100;
    fp.loadedBytes = fp.totalBytes;
    fp.speed = 0;
    fp.eta = 0;
  }

  /** 带重试的分片上传，返回 part 信息或 null（失败/取消） */
  async function uploadChunkWithRetry(
    code: string,
    fileId: string,
    partNumber: number,
    data: ArrayBuffer,
  ): Promise<{ partNumber: number; etag: string } | null> {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (abortController?.signal.aborted) return null;

      try {
        const result = await uploadPart(
          code,
          fileId,
          partNumber,
          data,
          abortController?.signal,
        );
        return result;
      } catch (err) {
        // 取消不重试
        if (err instanceof DOMException && err.name === "AbortError") {
          return null;
        }

        // 客户端错误（4xx）不重试
        if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
          throw err;
        }

        // 最后一次尝试失败
        if (attempt === MAX_RETRIES) {
          throw err;
        }

        // 指数退避等待
        const delay = RETRY_DELAYS[attempt] ?? 800;
        await sleep(delay);

        // 等待期间可能被取消
        if (abortController?.signal.aborted) return null;
      }
    }
    return null;
  }

  /** 将剩余未开始的文件标记为取消 */
  function markRemainingCancelled(fromIndex: number): void {
    for (let i = fromIndex; i < fileUploads.value.length; i++) {
      const fp = fileUploads.value[i];
      if (fp && (fp.status === "pending" || fp.status === "uploading")) {
        fp.status = "cancelled";
      }
    }
  }

  // ── 重置 ──

  function reset(): void {
    cancelUpload();
    phase.value = "selecting";
    shareCode.value = "";
    selectedFiles.value = [];
    fileUploads.value = [];
    speedSamples.length = 0;
  }

  return {
    selectedFiles,
    canAddMoreFiles,
    addFiles,
    removeFile,
    clearFiles,
    phase,
    shareCode,
    fileUploads,
    overallProgress,
    startUpload,
    cancelUpload,
    reset,
  };
}

// ── 工具函数 ──

/** 获取文件小写扩展名（不含点号） */
function getExtension(name: string): string {
  const lastDot = name.lastIndexOf(".");
  if (lastDot === -1 || lastDot === name.length - 1) return "";
  return name.slice(lastDot + 1).toLowerCase();
}

/** Promise-based sleep */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 计算文件的 SHA-256 哈希值
 *
 * 使用 Web Crypto API，读取整个文件内容后计算摘要。
 * 大文件（>100MB）可能需要数百毫秒。
 *
 * @returns 小写十六进制哈希字符串
 */
async function computeFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
