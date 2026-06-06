<script setup lang="ts">
/**
 * 文件上传进度组件（阶段 2：上传阶段）
 *
 * 展示每个文件的上传进度、速度、ETA 和状态。
 * 支持：
 *   - 总体进度条 + 汇总速度和 ETA
 *   - 每个文件独立进度条、速度、ETA
 *   - 取消按钮（整个上传）
 *
 * 状态覆盖：
 *   - uploading：蓝色进度条 + 速度/ETA
 *   - completed：绿色勾
 *   - error：红色叉 + 错误信息 + 重试按钮
 *   - cancelled：灰色取消标记
 *   - pending：灰色等待标记
 */

import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { CheckCircle, AlertCircle, Ban } from "lucide-vue-next";
import FileTypeIcon from "./FileTypeIcon.vue";
import { Progress } from "./ui/progress";
import { Button } from "./ui/button";
import type {
  FileUploadProgress as FileUploadProgressType,
  OverallProgress,
} from "../composables/useFileUploadManager";

const { t } = useI18n();

const props = defineProps<{
  uploads: FileUploadProgressType[];
  overall: OverallProgress;
}>();

const emit = defineEmits<{
  cancel: [];
  retryFile: [index: number];
}>();

const hasActiveUploads = computed(() =>
  props.uploads.some(
    (u) => u.status === "uploading" || u.status === "pending",
  ),
);

const CHUNK_SIZE = 5 * 1024 * 1024;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec < 1024) return `${bytesPerSec} B/s`;
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
  return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
}

function formatEtaText(seconds: number): string {
  if (seconds < 60) return t("send.etaSeconds", { n: seconds });
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return t("send.etaMinutes", { m, s });
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return t("send.etaHours", { h, m: rm });
}
</script>

<template>
  <div class="space-y-4">
    <!-- 总体进度 -->
    <div class="rounded-lg bg-muted p-4">
      <div class="mb-2 flex items-center justify-between">
        <span class="text-sm font-medium">{{ $t('send.uploading') }}</span>
        <span class="text-sm text-muted-foreground">{{ overall.pct }}%</span>
      </div>
      <Progress :model-value="overall.pct" class="h-2" />
      <div class="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span v-if="overall.speed > 0">{{ $t('send.uploadSpeed', { speed: formatSpeed(overall.speed) }) }}</span>
        <span v-if="overall.eta > 0">{{ formatEtaText(overall.eta) }}</span>
      </div>
    </div>

    <!-- 取消按钮 -->
    <div v-if="hasActiveUploads" class="text-center">
      <Button variant="outline" size="sm" @click="emit('cancel')">
        {{ $t('send.cancelUpload') }}
      </Button>
    </div>

    <!-- 每个文件的进度 -->
    <div
      v-for="(upload, index) in uploads"
      :key="upload.fileId || upload.filename"
      class="rounded-lg border border-border bg-card p-3"
    >
      <div class="mb-2 flex items-center gap-2">
        <FileTypeIcon
          :filename="upload.filename"
          :size="20"
          class="flex-shrink-0 text-muted-foreground"
        />
        <span class="min-w-0 flex-1 truncate text-sm">{{ upload.filename }}</span>

        <!-- 状态图标 -->
        <CheckCircle
          v-if="upload.status === 'completed'"
          :size="18"
          class="flex-shrink-0 text-green-600"
        />
        <AlertCircle
          v-else-if="upload.status === 'error'"
          :size="18"
          class="flex-shrink-0 text-red-600"
        />
        <Ban
          v-else-if="upload.status === 'cancelled'"
          :size="18"
          class="flex-shrink-0 text-muted-foreground"
        />
        <span
          v-else-if="upload.status === 'pending'"
          class="flex-shrink-0 text-xs text-muted-foreground"
        >
          {{ $t('send.pending') }}
        </span>
      </div>

      <!-- 进度条 -->
      <div v-if="upload.status === 'uploading'" class="space-y-1">
        <Progress :model-value="upload.progress" class="h-1.5" />
        <div class="flex justify-between text-xs text-muted-foreground">
          <span>{{ upload.progress }}%</span>
          <span v-if="upload.speed > 0">{{ formatSpeed(upload.speed) }}</span>
          <span v-if="upload.eta > 0">{{ formatEtaText(upload.eta) }}</span>
        </div>
        <span class="text-xs text-muted-foreground">
          {{ upload.uploadMethod === 'direct'
            ? $t('send.uploadMethodDirect')
            : $t('send.uploadMethodChunked', { chunks: Math.ceil(upload.totalBytes / CHUNK_SIZE) }) }}
        </span>
      </div>

      <!-- 错误信息 + 重试 -->
      <div v-if="upload.status === 'error'" class="mt-2">
        <p class="mb-1 text-xs text-red-600">{{ upload.error }}</p>
        <Button variant="outline" size="sm" @click="emit('retryFile', index)">
          {{ $t('send.retry') }}
        </Button>
      </div>

      <!-- 取消信息 -->
      <p v-if="upload.status === 'cancelled'" class="text-xs text-muted-foreground">
        {{ $t('send.fileCancelled') }}
      </p>

      <!-- 完成信息 -->
      <p v-if="upload.status === 'completed'" class="text-xs text-muted-foreground">
        {{ formatSize(upload.totalBytes) }}
      </p>
    </div>
  </div>
</template>
