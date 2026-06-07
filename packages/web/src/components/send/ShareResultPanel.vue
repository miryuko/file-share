<script setup lang="ts">
/**
 * 分享结果面板组件
 *
 * 职责：展示分享码、QR 码、复制按钮，文件/文本分享共用。
 *
 * 状态覆盖：
 *   - 加载态：QR 码生成中
 *   - 默认：分享码 + QR + 复制按钮
 *   - 文件列表（可选）：展示上传完成的文件列表
 */
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import type { FileUploadProgress } from "../../composables/useFileUploadManager";
import { formatFileSize } from "../../lib/utils";

const { t } = useI18n();

const props = defineProps<{
  code: string;
  qrCodeURI: string;
  /** "file" | "text" — 决定标签文案 */
  type: "file" | "text";
  /** 文件上传进度列表（仅 type="file" 时使用） */
  uploads?: FileUploadProgress[];
}>();

const emit = defineEmits<{
  reset: [];
}>();

function buildShareUrl(code: string): string {
  return `${window.location.origin}/receive/${code}`;
}

async function copyCode(): Promise<void> {
  try {
    await navigator.clipboard.writeText(buildShareUrl(props.code));
    toast.success(t("send.copied"));
  } catch {
    /* fallback */
  }
}
</script>

<template>
  <div class="text-center">
    <Card class="mb-6 bg-muted">
      <CardContent class="p-8 text-center">
        <p class="mb-2 text-sm text-muted-foreground">
          {{ type === "file" ? $t("send.shareCodeLabel") : $t("send.textCodeLabel") }}
        </p>
        <p class="mb-4 font-mono text-4xl font-bold tracking-[0.3em] text-primary">
          {{ code }}
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
          {{ $t("send.copy") }}
        </Button>
      </CardContent>
    </Card>

    <!-- 文件结果列表（仅文件类型） -->
    <div v-if="type === 'file' && uploads && uploads.length > 0" class="mb-4 text-left">
      <div
        v-for="upload in uploads"
        :key="upload.fileId || upload.filename"
        class="flex items-center gap-2 border-b border-border py-2"
      >
        <span class="flex-1 truncate">{{ upload.filename }}</span>
        <span class="text-sm text-muted-foreground">{{ formatFileSize(upload.totalBytes) }}</span>
        <span v-if="upload.status === 'completed'" class="font-bold text-success">&#10003;</span>
        <span v-else-if="upload.status === 'error'" class="font-bold text-destructive">&#10007;</span>
        <span v-else-if="upload.status === 'cancelled'" class="font-bold text-muted-foreground">&mdash;</span>
      </div>
    </div>

    <Button variant="secondary" class="mt-4" @click="emit('reset')">
      {{ type === "file" ? $t("send.sendNewFile") : $t("send.sendNewContent") }}
    </Button>
  </div>
</template>
