<script setup lang="ts">
import { ref, onUnmounted } from "vue";
import { useWebRTC } from "../composables/useWebRTC";

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
    // 连接失败 → 降级
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
</script>

<template>
  <div v-if="isActive" class="p2p-status">
    <div class="p2p-indicator">
      <span
        class="p2p-dot"
        :class="{
          idle: status === 'idle' || status === 'connecting' || status === 'signaling',
          connected: status === 'connected' || status === 'transferring',
          fallback: status === 'fallback' || status === 'error',
        }"
      ></span>
      <span class="p2p-text">{{ statusText[status] || status }}</span>
    </div>
    <button
      v-if="status === 'connected' || status === 'transferring'"
      class="btn btn-cancel-p2p"
      @click="cancelP2P"
    >
      切换到服务器中转
    </button>
    <div v-if="errorMsg" class="p2p-error">{{ errorMsg }}</div>
  </div>
</template>

<style scoped>
.p2p-status {
  margin-bottom: 1rem;
  text-align: center;
}

.p2p-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 0.85rem;
}

.p2p-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.p2p-dot.idle {
  background: #f59e0b;
  animation: pulse 1s infinite;
}

.p2p-dot.connected {
  background: #16a34a;
}

.p2p-dot.fallback {
  background: #dc2626;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.btn-cancel-p2p {
  margin-top: 0.5rem;
  padding: 0.375rem 1rem;
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #dc2626;
  border-radius: 6px;
  font-size: 0.8rem;
  cursor: pointer;
}

.p2p-error {
  margin-top: 0.5rem;
  font-size: 0.8rem;
  color: #dc2626;
}
</style>
