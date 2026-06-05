<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { getSession, getDownloadUrl, ApiError } from "../lib/api";
import P2PTransfer from "../components/P2PTransfer.vue";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent } from "../components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";

const { t } = useI18n();

type ReceiveMode = "file" | "text";

interface FileInfo {
  fileId: string;
  filename: string;
  size: number;
  contentType: string;
}

const receiveMode = ref<ReceiveMode>("file");
const codeInput = ref("");
const isLoading = ref(false);
const errorMessage = ref("");
const session = ref<{
  code: string;
  files: FileInfo[];
  expiresAt: number;
  remainingDownloads: number;
} | null>(null);

const textResult = ref<{ content: string; expiresAt: number } | null>(null);
const textCopied = ref(false);
const encoder = new TextEncoder();

function onCodeInput(event: Event): void {
  const input = event.target as HTMLInputElement;
  input.value = input.value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, "");
  codeInput.value = input.value;
}

async function handleReceive(): Promise<void> {
  const code = codeInput.value.trim().toUpperCase();
  if (code.length !== 6) {
    errorMessage.value = t('receive.invalidCode');
    return;
  }

  isLoading.value = true;
  errorMessage.value = "";
  session.value = null;
  textResult.value = null;

  try {
    if (receiveMode.value === "text") {
      const res = await fetch(`/api/text/${code}`);
      if (!res.ok) {
        const body = (await res.json()) as { message: string };
        throw new ApiError(body.message, res.status, body.message);
      }
      textResult.value = (await res.json()) as { content: string; expiresAt: number };
    } else {
      session.value = await getSession(code);
    }
  } catch (err) {
    if (err instanceof ApiError) {
      errorMessage.value = err.message;
    } else {
      errorMessage.value = t('receive.queryError');
    }
  } finally {
    isLoading.value = false;
  }
}

async function copyTextContent(): Promise<void> {
  if (!textResult.value) return;
  try {
    await navigator.clipboard.writeText(textResult.value.content);
    textCopied.value = true;
    setTimeout(() => { textCopied.value = false; }, 2000);
  } catch { /* fallback */ }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
  errorMessage.value = "";
}
</script>

<template>
  <div class="mx-auto max-w-[480px] px-4 py-8">
    <h1 class="mb-6 text-center text-2xl font-bold">{{ $t('receive.title') }}</h1>

    <!-- 模式切换 -->
    <Tabs v-if="!session && !textResult" v-model="receiveMode" class="mb-6">
      <TabsList class="grid w-full grid-cols-2">
        <TabsTrigger value="file">{{ $t('receive.tabFile') }}</TabsTrigger>
        <TabsTrigger value="text">{{ $t('receive.tabText') }}</TabsTrigger>
      </TabsList>
    </Tabs>

    <!-- 输入分享码 -->
    <div v-if="!session && !textResult" class="space-y-4">
      <div class="flex gap-3">
        <Input
          v-model="codeInput"
          maxlength="6"
          :placeholder="$t('receive.codePlaceholder')"
          autocomplete="off"
          class="flex-1 text-center font-mono text-2xl tracking-[0.3em] uppercase"
          @input="onCodeInput"
          @keyup.enter="handleReceive"
        />
        <Button :disabled="codeInput.length !== 6 || isLoading" @click="handleReceive">
          {{ isLoading ? $t('receive.searching') : $t('receive.receive') }}
        </Button>
      </div>
      <div
        v-if="errorMessage"
        class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
      >
        {{ errorMessage }}
      </div>
    </div>

    <!-- 文件列表 -->
    <div v-if="session" class="text-center">
      <div class="mb-6 flex flex-col gap-1 rounded-lg bg-sky-50 p-4 text-sm text-gray-600">
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
              <p class="text-xs text-gray-400">{{ formatSize(file.size) }}</p>
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
      <div class="mb-4 flex justify-between text-xs text-gray-400">
        <span>{{ formatExpiry(textResult.expiresAt) }}</span>
        <span>{{ encoder.encode(textResult.content).byteLength.toLocaleString() }} bytes</span>
      </div>
      <Button class="mb-4" @click="copyTextContent">
        {{ textCopied ? $t('receive.copied') : $t('receive.copy') }}
      </Button>
      <Button variant="secondary" class="mt-4 w-full" @click="reset">
        {{ $t('receive.receiveOtherContent') }}
      </Button>
    </div>
  </div>
</template>
