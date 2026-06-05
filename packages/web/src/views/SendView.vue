<script setup lang="ts">
import { ref } from "vue";
import { useFileUpload } from "../composables/useFileUpload";
import { ApiError } from "../lib/api";

const { shareCode, files, isUploading, uploadFiles, reset } = useFileUpload();

const fileInput = ref<HTMLInputElement | null>(null);
const dragOver = ref(false);
const errorMessage = ref("");
const copied = ref(false);

const MAX_TOTAL_SIZE = 500 * 1024 * 1024; // 500MB
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_FILES = 20;

function validateFiles(selectedFiles: File[]): string | null {
  if (selectedFiles.length === 0) return "请选择至少一个文件";
  if (selectedFiles.length > MAX_FILES) return `最多选择 ${MAX_FILES} 个文件`;

  for (const f of selectedFiles) {
    if (f.size <= 0) return `文件 "${f.name}" 大小为 0`;
    if (f.size > MAX_FILE_SIZE) {
      const limitMB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(0);
      return `文件 "${f.name}" 超过 ${limitMB}MB 限制`;
    }
  }

  const total = selectedFiles.reduce((s, f) => s + f.size, 0);
  if (total > MAX_TOTAL_SIZE) {
    const limitMB = (MAX_TOTAL_SIZE / (1024 * 1024)).toFixed(0);
    return `总文件大小超过 ${limitMB}MB 限制`;
  }

  return null;
}

async function handleFiles(selectedFiles: FileList | File[]): Promise<void> {
  errorMessage.value = "";

  const fileArray = Array.from(
    "length" in selectedFiles ? selectedFiles : selectedFiles,
  );

  const validationError = validateFiles(fileArray);
  if (validationError) {
    errorMessage.value = validationError;
    return;
  }

  try {
    await uploadFiles(fileArray);
  } catch (err) {
    if (err instanceof ApiError) {
      errorMessage.value = err.message;
    } else {
      errorMessage.value = "上传失败，请检查网络后重试";
    }
  }
}

function onFileChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  if (input.files) handleFiles(input.files);
}

function onDrop(event: DragEvent): void {
  dragOver.value = false;
  if (event.dataTransfer?.files) handleFiles(event.dataTransfer.files);
}

async function copyCode(): Promise<void> {
  if (!shareCode.value) return;
  try {
    await navigator.clipboard.writeText(shareCode.value);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch {
    // Fallback: select the text
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
</script>

<template>
  <div class="send-page">
    <h1 class="title">File Share</h1>
    <p class="subtitle">安全、匿名、即时的文件传输</p>

    <!-- 上传区域 -->
    <div v-if="!shareCode" class="upload-section">
      <div
        class="drop-zone"
        :class="{ 'drag-over': dragOver }"
        @dragover.prevent="dragOver = true"
        @dragleave.prevent="dragOver = false"
        @drop.prevent="onDrop"
        @click="fileInput?.click()"
      >
        <div class="drop-zone-content">
          <svg class="upload-icon" viewBox="0 0 24 24" width="48" height="48">
            <path
              fill="currentColor"
              d="M11 16V7.85l-2.6 2.6L7 9l5-5 5 5-1.4 1.45-2.6-2.6V16h-2Zm-4 4q-.825 0-1.413-.588T5 18v-3h2v3h12v-3h2v3q0 .825-.588 1.413T19 20H7Z"
            />
          </svg>
          <p class="drop-text">点击选择文件或拖拽到此处</p>
          <p class="drop-hint">
            支持任意文件，单文件最大 100MB，总大小 500MB
          </p>
        </div>
      </div>
      <input
        ref="fileInput"
        type="file"
        multiple
        class="hidden-input"
        @change="onFileChange"
      />

      <!-- 错误提示 -->
      <div v-if="errorMessage" class="error-message">
        {{ errorMessage }}
      </div>
    </div>

    <!-- 上传进度 -->
    <div v-if="isUploading" class="progress-section">
      <div v-for="f in files" :key="f.fileId || f.file.name" class="file-progress">
        <div class="file-info">
          <span class="file-name">{{ f.file.name }}</span>
          <span class="file-size">{{ formatSize(f.file.size) }}</span>
        </div>
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{ width: f.progress + '%' }"
          ></div>
        </div>
        <span class="progress-text">{{ f.progress }}%</span>
      </div>
    </div>

    <!-- 完成：展示分享码 -->
    <div v-if="shareCode && !isUploading" class="result-section">
      <div class="share-code-box">
        <p class="share-label">分享码</p>
        <p class="share-code">{{ shareCode }}</p>
        <button class="btn btn-copy" @click="copyCode">
          {{ copied ? "已复制 ✓" : "一键复制" }}
        </button>
      </div>

      <div class="file-list">
        <div v-for="f in files" :key="f.fileId || f.file.name" class="file-item">
          <span class="file-item-name">{{ f.file.name }}</span>
          <span class="file-item-size">{{ formatSize(f.file.size) }}</span>
          <span v-if="f.status === 'completed'" class="file-item-status done">✓</span>
          <span v-else-if="f.status === 'error'" class="file-item-status error">✗</span>
        </div>
      </div>

      <button class="btn btn-new" @click="reset">
        发送新文件
      </button>
    </div>
  </div>
</template>

<style scoped>
.send-page {
  max-width: 480px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.title {
  text-align: center;
  font-size: 1.75rem;
  font-weight: 700;
  margin-bottom: 0.25rem;
}

.subtitle {
  text-align: center;
  color: var(--color-text-muted, #666);
  margin-bottom: 2rem;
  font-size: 0.9rem;
}

.drop-zone {
  border: 2px dashed #ccc;
  border-radius: 12px;
  padding: 3rem 2rem;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s, background-color 0.2s;
}

.drop-zone:hover,
.drop-zone.drag-over {
  border-color: #4a90d9;
  background-color: rgba(74, 144, 217, 0.05);
}

.upload-icon {
  color: #999;
  margin-bottom: 1rem;
}

.drop-text {
  font-size: 1.1rem;
  margin-bottom: 0.5rem;
}

.drop-hint {
  font-size: 0.8rem;
  color: #999;
}

.hidden-input {
  display: none;
}

.error-message {
  margin-top: 1rem;
  padding: 0.75rem 1rem;
  background-color: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  color: #dc2626;
  font-size: 0.9rem;
}

.progress-section {
  margin-top: 1rem;
}

.file-progress {
  margin-bottom: 1rem;
  padding: 0.75rem;
  background: #f9fafb;
  border-radius: 8px;
}

.file-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.file-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  color: #999;
  flex-shrink: 0;
  margin-left: 0.5rem;
}

.progress-bar {
  height: 6px;
  background: #e5e7eb;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #4a90d9;
  transition: width 0.3s ease;
  border-radius: 3px;
}

.progress-text {
  font-size: 0.8rem;
  color: #999;
  margin-top: 0.25rem;
  display: inline-block;
}

.result-section {
  text-align: center;
}

.share-code-box {
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 12px;
  padding: 2rem;
  margin-bottom: 1.5rem;
}

.share-label {
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 0.5rem;
}

.share-code {
  font-size: 2.5rem;
  font-weight: 700;
  letter-spacing: 0.3em;
  font-family: monospace;
  margin-bottom: 1rem;
  color: #1e40af;
}

.btn {
  padding: 0.625rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 0.95rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-copy {
  background: #4a90d9;
  color: white;
}

.btn-copy:hover {
  background: #3b7ec0;
}

.btn-new {
  background: #f3f4f6;
  color: #374151;
  margin-top: 1rem;
}

.btn-new:hover {
  background: #e5e7eb;
}

.file-list {
  text-align: left;
  margin-bottom: 1rem;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid #f3f4f6;
}

.file-item-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-item-size {
  color: #999;
  font-size: 0.85rem;
}

.file-item-status {
  font-weight: bold;
}

.file-item-status.done {
  color: #16a34a;
}

.file-item-status.error {
  color: #dc2626;
}
</style>
