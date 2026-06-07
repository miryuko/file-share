<script setup lang="ts">
/**
 * SendView — 文件/文本分享页面
 *
 * 职责：作为顶层编排器，组合子组件并协调数据流。
 * 不负责具体的 UI 渲染逻辑，将其委托给 components/send/ 下的子组件。
 */
import { ref, watch, computed } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";
import { WifiOff } from "lucide-vue-next";
import { useFileUploadManager } from "../composables/useFileUploadManager";
import { useConnectionStatus } from "../composables/useConnectionStatus";
import { useSiteConfig } from "../composables/useSiteConfig";
import { ApiError } from "../lib/api";
import { generateQRCodeDataURI } from "../lib/qrcode";
import FileDropZone from "../components/send/FileDropZone.vue";
import UploadOptionsPanel from "../components/send/UploadOptionsPanel.vue";
import ShareResultPanel from "../components/send/ShareResultPanel.vue";
import FileListPreview from "../components/FileListPreview.vue";
import FileUploadProgress from "../components/FileUploadProgress.vue";
import P2PTransfer from "../components/P2PTransfer.vue";
import { Button } from "../components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Textarea } from "../components/ui/textarea";

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
const selectedTTL = ref<number | undefined>(undefined);
const selectedDownloads = ref<number | undefined>(undefined);

// ── 文件输入引用（保留用于粘贴场景中触发文件选择） ──
const fileInput = ref<HTMLInputElement | null>(null);

// ── 文本分享 ──
const textContent = ref("");
const textCode = ref("");
const textLoading = ref(false);

// ── QR 码 ──
const qrCodeURI = ref("");

function buildShareUrl(code: string): string {
  return `${window.location.origin}/receive/${code}`;
}

// ── 阶段计算 ──
const showFileReview = computed(
  () => phase.value === "selecting" && selectedFiles.value.length > 0,
);
const showUploadProgress = computed(() => phase.value === "uploading");
const showUploadResult = computed(
  () =>
    (phase.value === "completed" || phase.value === "error" || phase.value === "cancelled") &&
    shareCode.value !== "",
);

// 分享码变化时异步生成 QR 码
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

// 上传完成后部分成功提示
watch(phase, (p) => {
  if (p === "completed" && fileUploads.value.some((f) => f.status === "error")) {
    toast.warning(t("send.partialSuccess"));
  }
});

// ── 文件处理 ──

async function handleFiles(files: File[]): Promise<void> {
  const result = await addFiles(files);
  for (const err of result.errors) {
    toast.warning(err);
  }
}

function onFileChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  if (input.files) {
    handleFiles(Array.from(input.files));
    input.value = "";
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
  try {
    await startUpload({
      ttlSeconds: selectedTTL.value,
      maxDownloads: selectedDownloads.value,
    });
  } catch (err) {
    if (err instanceof ApiError) {
      toast.error(err.message);
    } else if (err instanceof Error && err.message !== "没有可上传的文件") {
      toast.error(t("send.uploadError"));
    }
  }
}

// ── 文本分享 ──

async function handleTextSend(): Promise<void> {
  const content = textContent.value.trim();

  if (!content) {
    toast.error(t("send.validation.textEmpty"));
    return;
  }

  const maxTextSize = config.value.maxTextSize;
  const charCount = [...content].length;
  if (maxTextSize !== -1 && charCount > maxTextSize) {
    toast.error(t("send.validation.textTooLong", { count: charCount, limit: maxTextSize }));
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
      toast.error(body.message || t("send.sendFailed"));
      return;
    }

    const { code } = (await res.json()) as { code: string };
    textCode.value = code;
  } catch {
    toast.error(t("send.networkError"));
  } finally {
    textLoading.value = false;
  }
}

// ── 重置 ──

function resetAll(): void {
  resetUpload();
  textCode.value = "";
  textContent.value = "";
  selectedTTL.value = undefined;
  selectedDownloads.value = undefined;
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
      class="mb-4 flex items-center justify-center gap-2 rounded-lg border border-warning/20 bg-warning/10 px-4 py-2 text-sm text-warning"
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
        <input
          ref="fileInput"
          type="file"
          multiple
          class="hidden"
          @change="onFileChange"
        />

        <template v-if="!showUploadProgress && !showUploadResult">
          <!-- 审核阶段 -->
          <div v-if="showFileReview" class="space-y-4">
            <FileListPreview
              :files="selectedFiles"
              :can-add-more="canAddMoreFiles"
              :max-files="config.maxFiles"
              :max-total-size="config.maxTotalSize"
              @remove="removeFile"
              @add-more="triggerFileInput"
            />

            <UploadOptionsPanel
              v-model:ttl="selectedTTL"
              v-model:downloads="selectedDownloads"
              :default-ttl="config.ttlSeconds"
              :default-max-downloads="config.maxDownloads"
              :ttl-limit="config.ttlSeconds"
              :downloads-limit="config.maxDownloads"
            />

            <Button class="w-full" size="lg" @click="sendFiles">
              {{ $t("send.sendFiles", { n: selectedFiles.length }) }}
            </Button>
          </div>

          <!-- 空状态：拖放区域 -->
          <FileDropZone
            v-else
            :limit-text="fileLimitsText"
            @files="handleFiles"
          />
        </template>

        <!-- 上传进度 -->
        <FileUploadProgress
          v-if="showUploadProgress"
          :uploads="fileUploads"
          :overall="overallProgress"
          @cancel="cancelUpload"
        />
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
      </TabsContent>
    </Tabs>

    <!-- 文本分享结果 -->
    <ShareResultPanel
      v-if="textCode"
      :code="textCode"
      :qr-code-u-r-i="qrCodeURI"
      type="text"
      @reset="resetAll"
    />

    <!-- 文件上传完成 -->
    <div v-if="showUploadResult">
      <ShareResultPanel
        :code="shareCode"
        :qr-code-u-r-i="qrCodeURI"
        type="file"
        :uploads="fileUploads"
        @reset="resetAll"
      />

      <P2PTransfer
        v-if="shareCode"
        :code="shareCode"
        role="sender"
        @fallback="console.log('P2P fallback, using R2 upload')"
      />
    </div>
  </div>
</template>
