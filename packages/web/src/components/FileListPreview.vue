<script setup lang="ts">
/**
 * 文件列表预览组件（阶段 1：审核阶段）
 *
 * 展示待上传文件列表，支持：
 *   - 文件类型图标 + 文件名 + 大小
 *   - 单个移除
 *   - 添加更多文件
 *   - 文件数量进度条（当前/上限）
 *   - 总大小进度条（当前/上限）
 *
 * 状态覆盖：
 *   - 空列表：显示提示文案
 *   - 有文件：显示可交互的文件卡片 + 限制进度条
 *   - 禁用态：隐藏操作按钮（上传中）
 */

import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { X, Plus } from "lucide-vue-next";
import FileTypeIcon from "./FileTypeIcon.vue";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { formatFileSize } from "../lib/utils";
import type { SelectedFileInfo } from "../composables/useFileUploadManager";

const { t } = useI18n();

const props = defineProps<{
  files: SelectedFileInfo[];
  disabled?: boolean;
  canAddMore?: boolean;
  /** 最大文件数，-1 = 无限制 */
  maxFiles?: number;
  /** 最大总大小（字节），-1 = 无限制 */
  maxTotalSize?: number;
}>();

const emit = defineEmits<{
  remove: [index: number];
  addMore: [];
}>();

const totalSize = computed(() => props.files.reduce((sum, f) => sum + f.size, 0));

/** 文件数量使用百分比（0-100），无限制时返回 0 */
const fileCountPct = computed(() => {
  const max = props.maxFiles ?? -1;
  if (max <= 0) return 0;
  return Math.min(100, Math.round((props.files.length / max) * 100));
});

/** 总大小使用百分比（0-100），无限制时返回 0 */
const totalSizePct = computed(() => {
  const max = props.maxTotalSize ?? -1;
  if (max <= 0) return 0;
  if (totalSize.value === 0) return 0;
  return Math.min(100, Math.round((totalSize.value / max) * 100));
});

/** 文件数量是否有限制 */
const hasFileLimit = computed(() => (props.maxFiles ?? -1) > 0);

/** 总大小是否有限制 */
const hasSizeLimit = computed(() => (props.maxTotalSize ?? -1) > 0);
</script>

<template>
  <div class="space-y-3">
    <!-- 文件列表 -->
    <div
      v-for="(f, index) in files"
      :key="f.id"
      class="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
    >
      <FileTypeIcon
        :filename="f.name"
        :mime-type="f.type"
        :size="24"
        class="flex-shrink-0 text-muted-foreground"
      />
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium">{{ f.name }}</p>
        <p class="text-xs text-muted-foreground">{{ formatFileSize(f.size) }}</p>
      </div>
      <Button
        v-if="!disabled"
        variant="ghost"
        size="icon"
        class="h-8 w-8 flex-shrink-0"
        :aria-label="t('send.removeFile')"
        @click="emit('remove', index)"
      >
        <X :size="16" />
      </Button>
    </div>

    <!-- 底部信息栏：进度条 + 添加更多按钮 -->
    <div class="space-y-2">
      <!-- 文件数量进度条 -->
      <div v-if="hasFileLimit" class="space-y-1">
        <div class="flex justify-between text-xs text-muted-foreground">
          <span>{{ t('send.fileCount', { n: files.length }) }}</span>
          <span>{{ files.length }} / {{ maxFiles }}</span>
        </div>
        <Progress :model-value="fileCountPct" class="h-1.5" />
      </div>
      <div v-else class="text-xs text-muted-foreground">
        {{ t('send.fileCount', { n: files.length }) }}
      </div>

      <!-- 总大小进度条 -->
      <div v-if="hasSizeLimit" class="space-y-1">
        <div class="flex justify-between text-xs text-muted-foreground">
          <span>{{ t('send.totalSize', { size: formatFileSize(totalSize) }) }}</span>
          <span>{{ formatFileSize(totalSize) }} / {{ formatFileSize(maxTotalSize!) }}</span>
        </div>
        <Progress :model-value="totalSizePct" class="h-1.5" />
      </div>
      <div v-else class="text-xs text-muted-foreground">
        {{ t('send.totalSize', { size: formatFileSize(totalSize) }) }}
      </div>

      <!-- 添加更多按钮 -->
      <div class="flex justify-end">
        <Button
          v-if="!disabled && canAddMore"
          variant="ghost"
          size="sm"
          @click="emit('addMore')"
        >
          <Plus :size="16" class="mr-1" />
          {{ t('send.addMoreFiles') }}
        </Button>
      </div>
    </div>
  </div>
</template>
