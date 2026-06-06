<script setup lang="ts">
/**
 * 文件类型图标组件
 *
 * 根据文件名和 MIME 类型自动选择合适的 lucide 图标，
 * 支持自定义尺寸和额外的 CSS class。
 */

import { computed, type Component } from "vue";
import {
  File,
  FileImage,
  FileText,
  FileArchive,
  FileVideo,
  FileAudio,
  FileCode,
  FileSpreadsheet,
} from "lucide-vue-next";
import { getFileIconComponent } from "../utils/fileTypeIcon";

const props = withDefaults(
  defineProps<{
    filename: string;
    mimeType?: string;
    size?: number;
    class?: string;
  }>(),
  {
    mimeType: "",
    size: 20,
    class: "",
  },
);

const iconComponent = computed<Component>(() => {
  const name = getFileIconComponent(props.filename, props.mimeType);
  const iconMap: Record<string, Component> = {
    File,
    FileImage,
    FileText,
    FileArchive,
    FileVideo,
    FileAudio,
    FileCode,
    FileSpreadsheet,
  };
  return iconMap[name] ?? File;
});
</script>

<template>
  <component :is="iconComponent" :size="size" :class="props.class" />
</template>
