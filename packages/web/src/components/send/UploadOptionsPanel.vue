<script setup lang="ts">
/**
 * 上传选项面板组件（可折叠）
 *
 * 职责：展示过期时间、最大下载次数的选择器，向上层 emit 用户选择。
 *
 * 状态覆盖：
 *   - 折叠态：显示标题 + 展开箭头
 *   - 展开态：显示 TTL / 下载次数选择器 + 提示文案
 */
import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";
import { ChevronDown, ChevronRight } from "lucide-vue-next";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

const { t } = useI18n();

/** TTL 预设值（秒） */
const TTL_PRESETS = [
  { label: "10 分钟", value: 600 },
  { label: "30 分钟", value: 1800 },
  { label: "1 小时", value: 3600 },
  { label: "6 小时", value: 21600 },
  { label: "24 小时", value: 86400 },
  { label: "7 天", value: 604800 },
  { label: "30 天", value: 2592000 },
];

/** 下载次数预设 */
const DOWNLOAD_PRESETS = [1, 3, 5, 10, 20, 50, 100];

const props = defineProps<{
  /** 站点默认 TTL（秒），-1 = 永久 */
  defaultTtl: number;
  /** 站点默认最大下载次数，-1 = 无限制 */
  defaultMaxDownloads: number;
  /** 站点 TTL 上限（秒），-1 = 无限制 */
  ttlLimit: number;
  /** 站点下载次数上限，-1 = 无限制 */
  downloadsLimit: number;
}>();

const modelTTL = defineModel<number | undefined>("ttl");
const modelDownloads = defineModel<number | undefined>("downloads");

const showUploadOptions = ref(false);

/** 可选的 TTL 选项（不超过站点配置上限） */
const ttlOptions = computed(() => {
  const max = props.ttlLimit;
  const options = TTL_PRESETS.filter((p) => max === -1 || p.value <= max);
  if (max === -1) {
    options.push({ label: t("send.uploadOptions.forever"), value: -1 });
  }
  return options;
});

/** 可选的下载次数（不超过站点配置上限） */
const downloadOptions = computed(() => {
  const max = props.downloadsLimit;
  const options = DOWNLOAD_PRESETS.filter((n) => max === -1 || n <= max);
  if (max === -1) {
    options.push(-1);
  }
  return options;
});

/** TTL 上限提示文案 */
const ttlLimitHint = computed(() => {
  const max = props.ttlLimit;
  if (max === -1) return t("send.uploadOptions.expirationLimitUnlimited");
  return t("send.uploadOptions.expirationLimitOff", {
    limit: formatDuration(max),
  });
});

/** 下载次数上限提示文案 */
const downloadsLimitHint = computed(() => {
  const max = props.downloadsLimit;
  if (max === -1) return t("send.uploadOptions.downloadsLimitUnlimited");
  return t("send.uploadOptions.downloadsLimitOff", { max });
});

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} 秒`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} 分钟`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} 小时`;
  return `${Math.round(seconds / 86400)} 天`;
}

function ttlOptionLabel(value: number): string {
  if (value === -1) return t("send.uploadOptions.forever");
  return formatDuration(value);
}

function downloadOptionLabel(value: number): string {
  if (value === -1) return t("send.uploadOptions.unlimited");
  return `${value} 次`;
}

function defaultTtlLabel(): string {
  return ttlOptionLabel(props.defaultTtl);
}

function defaultDownloadLabel(): string {
  return downloadOptionLabel(props.defaultMaxDownloads);
}
</script>

<template>
  <div class="rounded-lg border border-border">
    <button
      class="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-accent/50"
      @click="showUploadOptions = !showUploadOptions"
    >
      <span>{{ $t("send.uploadOptions.title") }}</span>
      <ChevronRight
        v-if="!showUploadOptions"
        :size="16"
        class="text-muted-foreground"
      />
      <ChevronDown
        v-else
        :size="16"
        class="text-muted-foreground"
      />
    </button>

    <div v-if="showUploadOptions" class="space-y-4 border-t border-border px-4 py-4">
      <!-- 过期时间 -->
      <div class="space-y-2">
        <label class="text-sm font-medium">
          {{ $t("send.uploadOptions.expiration") }}
        </label>
        <p class="text-xs text-muted-foreground">
          {{ $t("send.uploadOptions.expirationHint") }}
        </p>
        <Select
          :model-value="modelTTL !== undefined ? String(modelTTL) : '__default__'"
          @update:model-value="(v: unknown) => modelTTL = String(v) === '__default__' ? undefined : Number(v)"
        >
          <SelectTrigger class="w-full">
            <SelectValue>
              <span v-if="modelTTL === undefined" class="text-muted-foreground">
                {{ defaultTtlLabel() }} ({{ $t("send.uploadOptions.expiration") }})
              </span>
              <span v-else>{{ ttlOptionLabel(modelTTL!) }}</span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="__default__">
                {{ defaultTtlLabel() }}（默认）
              </SelectItem>
              <SelectItem
                v-for="opt in ttlOptions"
                :key="opt.value"
                :value="String(opt.value)"
              >
                {{ ttlOptionLabel(opt.value) }}
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <p class="text-xs text-muted-foreground">{{ ttlLimitHint }}</p>
      </div>

      <!-- 最大下载次数 -->
      <div class="space-y-2">
        <label class="text-sm font-medium">
          {{ $t("send.uploadOptions.downloads") }}
        </label>
        <p class="text-xs text-muted-foreground">
          {{ $t("send.uploadOptions.downloadsHint") }}
        </p>
        <Select
          :model-value="modelDownloads !== undefined ? String(modelDownloads) : '__default__'"
          @update:model-value="(v: unknown) => modelDownloads = String(v) === '__default__' ? undefined : Number(v)"
        >
          <SelectTrigger class="w-full">
            <SelectValue>
              <span v-if="modelDownloads === undefined" class="text-muted-foreground">
                {{ defaultDownloadLabel() }}（默认）
              </span>
              <span v-else>{{ downloadOptionLabel(modelDownloads!) }}</span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="__default__">
                {{ defaultDownloadLabel() }}（默认）
              </SelectItem>
              <SelectItem
                v-for="opt in downloadOptions"
                :key="opt"
                :value="String(opt)"
              >
                {{ downloadOptionLabel(opt) }}
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <p class="text-xs text-muted-foreground">{{ downloadsLimitHint }}</p>
      </div>
    </div>
  </div>
</template>
