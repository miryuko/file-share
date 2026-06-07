<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useI18n } from "vue-i18n";
import { Upload, WifiOff, ChevronDown, ChevronRight } from "lucide-vue-next";
import { useFileUploadManager } from "../composables/useFileUploadManager";
import { useConnectionStatus } from "../composables/useConnectionStatus";
import { useSiteConfig } from "../composables/useSiteConfig";
import { ApiError } from "../lib/api";
import { generateQRCodeDataURI } from "../lib/qrcode";
import { formatFileSize } from "../lib/utils";
import P2PTransfer from "../components/P2PTransfer.vue";
import FileListPreview from "../components/FileListPreview.vue";
import FileUploadProgress from "../components/FileUploadProgress.vue";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";

const { t } = useI18n();
const { config } = useSiteConfig();

/** 文件限制提示文案（读取后端配置的实际限制值） */
const fileLimitsText = computed(() => {
  const maxFileSize = config.value.maxFileSize;
  const maxTotalSize = config.value.maxTotalSize;
  const maxFileMB = maxFileSize === -1
    ? t("send.uploadOptions.unlimited")
    : (maxFileSize / (1024 * 1024)).toFixed(0);
  const maxTotalMB = maxTotalSize === -1
    ? t("send.uploadOptions.unlimited")
    : (maxTotalSize / (1024 * 1024)).toFixed(0);
  return t("send.fileLimits", { maxFileSize: maxFileMB, maxTotalSize: maxTotalMB });
});

type ShareMode = "file" | "text";

const mode = ref<ShareMode>("file");

// ── 连接状态 ──
const { isOnline } = useConnectionStatus();

// ── 文件上传管理器 ──
const {
  selectedFiles,
  canAddMoreFiles,
  addFiles,
  removeFile,
  phase,
  shareCode,
  fileUploads,
  overallProgress,
  startUpload,
  cancelUpload,
  reset: resetUpload,
} = useFileUploadManager();

// ── 上传选项 ──
/** 是否展开上传选项面板 */
const showUploadOptions = ref(false);

/** TTL 预设值（秒） */
const TTL_PRESETS = [
  { label: "10 分钟", value: 600 },
  { label: "30 分钟", value: 1800 },
  { label: "1 小时", value: 3600 },
  { label: "6 小时", value: 21600 },
  { label: "24 小时", value: 86400 },
  { label: "7 天", value: 604800 },
  { label: "30 天", value: 2592000 },
];

/** 下载次数预设 */
const DOWNLOAD_PRESETS = [1, 3, 5, 10, 20, 50, 100];

/** 可选的 TTL 选项（不超过站点配置上限） */
const ttlOptions = computed(() => {
  const max = config.value.ttlSeconds;
  const options = TTL_PRESETS.filter((p) => max === -1 || p.value <= max);
  if (max === -1) {
    options.push({ label: t("send.uploadOptions.forever"), value: -1 });
  }
  return options;
});

/** 可选的下载次数（不超过站点配置上限） */
const downloadOptions = computed(() => {
  const max = config.value.maxDownloads;
  const options = DOWNLOAD_PRESETS.filter((n) => max === -1 || n <= max);
  if (max === -1) {
    options.push(-1); // "无限制"
  }
  return options;
});

/** 用户选择的过期时间（秒），undefined 表示使用站点默认值 */
const selectedTTL = ref<number | undefined>(undefined);
/** 用户选择的最大下载次数，undefined 表示使用站点默认值 */
const selectedDownloads = ref<number | undefined>(undefined);

/** TTL 上限提示文案 */
const ttlLimitHint = computed(() => {
  const max = config.value.ttlSeconds;
  if (max === -1) return t("send.uploadOptions.expirationLimitUnlimited");
  return t("send.uploadOptions.expirationLimitOff", {
    limit: formatDuration(max),
  });
});

/** 下载次数上限提示文案 */
const downloadsLimitHint = computed(() => {
  const max = config.value.maxDownloads;
  if (max === -1) return t("send.uploadOptions.downloadsLimitUnlimited");
  return t("send.uploadOptions.downloadsLimitOff", { max });
});

/** 格式化秒数为可读字符串 */
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} 秒`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} 分钟`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} 小时`;
  return `${Math.round(seconds / 86400)} 天`;
}

/** 格式化 TTL 选项标签 */
function ttlOptionLabel(value: number): string {
  if (value === -1) return t("send.uploadOptions.forever");
  return formatDuration(value);
}

/** 格式化下载选项标签 */
function downloadOptionLabel(value: number): string {
  if (value === -1) return t("send.uploadOptions.unlimited");
  return `${value} 次`;
}

/** 处理 TTL 选择变更 */
function onTTLChange(value: unknown): void {
  selectedTTL.value = String(value) === "__default__" ? undefined : Number(value);
}

/** 处理下载次数选择变更 */
function onDownloadsChange(value: unknown): void {
  selectedDownloads.value = String(value) === "__default__" ? undefined : Number(value);
}

function buildShareUrl(code: string): string {
  return `${window.location.origin}/receive/${code}`;
}

const qrCodeURI = ref("");

const fileInput = ref<HTMLInputElement | null>(null);
const dragOver = ref(false);
const uploadError = ref("");
const copied = ref(false);
/** 添加文件时的警告信息（如部分文件被拒绝） */
const addWarnings = ref<string[]>([]);

const textContent = ref("");
const textCode = ref("");
const textLoading = ref(false);
const textError = ref("");
const textCopied = ref(false);

/** 是否显示文件审核阶段 */
const showFileReview = computed(
  () => phase.value === "selecting" && selectedFiles.value.length > 0,
);

/** 是否显示上传进度 */
const showUploadProgress = computed(() => phase.value === "uploading");

/** 是否显示上传结果 */
const showUploadResult = computed(
  () =>
    (phase.value === "completed" || phase.value === "error" || phase.value === "cancelled") &&
    shareCode.value !== "",
);

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

// ── 文件处理 ──

async function handleFiles(selectedFiles: FileList | File[]): Promise<void> {
  uploadError.value = "";
  addWarnings.value = [];

  const fileArray = Array.from(
    "length" in selectedFiles ? selectedFiles : selectedFiles,
  );

  const result = await addFiles(fileArray);
  if (result.errors.length > 0) {
    addWarnings.value = result.errors;
  }
}

function onFileChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  if (input.files) {
    handleFiles(input.files);
    // 重置 input 以便可以重新选择相同文件
    input.value = "";
  }
}

function onDrop(event: DragEvent): void {
  dragOver.value = false;
  if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
    handleFiles(event.dataTransfer.files);
  }
}

function triggerFileInput(): void {
  fileInput.value?.click();
}

// ── 剪贴板粘贴 ──

function onPaste(event: ClipboardEvent): void {
  const items = event.clipboardData?.items;
  if (!items) return;

  const files: File[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item?.kind === "file") {
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  }

  if (files.length > 0) {
    event.preventDefault();
    handleFiles(files);
  }
}

// ── 上传操作 ──

async function sendFiles(): Promise<void> {
  uploadError.value = "";
  try {
    await startUpload({
      ttlSeconds: selectedTTL.value,
      maxDownloads: selectedDownloads.value,
    });
  } catch (err) {
    if (err instanceof ApiError) {
      uploadError.value = err.message;
    } else if (err instanceof Error && err.message !== "没有可上传的文件") {
      uploadError.value = t("send.uploadError");
    }
  }
}

function handleCancel(): void {
  cancelUpload();
}

// ── 分享码操作 ──

async function copyCode(): Promise<void> {
  if (!shareCode.value) return;
  try {
    await navigator.clipboard.writeText(buildShareUrl(shareCode.value));
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch {
    /* fallback */
  }
}

// ── 文本分享 ──

async function handleTextSend(): Promise<void> {
  textError.value = "";
  const content = textContent.value.trim();

  if (!content) {
    textError.value = t("send.validation.textEmpty");
    return;
  }

  const maxTextSize = config.value.maxTextSize;
  const charCount = [...content].length;
  if (maxTextSize !== -1 && charCount > maxTextSize) {
    textError.value = t("send.validation.textTooLong", {
      count: charCount,
      limit: maxTextSize,
    });
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
      textError.value = body.message || t("send.sendFailed");
      return;
    }

    const { code } = (await res.json()) as { code: string };
    textCode.value = code;
  } catch {
    textError.value = t("send.networkError");
  } finally {
    textLoading.value = false;
  }
}

async function copyTextCode(): Promise<void> {
  if (!textCode.value) return;
  try {
    await navigator.clipboard.writeText(buildShareUrl(textCode.value));
    textCopied.value = true;
    setTimeout(() => {
      textCopied.value = false;
    }, 2000);
  } catch {
    /* fallback */
  }
}

function resetAll(): void {
  resetUpload();
  textCode.value = "";
  textContent.value = "";
  textError.value = "";
  uploadError.value = "";
  addWarnings.value = [];
  selectedTTL.value = undefined;
  selectedDownloads.value = undefined;
  showUploadOptions.value = false;
}

</script>

<template>
  <div
    class="mx-auto max-w-[480px] px-4 py-8"
    @paste="onPaste"
  >
    <h1 class="mb-1 text-center text-2xl font-bold">{{ $t("send.title") }}</h1>
    <p class="mb-6 text-center text-sm text-muted-foreground">
      {{ $t("send.subtitle") }}
    </p>

    <!-- 连接状态横幅 -->
    <div
      v-if="!isOnline"
      class="mb-4 flex items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700"
    >
      <WifiOff :size="16" />
      {{ $t("send.connectionOffline") }}
    </div>

    <!-- 模式切换 -->
    <Tabs
      v-if="!showUploadResult && !textCode"
      v-model="mode"
      class="mb-6"
    >
      <TabsList class="grid w-full grid-cols-2">
        <TabsTrigger value="file">{{ $t("send.tabFile") }}</TabsTrigger>
        <TabsTrigger value="text">{{ $t("send.tabText") }}</TabsTrigger>
      </TabsList>

      <!-- 文件 Tab -->
      <TabsContent value="file" class="mt-4">
        <!-- 隐藏的文件选择 input，始终在 DOM 中 -->
        <input
          ref="fileInput"
          type="file"
          multiple
          class="hidden"
          @change="onFileChange"
        />

        <!-- 阶段 1：文件选择 -->
        <template v-if="!showUploadProgress && !showUploadResult">
          <!-- 审核阶段：显示文件列表 -->
          <div v-if="showFileReview" class="space-y-4">
            <FileListPreview
              :files="selectedFiles"
              :can-add-more="canAddMoreFiles"
              :max-files="config.maxFiles"
              :max-total-size="config.maxTotalSize"
              @remove="removeFile"
              @add-more="triggerFileInput"
            />

            <!-- 添加文件时的警告 -->
            <div
              v-for="(warn, idx) in addWarnings"
              :key="idx"
              class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700"
            >
              {{ warn }}
            </div>

            <!-- 上传错误 -->
            <div
              v-if="uploadError"
              class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
            >
              {{ uploadError }}
            </div>

            <!-- 上传选项（可折叠） -->
            <div class="rounded-lg border border-border">
              <button
                class="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-accent/50"
                @click="showUploadOptions = !showUploadOptions"
              >
                <span>{{ $t("send.uploadOptions.title") }}</span>
                <ChevronRight
                  v-if="!showUploadOptions"
                  :size="16"
                  class="text-muted-foreground"
                />
                <ChevronDown
                  v-else
                  :size="16"
                  class="text-muted-foreground"
                />
              </button>

              <div v-if="showUploadOptions" class="space-y-4 border-t border-border px-4 py-4">
                <!-- 过期时间 -->
                <div class="space-y-2">
                  <label class="text-sm font-medium">
                    {{ $t("send.uploadOptions.expiration") }}
                  </label>
                  <p class="text-xs text-muted-foreground">
                    {{ $t("send.uploadOptions.expirationHint") }}
                  </p>
                  <Select
                    :model-value="selectedTTL !== undefined ? String(selectedTTL) : '__default__'"
                    @update:model-value="onTTLChange"
                  >
                    <SelectTrigger class="w-full">
                      <SelectValue>
                        <span v-if="selectedTTL === undefined" class="text-muted-foreground">
                          {{ ttlOptionLabel(config.ttlSeconds) }} ({{ $t("send.uploadOptions.expiration") }})
                        </span>
                        <span v-else>{{ ttlOptionLabel(selectedTTL!) }}</span>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="__default__">
                          {{ ttlOptionLabel(config.ttlSeconds) }}（默认）
                        </SelectItem>
                        <SelectItem
                          v-for="opt in ttlOptions"
                          :key="opt.value"
                          :value="String(opt.value)"
                        >
                          {{ ttlOptionLabel(opt.value) }}
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <p class="text-xs text-muted-foreground">{{ ttlLimitHint }}</p>
                </div>

                <!-- 最大下载次数 -->
                <div class="space-y-2">
                  <label class="text-sm font-medium">
                    {{ $t("send.uploadOptions.downloads") }}
                  </label>
                  <p class="text-xs text-muted-foreground">
                    {{ $t("send.uploadOptions.downloadsHint") }}
                  </p>
                  <Select
                    :model-value="selectedDownloads !== undefined ? String(selectedDownloads) : '__default__'"
                    @update:model-value="onDownloadsChange"
                  >
                    <SelectTrigger class="w-full">
                      <SelectValue>
                        <span v-if="selectedDownloads === undefined" class="text-muted-foreground">
                          {{ downloadOptionLabel(config.maxDownloads) }}（默认）
                        </span>
                        <span v-else>{{ downloadOptionLabel(selectedDownloads!) }}</span>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="__default__">
                          {{ downloadOptionLabel(config.maxDownloads) }}（默认）
                        </SelectItem>
                        <SelectItem
                          v-for="opt in downloadOptions"
                          :key="opt"
                          :value="String(opt)"
                        >
                          {{ downloadOptionLabel(opt) }}
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <p class="text-xs text-muted-foreground">{{ downloadsLimitHint }}</p>
                </div>
              </div>
            </div>

            <Button class="w-full" size="lg" @click="sendFiles">
              {{ $t("send.sendFiles", { n: selectedFiles.length }) }}
            </Button>
          </div>

          <!-- 空状态：拖放区域 -->
          <div v-else>
            <div
              class="cursor-pointer rounded-xl border-2 border-dashed border-border px-8 py-12 text-center transition-all duration-200 hover:border-primary hover:bg-accent/50"
              :class="{ 'border-primary bg-accent/50 scale-[1.02]': dragOver }"
              @dragover.prevent="dragOver = true"
              @dragleave.prevent="dragOver = false"
              @drop.prevent="onDrop"
              @click="triggerFileInput"
            >
              <Upload class="mx-auto mb-4 text-muted-foreground" :size="48" />
              <p class="mb-2 text-lg">{{ $t("send.dropZone") }}</p>
              <p class="mb-1 text-xs text-muted-foreground">
                {{ $t("send.selectOrPaste") }}
              </p>
              <p class="text-xs text-muted-foreground">{{ fileLimitsText }}</p>
            </div>

            <!-- 添加文件警告 -->
            <div
              v-for="(warn, idx) in addWarnings"
              :key="idx"
              class="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700"
            >
              {{ warn }}
            </div>

            <!-- 上传错误 -->
            <div
              v-if="uploadError"
              class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
            >
              {{ uploadError }}
            </div>
          </div>
        </template>

        <!-- 阶段 2：上传进度 -->
        <FileUploadProgress
          v-if="showUploadProgress"
          :uploads="fileUploads"
          :overall="overallProgress"
          @cancel="handleCancel"
        />

        <!-- 上传错误（会话创建失败等） -->
        <div
          v-if="uploadError && !showUploadProgress"
          class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
        >
          {{ uploadError }}
        </div>
      </TabsContent>

      <!-- 文本 Tab -->
      <TabsContent value="text" class="mt-4 space-y-3">
        <Textarea
          v-model="textContent"
          :placeholder="$t('send.textPlaceholder')"
          :rows="8"
          class="resize-y"
        />
        <div class="flex items-center justify-between">
          <span class="text-xs text-muted-foreground">
            {{ $t('send.charCount', { count: [...textContent].length.toLocaleString() }) }}
          </span>
          <Button
            :disabled="!textContent.trim() || textLoading"
            @click="handleTextSend"
          >
            {{ textLoading ? $t("send.sending") : $t("send.sendText") }}
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

    <!-- 文本分享结果 -->
    <div v-if="textCode" class="text-center">
      <Card class="mb-6 bg-muted">
        <CardContent class="p-8 text-center">
          <p class="mb-2 text-sm text-muted-foreground">
            {{ $t("send.textCodeLabel") }}
          </p>
          <p class="mb-4 font-mono text-4xl font-bold tracking-[0.3em] text-blue-800">
            {{ textCode }}
          </p>
          <img
            v-if="qrCodeURI"
            :src="qrCodeURI"
            :alt="$t('send.qrAlt')"
            class="mx-auto mb-4 rounded-lg border"
            width="160"
            height="160"
          />
          <Button @click="copyTextCode">
            {{ textCopied ? $t("send.copied") : $t("send.copy") }}
          </Button>
        </CardContent>
      </Card>
      <Button variant="secondary" class="mt-4" @click="resetAll">
        {{ $t("send.sendNewContent") }}
      </Button>
    </div>

    <!-- 文件上传完成 -->
    <div v-if="showUploadResult" class="text-center">
      <!-- 部分成功提示 -->
      <div
        v-if="fileUploads.some((f) => f.status === 'error')"
        class="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700"
      >
        {{ $t("send.partialSuccess") }}
      </div>

      <Card class="mb-6 bg-muted">
        <CardContent class="p-8 text-center">
          <p class="mb-2 text-sm text-muted-foreground">
            {{ $t("send.shareCodeLabel") }}
          </p>
          <p class="mb-4 font-mono text-4xl font-bold tracking-[0.3em] text-blue-800">
            {{ shareCode }}
          </p>
          <img
            v-if="qrCodeURI"
            :src="qrCodeURI"
            :alt="$t('send.qrAlt')"
            class="mx-auto mb-4 rounded-lg border"
            width="160"
            height="160"
          />
          <Button @click="copyCode">
            {{ copied ? $t("send.copied") : $t("send.copy") }}
          </Button>
        </CardContent>
      </Card>

      <P2PTransfer
        v-if="shareCode"
        :code="shareCode"
        role="sender"
        @fallback="console.log('P2P fallback, using R2 upload')"
      />

      <!-- 文件结果列表 -->
      <div class="mb-4 text-left">
        <div
          v-for="upload in fileUploads"
          :key="upload.fileId || upload.filename"
          class="flex items-center gap-2 border-b border-border py-2"
        >
          <span class="flex-1 truncate">{{ upload.filename }}</span>
          <span class="text-sm text-muted-foreground">{{ formatFileSize(upload.totalBytes) }}</span>
          <span v-if="upload.status === 'completed'" class="font-bold text-green-600">✓</span>
          <span v-else-if="upload.status === 'error'" class="font-bold text-red-600">✗</span>
          <span v-else-if="upload.status === 'cancelled'" class="font-bold text-muted-foreground">—</span>
        </div>
      </div>

      <Button variant="secondary" class="mt-4" @click="resetAll">
        {{ $t("send.sendNewFile") }}
      </Button>
    </div>
  </div>


</template>
