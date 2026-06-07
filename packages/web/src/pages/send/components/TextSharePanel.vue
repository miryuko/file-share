<script setup lang="ts">
/**
 * 文本分享面板组件
 *
 * 职责：文本输入、字符计数、校验、发送 API 调用、加载状态。
 * 发送成功后 emit code，由父组件展示结果。
 */
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";
import { useSiteConfig } from "../../../composables/useSiteConfig";
import { Button } from "../../../components/ui/button";
import { Textarea } from "../../../components/ui/textarea";

const { t } = useI18n();
const { config } = useSiteConfig();

const emit = defineEmits<{
  sent: [code: string];
}>();

const textContent = ref("");
const textLoading = ref(false);

async function handleTextSend(): Promise<void> {
  const content = textContent.value.trim();

  if (!content) {
    toast.error(t("send.validation.textEmpty"));
    return;
  }

  const maxTextSize = config.value.maxTextSize;
  const charCount = [...content].length;
  if (maxTextSize !== -1 && charCount > maxTextSize) {
    toast.error(t("send.validation.textTooLong", { count: charCount, limit: maxTextSize }));
    return;
  }

  textLoading.value = true;
  try {
    const res = await fetch("/api/text/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });

    if (!res.ok) {
      const body = (await res.json()) as { message: string };
      toast.error(body.message || t("send.sendFailed"));
      return;
    }

    const { code } = (await res.json()) as { code: string };
    emit("sent", code);
  } catch {
    toast.error(t("send.networkError"));
  } finally {
    textLoading.value = false;
  }
}

function reset(): void {
  textContent.value = "";
}

defineExpose({ reset });
</script>

<template>
  <div class="space-y-3">
    <Textarea
      v-model="textContent"
      :placeholder="$t('send.textPlaceholder')"
      :rows="8"
      class="resize-y"
    />
    <div class="flex items-center justify-between">
      <span class="text-xs text-muted-foreground">
        {{ $t('send.charCount', { count: [...textContent].length.toLocaleString() }) }}
      </span>
      <Button
        :disabled="!textContent.trim() || textLoading"
        @click="handleTextSend"
      >
        {{ textLoading ? $t("send.sending") : $t("send.sendText") }}
      </Button>
    </div>
  </div>
</template>
