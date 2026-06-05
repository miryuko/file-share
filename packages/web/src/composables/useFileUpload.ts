import { ref, type Ref } from "vue";
import { createSession, uploadPart, completeUpload, ApiError } from "../lib/api";

/** 上传状态 */
export type UploadStatus =
  | "idle"
  | "uploading"
  | "completed"
  | "error";

/** 单个文件的上传进度 */
interface FileProgress {
  file: File;
  fileId: string;
  progress: number; // 0-100
  status: UploadStatus;
  error?: string;
}

/** 文件上传 composable */
export function useFileUpload(): {
  shareCode: Ref<string>;
  files: Ref<FileProgress[]>;
  isUploading: Ref<boolean>;
  uploadFiles: (selectedFiles: File[]) => Promise<string>;
  reset: () => void;
} {
  const shareCode = ref("");
  const files = ref<FileProgress[]>([]);
  const isUploading = ref(false);

  /** 分片大小：5MB */
  const CHUNK_SIZE = 5 * 1024 * 1024;

  async function uploadFiles(selectedFiles: File[]): Promise<string> {
    isUploading.value = true;
    files.value = selectedFiles.map((f) => ({
      file: f,
      fileId: "",
      progress: 0,
      status: "idle" as UploadStatus,
    }));

    try {
      // 1. 创建会话
      const session = await createSession(
        selectedFiles.map((f) => ({
          filename: f.name,
          size: f.size,
          contentType: f.type || undefined,
        })),
      );

      shareCode.value = session.code;

      // 2. 上传每个文件
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const fileInfo = session.files[i];
        const fileProgress = files.value[i];
        if (!fileInfo || !fileProgress || !file) continue;

        fileProgress.fileId = fileInfo.fileId;
        fileProgress.status = "uploading";

        await uploadFileChunked(
          session.code,
          fileInfo.fileId,
          file,
          fileProgress,
        );
      }

      return session.code;
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "上传失败，请检查网络后重试";
      files.value.forEach((f) => {
        if (f.status !== "completed") {
          f.status = "error";
          f.error = message;
        }
      });
      throw err;
    } finally {
      isUploading.value = false;
    }
  }

  async function uploadFileChunked(
    code: string,
    fileId: string,
    file: File,
    progress: FileProgress,
  ): Promise<void> {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const parts: { partNumber: number; etag: string }[] = [];

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);
      const data = await chunk.arrayBuffer();

      const result = await uploadPart(code, fileId, i + 1, data);
      parts.push(result);

      progress.progress = Math.round(((i + 1) / totalChunks) * 100);
    }

    // 完成上传
    await completeUpload(code, fileId, parts);
    progress.status = "completed";
    progress.progress = 100;
  }

  function reset(): void {
    shareCode.value = "";
    files.value = [];
    isUploading.value = false;
  }

  return {
    shareCode,
    files,
    isUploading,
    uploadFiles,
    reset,
  };
}
