<script setup lang="ts">
import { ref } from "vue";
import { getSession, getDownloadUrl, ApiError } from "../lib/api";

interface FileInfo {
  fileId: string;
  filename: string;
  size: number;
  contentType: string;
}

const codeInput = ref("");
const isLoading = ref(false);
const errorMessage = ref("");
const session = ref<{
  code: string;
  files: FileInfo[];
  expiresAt: number;
  remainingDownloads: number;
} | null>(null);

/**
 * 格式化 6 位分享码：自动转大写，过滤非法字符
 */
function onCodeInput(event: Event): void {
  const input = event.target as HTMLInputElement;
  // 只保留合法字符
  input.value = input.value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, "");
  codeInput.value = input.value;
}

async function handleReceive(): Promise<void> {
  const code = codeInput.value.trim().toUpperCase();
  if (code.length !== 6) {
    errorMessage.value = "请输入 6 位分享码";
    return;
  }

  isLoading.value = true;
  errorMessage.value = "";

  try {
    session.value = await getSession(code);
  } catch (err) {
    if (err instanceof ApiError) {
      errorMessage.value = err.message;
    } else {
      errorMessage.value = "查询失败，请检查网络后重试";
    }
    session.value = null;
  } finally {
    isLoading.value = false;
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatExpiry(expiresAt: number): string {
  const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 60000));
  if (remaining < 1) return "即将过期";
  if (remaining < 60) return `${remaining} 分钟后过期`;
  const hours = Math.floor(remaining / 60);
  return `${hours} 小时 ${remaining % 60} 分钟后过期`;
}

function reset(): void {
  session.value = null;
  codeInput.value = "";
  errorMessage.value = "";
}
</script>

<template>
  <div class="receive-page">
    <h1 class="title">接收文件</h1>

    <!-- 输入分享码 -->
    <div v-if="!session" class="input-section">
      <div class="code-input-group">
        <input
          v-model="codeInput"
          type="text"
          class="code-input"
          maxlength="6"
          placeholder="输入 6 位分享码"
          autocomplete="off"
          @input="onCodeInput"
          @keyup.enter="handleReceive"
        />
        <button
          class="btn btn-receive"
          :disabled="codeInput.length !== 6 || isLoading"
          @click="handleReceive"
        >
          {{ isLoading ? "查询中..." : "接收" }}
        </button>
      </div>

      <div v-if="errorMessage" class="error-message">
        {{ errorMessage }}
      </div>
    </div>

    <!-- 文件列表 -->
    <div v-if="session" class="session-info">
      <div class="session-meta">
        <span class="share-code-label">分享码: <strong>{{ session.code }}</strong></span>
        <span class="expiry">{{ formatExpiry(session.expiresAt) }}</span>
        <span class="remaining">剩余下载: {{ session.remainingDownloads }} 次</span>
      </div>

      <div class="file-list">
        <div
          v-for="file in session.files"
          :key="file.fileId"
          class="file-card"
        >
          <div class="file-card-info">
            <span class="file-card-name">{{ file.filename }}</span>
            <span class="file-card-size">{{ formatSize(file.size) }}</span>
          </div>
          <a
            :href="getDownloadUrl(session.code, file.fileId)"
            class="btn btn-download"
            download
          >
            下载
          </a>
        </div>
      </div>

      <button class="btn btn-back" @click="reset">
        接收其他文件
      </button>
    </div>
  </div>
</template>

<style scoped>
.receive-page {
  max-width: 480px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.title {
  text-align: center;
  font-size: 1.75rem;
  font-weight: 700;
  margin-bottom: 2rem;
}

.input-section {
  margin-bottom: 1.5rem;
}

.code-input-group {
  display: flex;
  gap: 0.75rem;
}

.code-input {
  flex: 1;
  padding: 0.75rem 1rem;
  font-size: 1.5rem;
  font-family: monospace;
  letter-spacing: 0.3em;
  text-align: center;
  border: 2px solid #ddd;
  border-radius: 8px;
  outline: none;
  transition: border-color 0.2s;
  text-transform: uppercase;
}

.code-input:focus {
  border-color: #4a90d9;
}

.btn {
  padding: 0.625rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 0.95rem;
  cursor: pointer;
  transition: background-color 0.2s;
  white-space: nowrap;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-receive {
  background: #4a90d9;
  color: white;
}

.btn-receive:hover:not(:disabled) {
  background: #3b7ec0;
}

.btn-download {
  background: #16a34a;
  color: white;
  text-decoration: none;
  font-size: 0.85rem;
  padding: 0.5rem 1rem;
}

.btn-download:hover {
  background: #15803d;
}

.btn-back {
  background: #f3f4f6;
  color: #374151;
  margin-top: 1.5rem;
  width: 100%;
}

.btn-back:hover {
  background: #e5e7eb;
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

.session-info {
  text-align: center;
}

.session-meta {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: #f0f9ff;
  border-radius: 8px;
  font-size: 0.85rem;
  color: #666;
}

.share-code-label strong {
  color: #1e40af;
  font-size: 1.1rem;
}

.file-list {
  text-align: left;
}

.file-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  margin-bottom: 0.5rem;
  transition: border-color 0.2s;
}

.file-card:hover {
  border-color: #4a90d9;
}

.file-card-info {
  flex: 1;
  min-width: 0;
}

.file-card-name {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}

.file-card-size {
  font-size: 0.8rem;
  color: #999;
}
</style>
