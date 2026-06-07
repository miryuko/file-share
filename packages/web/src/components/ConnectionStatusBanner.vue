<script setup lang="ts">
/**
 * 连接状态横幅组件
 *
 * 职责：当网络离线时显示警告横幅。
 * 在线时不渲染任何内容。
 */
import { WifiOff } from "lucide-vue-next";

defineProps<{
  isOnline: boolean;
}>();
</script>

<template>
  <div
    v-if="!isOnline"
    class="mb-4 flex items-center justify-center gap-2 rounded-lg border border-warning/20 bg-warning/10 px-4 py-2 text-sm text-warning"
  >
    <WifiOff :size="16" />
    {{ $t("send.connectionOffline") }}
  </div>
</template>
