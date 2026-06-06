/**
 * 网络连接状态监听 composable
 *
 * 监听 window online/offline 事件，暴露 isOnline 响应式状态。
 * 同时记录最近一次断连时间，供 UI 层展示恢复提示。
 */

import { ref, onMounted, onUnmounted, type Ref } from "vue";

export function useConnectionStatus(): {
  isOnline: Ref<boolean>;
  wasEverOffline: Ref<boolean>;
  lastOfflineAt: Ref<number | null>;
} {
  const isOnline = ref(typeof navigator !== "undefined" ? navigator.onLine : true);
  const wasEverOffline = ref(false);
  const lastOfflineAt = ref<number | null>(null);

  function handleOnline(): void {
    isOnline.value = true;
  }

  function handleOffline(): void {
    isOnline.value = false;
    wasEverOffline.value = true;
    lastOfflineAt.value = Date.now();
  }

  onMounted(() => {
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
  });

  onUnmounted(() => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  });

  return { isOnline, wasEverOffline, lastOfflineAt };
}
