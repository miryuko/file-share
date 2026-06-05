<script setup lang="ts">
import { ref, computed } from "vue";
import { useFileUpload } from "../composables/useFileUpload";
import { ApiError } from "../lib/api";
import { generateQRCodeDataURI } from "../lib/qrcode";

type ShareMode = "file" | "text";

const qrCodeURI = computed(() => {
  const code = shareCode.value || textCode.value;
  return code ? generateQRCodeDataURI(code) : "";
});

const mode = ref<ShareMode>("file");

const { shareCode, files, isUploading, uploadFiles, reset } = useFileUpload();

const fileInput = ref<HTMLInputElement | null>(null);
const dragOver = ref(false);
const errorMessage = ref("");

// Text sharing state
const textContent = ref("");
const textCode = ref("");
const textLoading = ref(false);
const textError = ref("");
const textCopied = ref(false);
const MAX_TEXT_SIZE = 1 * 1024 * 1024;
const encoder = new TextEncoder();
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

async function handleTextSend(): Promise<void> {
  textError.value = "";
  const content = textContent.value.trim();

  if (!content) {
    textError.value = "请输入要分享的文本内容";
    return;
  }

  const bytes = encoder.encode(content);
  if (bytes.byteLength > MAX_TEXT_SIZE) {
    const sizeMB = (bytes.byteLength / (1024 * 1024)).toFixed(1);
    textError.value = `文本过长（${sizeMB}MB），当前限制 1MB，请使用文件传输`;
    return;
  }

  textLoading.value = true;
  try {
    const res = await fetch("/api/text/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });

    if (!res.ok) {
      const body = (await res.json()) as { message: string };
      textError.value = body.message || "发送失败";
      return;
    }

    const { code } = (await res.json()) as { code: string };
    textCode.value = code;
  } catch {
    textError.value = "网络异常，请检查连接";
  } finally {
    textLoading.value = false;
  }
}

async function copyTextCode(): Promise<void> {
  if (!textCode.value) return;
  try {
    await navigator.clipboard.writeText(textCode.value);
    textCopied.value = true;
    setTimeout(() => { textCopied.value = false; }, 2000);
  } catch { /* fallback */ }
}

function resetAll(): void {
  reset();
  textCode.value = "";
  textContent.value = "";
  textError.value = "";
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

    <!-- 模式切换 tab -->
    <div v-if="!shareCode && !textCode" class="mode-tabs">
      <button
        class="tab-btn"
        :class="{ active: mode === 'file' }"
        @click="mode = 'file'"
      >
        文件
      </button>
      <button
        class="tab-btn"
        :class="{ active: mode === 'text' }"
        @click="mode = 'text'"
      >
        文本
      </button>
    </div>

    <!-- ===== 文件分享模式 ===== -->
    <div v-if="mode === 'file' && !shareCode" class="upload-section">
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

    <!-- ===== 文本分享模式 ===== -->
    <div v-if="mode === 'text' && !textCode" class="text-section">
      <textarea
        v-model="textContent"
        class="text-input"
        placeholder="在此粘贴或输入文本内容（限 1MB）..."
        rows="8"
      ></textarea>
      <div class="text-actions">
        <span class="char-count">
          {{ encoder.encode(textContent).byteLength.toLocaleString() }} bytes
        </span>
        <button
          class="btn btn-send-text"
          :disabled="!textContent.trim() || textLoading"
          @click="handleTextSend"
        >
          {{ textLoading ? "发送中..." : "发送文本" }}
        </button>
      </div>
      <div v-if="textError" class="error-message">{{ textError }}</div>
    </div>

    <!-- 文本分享结果 -->
    <div v-if="textCode" class="result-section">
      <div class="share-code-box">
        <p class="share-label">文本分享码</p>
        <p class="share-code">{{ textCode }}</p>
        <img v-if="qrCodeURI" :src="qrCodeURI" alt="QR Code" class="qr-code" width="160" height="160" />
        <button class="btn btn-copy" @click="copyTextCode">
          {{ textCopied ? "已复制 ✓" : "一键复制" }}
        </button>
      </div>
      <button class="btn btn-new" @click="resetAll">发送新内容</button>
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
        <img v-if="qrCodeURI" :src="qrCodeURI" alt="QR Code" class="qr-code" width="160" height="160" />
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

      <button class="btn btn-new" @click="resetAll">
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
  margin-bottom: 1.5rem;
  font-size: 0.9rem;
}

.mode-tabs {
  display: flex;
  justify-content: center;
  gap: 0;
  margin-bottom: 1.5rem;
  border-bottom: 2px solid #e5e7eb;
}

.tab-btn {
  padding: 0.5rem 2rem;
  border: none;
  background: none;
  font-size: 0.95rem;
  cursor: pointer;
  color: #6b7280;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  transition: color 0.2s, border-color 0.2s;
}

.tab-btn.active {
  color: #4a90d9;
  border-bottom-color: #4a90d9;
}

.text-section {
  max-width: 480px;
  margin: 0 auto;
}

.text-input {
  width: 100%;
  padding: 1rem;
  border: 2px solid #ddd;
  border-radius: 8px;
  font-size: 0.95rem;
  font-family: inherit;
  resize: vertical;
  outline: none;
  transition: border-color 0.2s;
}

.text-input:focus {
  border-color: #4a90d9;
}

.text-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.75rem;
}

.char-count {
  font-size: 0.8rem;
  color: #999;
}

.btn-send-text {
  background: #4a90d9;
  color: white;
  padding: 0.625rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 0.95rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-send-text:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-send-text:hover:not(:disabled) {
  background: #3b7ec0;
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

.qr-code {
  display: block;
  margin: 1rem auto;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
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
