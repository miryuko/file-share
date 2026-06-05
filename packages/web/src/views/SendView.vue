<script setup lang="ts">
import { ref, computed } from "vue";
import { useFileUpload } from "../composables/useFileUpload";
import { ApiError } from "../lib/api";
import { generateQRCodeDataURI } from "../lib/qrcode";
import P2PTransfer from "../components/P2PTransfer.vue";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Progress } from "../components/ui/progress";
import { Textarea } from "../components/ui/textarea";

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
const copied = ref(false);

const textContent = ref("");
const textCode = ref("");
const textLoading = ref(false);
const textError = ref("");
const textCopied = ref(false);
const MAX_TEXT_SIZE = 1 * 1024 * 1024;
const encoder = new TextEncoder();

const MAX_TOTAL_SIZE = 500 * 1024 * 1024;
const MAX_FILE_SIZE = 100 * 1024 * 1024;
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
    setTimeout(() => { copied.value = false; }, 2000);
  } catch { /* fallback */ }
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
  <div class="mx-auto max-w-[480px] px-4 py-8">
    <h1 class="mb-1 text-center text-2xl font-bold">File Share</h1>
    <p class="mb-6 text-center text-sm text-gray-500">安全、匿名、即时的文件传输</p>

    <!-- 模式切换 -->
    <Tabs v-if="!shareCode && !textCode" v-model="mode" class="mb-6">
      <TabsList class="grid w-full grid-cols-2">
        <TabsTrigger value="file">文件</TabsTrigger>
        <TabsTrigger value="text">文本</TabsTrigger>
      </TabsList>
      <TabsContent value="file" class="mt-4">
        <!-- 文件上传区域 -->
        <div
          class="cursor-pointer rounded-xl border-2 border-dashed border-gray-300 px-8 py-12 text-center transition-colors hover:border-blue-500 hover:bg-blue-50/50"
          :class="{ 'border-blue-500 bg-blue-50/50': dragOver }"
          @dragover.prevent="dragOver = true"
          @dragleave.prevent="dragOver = false"
          @drop.prevent="onDrop"
          @click="fileInput?.click()"
        >
          <svg class="mx-auto mb-4 text-gray-400" viewBox="0 0 24 24" width="48" height="48">
            <path
              fill="currentColor"
              d="M11 16V7.85l-2.6 2.6L7 9l5-5 5 5-1.4 1.45-2.6-2.6V16h-2Zm-4 4q-.825 0-1.413-.588T5 18v-3h2v3h12v-3h2v3q0 .825-.588 1.413T19 20H7Z"
            />
          </svg>
          <p class="mb-2 text-lg">点击选择文件或拖拽到此处</p>
          <p class="text-xs text-gray-400">支持任意文件，单文件最大 100MB，总大小 500MB</p>
        </div>
        <input ref="fileInput" type="file" multiple class="hidden" @change="onFileChange" />
        <div
          v-if="errorMessage"
          class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
        >
          {{ errorMessage }}
        </div>
      </TabsContent>
      <TabsContent value="text" class="mt-4 space-y-3">
        <Textarea
          v-model="textContent"
          placeholder="在此粘贴或输入文本内容（限 1MB）..."
          :rows="8"
          class="resize-y"
        />
        <div class="flex items-center justify-between">
          <span class="text-xs text-gray-400">
            {{ encoder.encode(textContent).byteLength.toLocaleString() }} bytes
          </span>
          <Button :disabled="!textContent.trim() || textLoading" @click="handleTextSend">
            {{ textLoading ? "发送中..." : "发送文本" }}
          </Button>
        </div>
        <div
          v-if="textError"
          class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
        >
          {{ textError }}
        </div>
      </TabsContent>
    </Tabs>

    <!-- 上传进度 -->
    <div v-if="isUploading" class="mt-4 space-y-4">
      <div v-for="f in files" :key="f.fileId || f.file.name" class="rounded-lg bg-gray-50 p-3">
        <div class="mb-2 flex justify-between text-sm">
          <span class="truncate">{{ f.file.name }}</span>
          <span class="ml-2 flex-shrink-0 text-gray-400">{{ formatSize(f.file.size) }}</span>
        </div>
        <Progress :model-value="f.progress" class="h-1.5" />
        <span class="mt-1 inline-block text-xs text-gray-400">{{ f.progress }}%</span>
      </div>
    </div>

    <!-- 文本分享结果 -->
    <div v-if="textCode" class="text-center">
      <Card class="mb-6 bg-sky-50">
        <CardContent class="p-8 text-center">
          <p class="mb-2 text-sm text-gray-500">文本分享码</p>
          <p class="mb-4 font-mono text-4xl font-bold tracking-[0.3em] text-blue-800">{{ textCode }}</p>
          <img
            v-if="qrCodeURI"
            :src="qrCodeURI"
            alt="QR Code"
            class="mx-auto mb-4 rounded-lg border"
            width="160"
            height="160"
          />
          <Button @click="copyTextCode">
            {{ textCopied ? "已复制 ✓" : "一键复制" }}
          </Button>
        </CardContent>
      </Card>
      <Button variant="secondary" class="mt-4" @click="resetAll">发送新内容</Button>
    </div>

    <!-- 文件上传完成 -->
    <div v-if="shareCode && !isUploading" class="text-center">
      <Card class="mb-6 bg-sky-50">
        <CardContent class="p-8 text-center">
          <p class="mb-2 text-sm text-gray-500">分享码</p>
          <p class="mb-4 font-mono text-4xl font-bold tracking-[0.3em] text-blue-800">{{ shareCode }}</p>
          <img
            v-if="qrCodeURI"
            :src="qrCodeURI"
            alt="QR Code"
            class="mx-auto mb-4 rounded-lg border"
            width="160"
            height="160"
          />
          <Button @click="copyCode">
            {{ copied ? "已复制 ✓" : "一键复制" }}
          </Button>
        </CardContent>
      </Card>

      <P2PTransfer
        v-if="shareCode"
        :code="shareCode"
        role="sender"
        @fallback="console.log('P2P fallback, using R2 upload')"
      />

      <div class="mb-4 text-left">
        <div
          v-for="f in files"
          :key="f.fileId || f.file.name"
          class="flex items-center gap-2 border-b border-gray-100 py-2"
        >
          <span class="flex-1 truncate">{{ f.file.name }}</span>
          <span class="text-sm text-gray-400">{{ formatSize(f.file.size) }}</span>
          <span v-if="f.status === 'completed'" class="font-bold text-green-600">✓</span>
          <span v-else-if="f.status === 'error'" class="font-bold text-red-600">✗</span>
        </div>
      </div>

      <Button variant="secondary" class="mt-4" @click="resetAll">发送新文件</Button>
    </div>
  </div>
</template>
