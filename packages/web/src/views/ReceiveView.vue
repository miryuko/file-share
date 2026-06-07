<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";
import { getCodeInfo, getDownloadUrl, ApiError } from "../lib/api";
import { formatFileSize } from "../lib/utils";
import P2PTransfer from "../components/P2PTransfer.vue";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "../components/ui/input-otp";

const { t } = useI18n();
const route = useRoute();

interface FileInfo {
  fileId: string;
  filename: string;
  size: number;
  contentType: string;
}

const codeInput = ref("");
const isLoading = ref(false);
const session = ref<{
  code: string;
  files: FileInfo[];
  expiresAt: number;
  remainingDownloads: number;
} | null>(null);

const textResult = ref<{ content: string; expiresAt: number } | null>(null);


// 自动过滤和转大写
watch(codeInput, (val) => {
  const filtered = val.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, "");
  if (filtered !== val) {
    codeInput.value = filtered;
  }
});

// OTP 输入完成时自动查询
function onOtpComplete(): void {
  handleReceive();
}

async function handleReceive(): Promise<void> {
  const code = codeInput.value.trim().toUpperCase();
  if (code.length !== 6) {
    toast.error(t('receive.invalidCode'));
    return;
  }

  isLoading.value = true;
  session.value = null;
  textResult.value = null;

  try {
    const result = await getCodeInfo(code);

    if (result.type === "file") {
      session.value = {
        code: result.code,
        files: result.files,
        expiresAt: result.expiresAt,
        remainingDownloads: result.remainingDownloads,
      };
    } else {
      textResult.value = {
        content: result.content,
        expiresAt: result.expiresAt,
      };
    }
  } catch (err) {
    if (err instanceof ApiError) {
      toast.error(err.message);
    } else {
      toast.error(t('receive.queryError'));
    }
  } finally {
    isLoading.value = false;
  }
}

async function copyTextContent(): Promise<void> {
  if (!textResult.value) return;
  try {
    await navigator.clipboard.writeText(textResult.value.content);
    toast.success(t('receive.copied'));
  } catch { /* fallback */ }
}

function formatExpiry(expiresAt: number): string {
  const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 60000));
  if (remaining < 1) return t('receive.expiring');
  if (remaining < 60) return t('receive.expiresInMinutes', { n: remaining });
  const hours = Math.floor(remaining / 60);
  return t('receive.expiresInHours', { h: hours, m: remaining % 60 });
}

function handleP2PFileReceived(file: { name: string; data: ArrayBuffer; size: number }): void {
  const blob = new Blob([file.data]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(url);
}

function reset(): void {
  session.value = null;
  textResult.value = null;
  codeInput.value = "";
}

// 支持从 URL 路由 /receive/:code 自动查询
onMounted(() => {
  const routeCode = route.params.code as string | undefined;
  if (routeCode && routeCode.length === 6) {
    codeInput.value = routeCode.toUpperCase();
    handleReceive();
  }
});

// 暴露 codeInput 以便测试直接设置值
defineExpose({ codeInput });
</script>

<template>
  <div class="mx-auto max-w-[480px] px-4 py-8">
    <h1 class="mb-6 text-center text-2xl font-bold">{{ $t('receive.title') }}</h1>

    <!-- 输入分享码（OTP 输入，自动识别类型） -->
    <div v-if="!session && !textResult" class="space-y-6">
      <InputOTP
        v-model="codeInput"
        :maxlength="6"
        :disabled="isLoading"
        @complete="onOtpComplete"
      >
        <InputOTPGroup class="mx-auto">
          <InputOTPSlot
            v-for="i in 6"
            :key="i"
            :index="i - 1"
            class="h-14 w-12 font-mono text-2xl font-semibold"
          />
        </InputOTPGroup>
      </InputOTP>

      <div class="flex justify-center">
        <Button :disabled="codeInput.length !== 6 || isLoading" @click="handleReceive">
          {{ isLoading ? $t('receive.searching') : $t('receive.receive') }}
        </Button>
      </div>
    </div>

    <!-- 文件列表 -->
    <div v-if="session" class="text-center">
      <div class="mb-6 flex flex-col gap-1 rounded-lg bg-muted p-4 text-sm text-foreground">
        <span>{{ $t('receive.codeLabel') }} <strong class="text-lg text-blue-800">{{ session.code }}</strong></span>
        <span>{{ formatExpiry(session.expiresAt) }}</span>
        <span>{{ $t('receive.remainingDownloads', { n: session.remainingDownloads }) }}</span>
      </div>

      <P2PTransfer
        :code="session.code"
        role="receiver"
        @file-received="handleP2PFileReceived"
      />

      <div class="text-left">
        <Card v-for="file in session.files" :key="file.fileId" class="mb-2 hover:border-blue-500">
          <CardContent class="flex items-center gap-3 p-4">
            <div class="min-w-0 flex-1">
              <p class="truncate font-medium">{{ file.filename }}</p>
              <p class="text-xs text-muted-foreground">{{ formatFileSize(file.size) }}</p>
            </div>
            <a :href="getDownloadUrl(session.code, file.fileId)" download>
              <Button variant="default" class="bg-green-600 hover:bg-green-700">{{ $t('receive.download') }}</Button>
            </a>
          </CardContent>
        </Card>
      </div>

      <Button variant="secondary" class="mt-6 w-full" @click="reset">
        {{ $t('receive.receiveOtherFile') }}
      </Button>
    </div>

    <!-- 文本结果 -->
    <div v-if="textResult" class="text-center">
      <Card class="mb-4 max-h-[400px] overflow-y-auto text-left">
        <CardContent class="p-6">
          <pre class="whitespace-pre-wrap break-words text-sm leading-relaxed">{{ textResult.content }}</pre>
        </CardContent>
      </Card>
      <div class="mb-4 flex justify-between text-xs text-muted-foreground">
        <span>{{ formatExpiry(textResult.expiresAt) }}</span>
        <span>{{ $t('send.charCount', { count: [...textResult.content].length.toLocaleString() }) }}</span>
      </div>
      <Button class="mb-4" @click="copyTextContent">
        {{ $t('receive.copy') }}
      </Button>
      <Button variant="secondary" class="mt-4 w-full" @click="reset">
        {{ $t('receive.receiveOtherContent') }}
      </Button>
    </div>
  </div>
</template>
