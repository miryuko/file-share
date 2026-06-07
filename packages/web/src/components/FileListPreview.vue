<script setup lang="ts">
/**
 * 文件列表预览组件（阶段 1：审核阶段）
 *
 * 展示待上传文件列表，支持：
 *   - 文件类型图标 + 文件名 + 大小
 *   - 单个移除
 *   - 添加更多文件
 *   - 显示总文件数和总大小
 *
 * 状态覆盖：
 *   - 空列表：显示提示文案
 *   - 有文件：显示可交互的文件卡片
 *   - 禁用态：隐藏操作按钮（上传中）
 */

import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { X, Plus } from "lucide-vue-next";
import FileTypeIcon from "./FileTypeIcon.vue";
import { Button } from "./ui/button";
import { formatFileSize } from "../lib/utils";
import type { SelectedFileInfo } from "../composables/useFileUploadManager";

const { t } = useI18n();

const props = defineProps<{
  files: SelectedFileInfo[];
  disabled?: boolean;
  canAddMore?: boolean;
}>();

const emit = defineEmits<{
  remove: [index: number];
  addMore: [];
}>();

const totalSize = computed(() => props.files.reduce((sum, f) => sum + f.size, 0));
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

    <!-- 底部信息栏 -->
    <div class="flex items-center justify-between text-sm text-muted-foreground">
      <span>{{ t('send.fileCount', { n: files.length }) }} · {{ formatFileSize(totalSize) }}</span>
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
</template>
