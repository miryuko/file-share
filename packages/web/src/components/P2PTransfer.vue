<script setup lang="ts">
import { ref, onUnmounted } from "vue";
import { useWebRTC } from "../composables/useWebRTC";
import { Button } from "./ui/button";

const props = defineProps<{
  code: string;
  role: "sender" | "receiver";
}>();

const emit = defineEmits<{
  fallback: [];
  "file-received": [{ name: string; data: ArrayBuffer; size: number }];
}>();

const { status, connect, sendFile, onFileReceived, onFallback, disconnect } =
  useWebRTC();

const isActive = ref(false);
const errorMsg = ref("");

onFileReceived((file) => {
  emit("file-received", file);
});

onFallback(() => {
  emit("fallback");
});

async function startConnection(): Promise<void> {
  isActive.value = true;
  errorMsg.value = "";

  try {
    await connect(props.code, props.role);
  } catch {
    errorMsg.value = "P2P 连接失败，切换到服务器中转";
  }
}

async function sendP2PFile(file: File): Promise<void> {
  try {
    await sendFile(file);
  } catch {
    errorMsg.value = "P2P 发送失败，切换到服务器中转";
    emit("fallback");
  }
}

function cancelP2P(): void {
  disconnect();
  emit("fallback");
}

onUnmounted(() => {
  disconnect();
});

defineExpose({ startConnection, sendP2PFile });

const statusText: Record<string, string> = {
  idle: "等待连接",
  connecting: "正在连接...",
  signaling: "信令交换中...",
  connected: "P2P 已连接",
  transferring: "P2P 传输中...",
  fallback: "已切换到服务器中转",
  error: "P2P 错误",
};

function dotClass(): string {
  const s = status.value;
  if (s === "fallback" || s === "error") return "bg-red-600";
  if (s === "connected" || s === "transferring") return "bg-green-600";
  return "bg-amber-500 animate-pulse";
}
</script>

<template>
  <div v-if="isActive" class="mb-4 text-center">
    <div class="flex items-center justify-center gap-2 rounded-lg border bg-gray-50 px-4 py-2 text-sm">
      <span class="inline-block h-2 w-2 rounded-full" :class="dotClass()" />
      <span>{{ statusText[status] || status }}</span>
    </div>
    <Button
      v-if="status === 'connected' || status === 'transferring'"
      variant="outline"
      size="sm"
      class="mt-2 border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
      @click="cancelP2P"
    >
      切换到服务器中转
    </Button>
    <p v-if="errorMsg" class="mt-2 text-xs text-red-600">{{ errorMsg }}</p>
  </div>
</template>
