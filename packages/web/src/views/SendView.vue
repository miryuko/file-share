<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useI18n } from "vue-i18n";
import { Upload } from "lucide-vue-next";
import { useFileUpload } from "../composables/useFileUpload";
import { useSiteConfig } from "../composables/useSiteConfig";
import { ApiError } from "../lib/api";
import { generateQRCodeDataURI } from "../lib/qrcode";
import P2PTransfer from "../components/P2PTransfer.vue";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Progress } from "../components/ui/progress";
import { Textarea } from "../components/ui/textarea";

const { t } = useI18n();
const { config } = useSiteConfig();

/** 文件限制提示文案（读取后端配置的实际限制值） */
const fileLimitsText = computed(() => {
  const maxFileMB = (config.value.maxFileSize / (1024 * 1024)).toFixed(0);
  const maxTotalMB = (config.value.maxTotalSize / (1024 * 1024)).toFixed(0);
  return t('send.fileLimits', { maxFileSize: maxFileMB, maxTotalSize: maxTotalMB });
});

type ShareMode = "file" | "text";

const mode = ref<ShareMode>("file");

const { shareCode, files, isUploading, uploadFiles, reset } = useFileUpload();

function buildShareUrl(code: string): string {
  return `${window.location.origin}/receive/${code}`;
}

const qrCodeURI = ref("");

const fileInput = ref<HTMLInputElement | null>(null);
const dragOver = ref(false);
const errorMessage = ref("");
const copied = ref(false);

const textContent = ref("");
const textCode = ref("");
const textLoading = ref(false);
const textError = ref("");
const textCopied = ref(false);

// 分享码变化时异步生成 QR 码（编码完整 URL）
watch(
  () => shareCode.value || textCode.value,
  async (code) => {
    if (code) {
      qrCodeURI.value = await generateQRCodeDataURI(buildShareUrl(code));
    } else {
      qrCodeURI.value = "";
    }
  },
);

function validateFiles(selectedFiles: File[]): string | null {
  const maxFiles = config.value.maxFiles;
  const maxFileSize = config.value.maxFileSize;
  const maxTotalSize = config.value.maxTotalSize;

  if (selectedFiles.length === 0) return t('send.validation.selectFile');
  if (selectedFiles.length > maxFiles) return t('send.validation.maxFiles', { max: maxFiles });

  for (const f of selectedFiles) {
    if (f.size <= 0) return t('send.validation.zeroSize', { name: f.name });
    if (f.size > maxFileSize) {
      const limitMB = (maxFileSize / (1024 * 1024)).toFixed(0);
      return t('send.validation.fileTooBig', { name: f.name, limit: limitMB });
    }
  }

  const total = selectedFiles.reduce((s, f) => s + f.size, 0);
  if (total > maxTotalSize) {
    const limitMB = (maxTotalSize / (1024 * 1024)).toFixed(0);
    return t('send.validation.totalTooBig', { limit: limitMB });
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
      errorMessage.value = t('send.uploadError');
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
    await navigator.clipboard.writeText(buildShareUrl(shareCode.value));
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 2000);
  } catch { /* fallback */ }
}

async function handleTextSend(): Promise<void> {
  textError.value = "";
  const content = textContent.value.trim();

  if (!content) {
    textError.value = t('send.validation.textEmpty');
    return;
  }

  const maxTextSize = config.value.maxTextSize;
  const charCount = [...content].length;
  if (maxTextSize !== -1 && charCount > maxTextSize) {
    textError.value = t('send.validation.textTooLong', { count: charCount, limit: maxTextSize });
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
      textError.value = body.message || t('send.sendFailed');
      return;
    }

    const { code } = (await res.json()) as { code: string };
    textCode.value = code;
  } catch {
    textError.value = t('send.networkError');
  } finally {
    textLoading.value = false;
  }
}

async function copyTextCode(): Promise<void> {
  if (!textCode.value) return;
  try {
    await navigator.clipboard.writeText(buildShareUrl(textCode.value));
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
    <h1 class="mb-1 text-center text-2xl font-bold">{{ $t('send.title') }}</h1>
    <p class="mb-6 text-center text-sm text-muted-foreground">{{ $t('send.subtitle') }}</p>

    <!-- 模式切换 -->
    <Tabs v-if="!shareCode && !textCode" v-model="mode" class="mb-6">
      <TabsList class="grid w-full grid-cols-2">
        <TabsTrigger value="file">{{ $t('send.tabFile') }}</TabsTrigger>
        <TabsTrigger value="text">{{ $t('send.tabText') }}</TabsTrigger>
      </TabsList>
      <TabsContent value="file" class="mt-4">
        <!-- 文件上传区域 -->
        <div
          class="cursor-pointer rounded-xl border-2 border-dashed border-border px-8 py-12 text-center transition-colors hover:border-primary hover:bg-accent/50"
          :class="{ 'border-primary bg-accent/50': dragOver }"
          @dragover.prevent="dragOver = true"
          @dragleave.prevent="dragOver = false"
          @drop.prevent="onDrop"
          @click="fileInput?.click()"
        >
          <Upload class="mx-auto mb-4 text-muted-foreground" :size="48" />
          <p class="mb-2 text-lg">{{ $t('send.dropZone') }}</p>
          <p class="text-xs text-muted-foreground">{{ fileLimitsText }}</p>
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
          :placeholder="$t('send.textPlaceholder')"
          :rows="8"
          class="resize-y"
        />
        <div class="flex items-center justify-between">
          <span class="text-xs text-muted-foreground">
            {{ [...textContent].length.toLocaleString() }} chars
          </span>
          <Button :disabled="!textContent.trim() || textLoading" @click="handleTextSend">
            {{ textLoading ? $t('send.sending') : $t('send.sendText') }}
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
      <div v-for="f in files" :key="f.fileId || f.file.name" class="rounded-lg bg-muted p-3">
        <div class="mb-2 flex justify-between text-sm">
          <span class="truncate">{{ f.file.name }}</span>
          <span class="ml-2 flex-shrink-0 text-muted-foreground">{{ formatSize(f.file.size) }}</span>
        </div>
        <Progress :model-value="f.progress" class="h-1.5" />
        <span class="mt-1 inline-block text-xs text-muted-foreground">{{ f.progress }}%</span>
      </div>
    </div>

    <!-- 文本分享结果 -->
    <div v-if="textCode" class="text-center">
      <Card class="mb-6 bg-muted">
        <CardContent class="p-8 text-center">
          <p class="mb-2 text-sm text-muted-foreground">{{ $t('send.textCodeLabel') }}</p>
          <p class="mb-4 font-mono text-4xl font-bold tracking-[0.3em] text-blue-800">{{ textCode }}</p>
          <img
            v-if="qrCodeURI"
            :src="qrCodeURI"
            :alt="$t('send.qrAlt')"
            class="mx-auto mb-4 rounded-lg border"
            width="160"
            height="160"
          />
          <Button @click="copyTextCode">
            {{ textCopied ? $t('send.copied') : $t('send.copy') }}
          </Button>
        </CardContent>
      </Card>
      <Button variant="secondary" class="mt-4" @click="resetAll">{{ $t('send.sendNewContent') }}</Button>
    </div>

    <!-- 文件上传完成 -->
    <div v-if="shareCode && !isUploading" class="text-center">
      <Card class="mb-6 bg-muted">
        <CardContent class="p-8 text-center">
          <p class="mb-2 text-sm text-muted-foreground">{{ $t('send.shareCodeLabel') }}</p>
          <p class="mb-4 font-mono text-4xl font-bold tracking-[0.3em] text-blue-800">{{ shareCode }}</p>
          <img
            v-if="qrCodeURI"
            :src="qrCodeURI"
            :alt="$t('send.qrAlt')"
            class="mx-auto mb-4 rounded-lg border"
            width="160"
            height="160"
          />
          <Button @click="copyCode">
            {{ copied ? $t('send.copied') : $t('send.copy') }}
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
          class="flex items-center gap-2 border-b border-border py-2"
        >
          <span class="flex-1 truncate">{{ f.file.name }}</span>
          <span class="text-sm text-muted-foreground">{{ formatSize(f.file.size) }}</span>
          <span v-if="f.status === 'completed'" class="font-bold text-green-600">✓</span>
          <span v-else-if="f.status === 'error'" class="font-bold text-red-600">✗</span>
        </div>
      </div>

      <Button variant="secondary" class="mt-4" @click="resetAll">{{ $t('send.sendNewFile') }}</Button>
    </div>
  </div>
</template>
