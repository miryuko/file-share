<script setup lang="ts">
import { ref } from "vue";

const textContent = ref("");
const shareCode = ref("");
const errorMessage = ref("");
const isLoading = ref(false);
const copied = ref(false);

const MAX_TEXT_SIZE = 1 * 1024 * 1024; // 1MB
const encoder = new TextEncoder();

async function handleSend(): Promise<void> {
  errorMessage.value = "";
  const content = textContent.value.trim();

  if (!content) {
    errorMessage.value = "请输入要分享的文本内容";
    return;
  }

  const bytes = encoder.encode(content);
  if (bytes.byteLength > MAX_TEXT_SIZE) {
    const sizeMB = (bytes.byteLength / (1024 * 1024)).toFixed(1);
    errorMessage.value = `文本过长（${sizeMB}MB），当前限制 1MB，请使用文件传输`;
    return;
  }

  isLoading.value = true;

  try {
    const res = await fetch("/api/text/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });

    if (!res.ok) {
      const body = (await res.json()) as { message: string };
      errorMessage.value = body.message || "发送失败";
      return;
    }

    const { code } = (await res.json()) as { code: string };
    shareCode.value = code;
  } catch {
    errorMessage.value = "网络异常，请检查连接";
  } finally {
    isLoading.value = false;
  }
}

async function copyCode(): Promise<void> {
  if (!shareCode.value) return;
  try {
    await navigator.clipboard.writeText(shareCode.value);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 2000);
  } catch { /* fallback */ }
}

function reset(): void {
  shareCode.value = "";
  textContent.value = "";
  errorMessage.value = "";
}
</script>

<template>
  <div class="text-share">
    <!-- 输入区 -->
    <div v-if="!shareCode" class="input-section">
      <textarea
        v-model="textContent"
        class="text-input"
        placeholder="在此粘贴或输入文本内容（限 1MB）..."
        rows="8"
      ></textarea>
      <div class="actions">
        <span class="char-count">
          {{ encoder.encode(textContent).byteLength.toLocaleString() }} bytes
        </span>
        <button
          class="btn btn-send"
          :disabled="!textContent.trim() || isLoading"
          @click="handleSend"
        >
          {{ isLoading ? "发送中..." : "发送文本" }}
        </button>
      </div>
      <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>
    </div>

    <!-- 结果：展示分享码 -->
    <div v-if="shareCode" class="result-section">
      <div class="share-code-box">
        <p class="share-label">分享码</p>
        <p class="share-code">{{ shareCode }}</p>
        <button class="btn btn-copy" @click="copyCode">
          {{ copied ? "已复制 ✓" : "一键复制" }}
        </button>
      </div>
      <button class="btn btn-new" @click="reset">发送新文本</button>
    </div>
  </div>
</template>

<style scoped>
.text-share {
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

.actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.75rem;
}

.char-count {
  font-size: 0.8rem;
  color: #999;
}

.btn {
  padding: 0.625rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 0.95rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-send {
  background: #4a90d9;
  color: white;
}

.btn-send:hover:not(:disabled) {
  background: #3b7ec0;
}

.error-message {
  margin-top: 1rem;
  padding: 0.75rem 1rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  color: #dc2626;
  font-size: 0.9rem;
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
}

.btn-new:hover {
  background: #e5e7eb;
}
</style>
