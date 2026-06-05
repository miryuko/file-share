<script setup lang="ts">
import { ref, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { useWebRTC } from "../composables/useWebRTC";
import { Button } from "./ui/button";

const { t } = useI18n();

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
    errorMsg.value = t('p2p.connectionFailed');
  }
}

async function sendP2PFile(file: File): Promise<void> {
  try {
    await sendFile(file);
  } catch {
    errorMsg.value = t('p2p.sendFailed');
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

function getStatusText(s: string): string {
  const key = `p2p.${s}`;
  const text = t(key);
  return text !== key ? text : s;
}

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
      <span>{{ getStatusText(status) }}</span>
    </div>
    <Button
      v-if="status === 'connected' || status === 'transferring'"
      variant="outline"
      size="sm"
      class="mt-2 border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
      @click="cancelP2P"
    >
      {{ $t('p2p.fallbackButton') }}
    </Button>
    <p v-if="errorMsg" class="mt-2 text-xs text-red-600">{{ errorMsg }}</p>
  </div>
</template>
