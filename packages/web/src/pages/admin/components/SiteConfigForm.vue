<script setup lang="ts">
/**
 * 站点配置表单组件
 *
 * 职责：所有站点配置字段的编辑 UI（外观、上传限制、文本限制）、
 * 单位换算、无限制切换、保存操作。
 * 不负责：数据加载、认证 —— 这些由父组件处理。
 */
import { ref } from "vue";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Textarea } from "../../../components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger as SelectTriggerUi,
  SelectValue,
} from "../../../components/ui/select";
import { Switch } from "../../../components/ui/switch";
import { InputGroup, InputGroupInput, InputGroupAddon } from "../../../components/ui/input-group";

interface AdminConfig {
  maxFileSize: number;
  maxTotalSize: number;
  maxFiles: number;
  ttlSeconds: number;
  maxDownloads: number;
  rateLimitPerMinute: number;
  maxTextSize: number;
  siteTitle: string;
  siteDescription: string;
  footerNotice: string;
}

const config = defineModel<AdminConfig>("config", { required: true });

defineProps<{
  isSaving: boolean;
}>();

const emit = defineEmits<{
  save: [];
}>();

// ── 单位选项 ──

const SIZE_UNITS = [
  { value: 1, label: "Bytes" },
  { value: 1024, label: "KB" },
  { value: 1024 * 1024, label: "MB" },
  { value: 1024 * 1024 * 1024, label: "GB" },
] as const;

type SizeUnit = (typeof SIZE_UNITS)[number];

const TTL_UNITS = [
  { value: 1, label: "秒" },
  { value: 60, label: "分" },
  { value: 3600, label: "时" },
  { value: 86400, label: "天" },
  { value: 604800, label: "周" },
  { value: 2592000, label: "月" },
  { value: 31536000, label: "年" },
] as const;

type TtlUnit = (typeof TTL_UNITS)[number];

const RATE_WINDOWS = [
  { value: 1, label: "秒" },
  { value: 60, label: "分" },
  { value: 3600, label: "时" },
  { value: 86400, label: "天" },
] as const;

type RateWindow = (typeof RATE_WINDOWS)[number];

// ── 状态 ──

const sizeUnit = ref<Record<"maxFileSize" | "maxTotalSize", SizeUnit>>({
  maxFileSize: SIZE_UNITS[2],
  maxTotalSize: SIZE_UNITS[2],
});

const ttlUnit = ref<TtlUnit>(TTL_UNITS[2]);
const rateWindow = ref<RateWindow>(RATE_WINDOWS[1]);

type UnlimitedField = "maxFileSize" | "maxTotalSize" | "maxFiles" | "maxDownloads" | "maxTextSize" | "ttlSeconds" | "rateLimitPerMinute";

const unlimited = ref<Record<UnlimitedField, boolean>>({
  maxFileSize: false,
  maxTotalSize: false,
  maxFiles: false,
  maxDownloads: false,
  maxTextSize: false,
  ttlSeconds: false,
  rateLimitPerMinute: false,
});

// ── 单位换算 ──

function toUnitValue(bytes: number, unit: SizeUnit): number {
  return Math.round((bytes / unit.value) * 10) / 10;
}

function fromUnitValue(value: number, unit: SizeUnit): number {
  return Math.round(value * unit.value);
}

function autoSelectUnit(bytes: number): SizeUnit {
  for (let i = SIZE_UNITS.length - 1; i >= 0; i--) {
    const unit = SIZE_UNITS[i];
    if (unit && bytes % unit.value === 0 && bytes / unit.value >= 1) return unit;
  }
  return SIZE_UNITS[0];
}

function autoSelectTtlUnit(seconds: number): TtlUnit {
  for (let i = TTL_UNITS.length - 1; i >= 0; i--) {
    const unit = TTL_UNITS[i];
    if (unit && seconds % unit.value === 0 && seconds / unit.value >= 1) return unit;
  }
  return TTL_UNITS[0];
}

function filterNumericInput(raw: string | number): number {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
  const cleaned = raw.replace(/[^0-9]/g, "");
  return cleaned ? Number(cleaned) : 0;
}

// ── 字段读写 ──

function getSizeDisplay(field: "maxFileSize" | "maxTotalSize"): number {
  if (!config.value) return 0;
  const bytes = config.value[field];
  if (bytes === -1) return 0;
  return toUnitValue(bytes, sizeUnit.value[field]);
}

function setSizeValue(field: "maxFileSize" | "maxTotalSize", displayVal: number): void {
  if (!config.value || unlimited.value[field]) return;
  config.value[field] = fromUnitValue(displayVal, sizeUnit.value[field]);
}

function getTtlDisplay(): number {
  if (!config.value) return 0;
  const seconds = config.value.ttlSeconds;
  if (seconds === -1) return 0;
  return Math.round((seconds / ttlUnit.value.value) * 10) / 10;
}

function setTtlValue(displayVal: number): void {
  if (!config.value || unlimited.value.ttlSeconds) return;
  config.value.ttlSeconds = Math.round(displayVal * ttlUnit.value.value);
}

function getRateDisplay(): number {
  if (!config.value) return 0;
  const perMinute = config.value.rateLimitPerMinute;
  if (perMinute === -1) return 0;
  return Math.round(perMinute * rateWindow.value.value / 60);
}

function setRateValue(displayVal: number): void {
  if (!config.value || unlimited.value.rateLimitPerMinute) return;
  config.value.rateLimitPerMinute = Math.max(1, Math.round(displayVal * 60 / rateWindow.value.value));
}

function onUnlimitedChange(field: UnlimitedField): void {
  if (!config.value) return;
  const defaults: Record<string, number> = {
    maxFileSize: 100 * 1024 * 1024,
    maxTotalSize: 500 * 1024 * 1024,
    maxFiles: 20,
    maxDownloads: 20,
    maxTextSize: 100000,
    ttlSeconds: 3600,
    rateLimitPerMinute: 10,
  };
  if (unlimited.value[field]) {
    (config.value as unknown as Record<string, unknown>)[field] = -1;
  } else {
    (config.value as unknown as Record<string, unknown>)[field] = defaults[field] ?? 0;
    if (field === "maxFileSize" || field === "maxTotalSize") {
      sizeUnit.value[field] = autoSelectUnit(defaults[field] ?? 0);
    }
    if (field === "ttlSeconds") {
      ttlUnit.value = autoSelectTtlUnit(defaults[field] ?? 3600);
    }
  }
}

/** 父组件加载配置后调用，初始化字段状态 */
function initFields(): void {
  if (!config.value) return;
  for (const field of ["maxFileSize", "maxTotalSize"] as const) {
    const bytes = config.value[field];
    if (bytes === -1) {
      unlimited.value[field] = true;
    } else {
      unlimited.value[field] = false;
      sizeUnit.value[field] = autoSelectUnit(bytes);
    }
  }
  for (const field of ["maxFiles", "maxDownloads", "maxTextSize"] as const) {
    unlimited.value[field] = config.value[field] === -1;
  }
  if (config.value.ttlSeconds === -1) {
    unlimited.value.ttlSeconds = true;
  } else {
    unlimited.value.ttlSeconds = false;
    ttlUnit.value = autoSelectTtlUnit(config.value.ttlSeconds);
  }
  if (config.value.rateLimitPerMinute === -1) {
    unlimited.value.rateLimitPerMinute = true;
  } else {
    unlimited.value.rateLimitPerMinute = false;
  }
}

defineExpose({ initFields });
</script>

<template>
  <Card v-if="config">
    <CardHeader>
      <CardTitle>{{ $t('admin.siteConfig') }}</CardTitle>
    </CardHeader>
    <CardContent class="space-y-5">
      <!-- 站点外观 -->
      <fieldset>
        <legend class="mb-3 text-sm font-semibold text-foreground">{{ $t('admin.appearanceSection') }}</legend>
        <div class="space-y-3">
          <div>
            <label class="mb-1 block text-sm text-muted-foreground">{{ $t('admin.siteTitle') }}</label>
            <Input v-model="config.siteTitle" :placeholder="$t('admin.siteTitlePlaceholder')" />
          </div>
          <div>
            <label class="mb-1 block text-sm text-muted-foreground">{{ $t('admin.siteDescription') }}</label>
            <Input v-model="config.siteDescription" :placeholder="$t('admin.siteDescriptionPlaceholder')" />
          </div>
          <div>
            <label class="mb-1 block text-sm text-muted-foreground">{{ $t('admin.footerNotice') }}</label>
            <Textarea v-model="config.footerNotice" :placeholder="$t('admin.footerNoticePlaceholder')" class="min-h-16" />
          </div>
        </div>
      </fieldset>

      <!-- 上传限制 -->
      <fieldset>
        <legend class="mb-3 text-sm font-semibold text-foreground">{{ $t('admin.uploadSection') }}</legend>
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5" v-for="field of ['maxFileSize', 'maxTotalSize'] as const" :key="field">
            <label class="text-sm text-muted-foreground">
              {{ field === 'maxFileSize' ? $t('admin.maxFileSizeMB') : $t('admin.maxTotalSizeMB') }}
            </label>
            <InputGroup>
              <InputGroupInput
                :model-value="unlimited[field] ? '' : getSizeDisplay(field)"
                @update:model-value="setSizeValue(field, filterNumericInput($event))"
                :disabled="unlimited[field]"
                :placeholder="unlimited[field] ? $t('admin.unlimited') : '0'"
              />
              <InputGroupAddon align="inline-end">
                <Select
                  :model-value="sizeUnit[field].value"
                  :disabled="unlimited[field]"
                  @update:model-value="(v: unknown) => { const n = Number(v); sizeUnit[field] = SIZE_UNITS.find(u => u.value === n) || SIZE_UNITS[2] }"
                >
                  <SelectTriggerUi class="w-20 border-0 bg-transparent shadow-none">
                    <SelectValue />
                  </SelectTriggerUi>
                  <SelectContent>
                    <SelectItem v-for="u in SIZE_UNITS" :key="u.value" :value="u.value">{{ u.label }}</SelectItem>
                  </SelectContent>
                </Select>
              </InputGroupAddon>
              <InputGroupAddon align="inline-end">
                <Switch
                  :model-value="unlimited[field]"
                  @update:model-value="unlimited[field] = $event; onUnlimitedChange(field)"
                />
              </InputGroupAddon>
            </InputGroup>
          </div>
          <div class="space-y-1.5">
            <label class="text-sm text-muted-foreground">{{ $t('admin.maxFiles') }}</label>
            <InputGroup>
              <InputGroupInput
                :model-value="unlimited.maxFiles ? '' : config.maxFiles"
                @update:model-value="config.maxFiles = filterNumericInput($event)"
                :disabled="unlimited.maxFiles"
                :placeholder="unlimited.maxFiles ? $t('admin.unlimited') : '20'"
              />
              <InputGroupAddon align="inline-end">
                <Switch
                  :model-value="unlimited.maxFiles"
                  @update:model-value="unlimited.maxFiles = $event; onUnlimitedChange('maxFiles')"
                />
              </InputGroupAddon>
            </InputGroup>
          </div>
          <div class="space-y-1.5">
            <label class="text-sm text-muted-foreground">{{ $t('admin.maxDownloadsCfg') }}</label>
            <InputGroup>
              <InputGroupInput
                :model-value="unlimited.maxDownloads ? '' : config.maxDownloads"
                @update:model-value="config.maxDownloads = filterNumericInput($event)"
                :disabled="unlimited.maxDownloads"
                :placeholder="unlimited.maxDownloads ? $t('admin.unlimited') : '20'"
              />
              <InputGroupAddon align="inline-end">
                <Switch
                  :model-value="unlimited.maxDownloads"
                  @update:model-value="unlimited.maxDownloads = $event; onUnlimitedChange('maxDownloads')"
                />
              </InputGroupAddon>
            </InputGroup>
          </div>
          <div class="space-y-1.5">
            <label class="text-sm text-muted-foreground">{{ $t('admin.ttlMinutes') }}</label>
            <InputGroup>
              <InputGroupInput
                :model-value="unlimited.ttlSeconds ? '' : getTtlDisplay()"
                @update:model-value="setTtlValue(filterNumericInput($event))"
                :disabled="unlimited.ttlSeconds"
                :placeholder="unlimited.ttlSeconds ? $t('admin.unlimited') : '0'"
              />
              <InputGroupAddon align="inline-end">
                <Select
                  :model-value="ttlUnit.value"
                  :disabled="unlimited.ttlSeconds"
                  @update:model-value="(v: unknown) => ttlUnit = TTL_UNITS.find(u => u.value === Number(v)) || TTL_UNITS[2]"
                >
                  <SelectTriggerUi class="w-16 border-0 bg-transparent shadow-none"><SelectValue /></SelectTriggerUi>
                  <SelectContent>
                    <SelectItem v-for="u in TTL_UNITS" :key="u.value" :value="u.value">{{ u.label }}</SelectItem>
                  </SelectContent>
                </Select>
              </InputGroupAddon>
              <InputGroupAddon align="inline-end">
                <Switch
                  :model-value="unlimited.ttlSeconds"
                  @update:model-value="unlimited.ttlSeconds = $event; onUnlimitedChange('ttlSeconds')"
                />
              </InputGroupAddon>
            </InputGroup>
          </div>
          <div class="space-y-1.5">
            <label class="text-sm text-muted-foreground">{{ $t('admin.rateLimitPerMinute') }}</label>
            <InputGroup>
              <InputGroupInput
                :model-value="unlimited.rateLimitPerMinute ? '' : getRateDisplay()"
                @update:model-value="setRateValue(filterNumericInput($event))"
                :disabled="unlimited.rateLimitPerMinute"
                :placeholder="unlimited.rateLimitPerMinute ? $t('admin.unlimited') : '0'"
              />
              <InputGroupAddon align="inline-end"><span class="px-1 text-xs text-muted-foreground">/</span></InputGroupAddon>
              <InputGroupAddon align="inline-end">
                <Select
                  :model-value="rateWindow.value"
                  :disabled="unlimited.rateLimitPerMinute"
                  @update:model-value="(v: unknown) => rateWindow = RATE_WINDOWS.find(w => w.value === Number(v)) || RATE_WINDOWS[1]"
                >
                  <SelectTriggerUi class="w-16 border-0 bg-transparent shadow-none"><SelectValue /></SelectTriggerUi>
                  <SelectContent>
                    <SelectItem v-for="w in RATE_WINDOWS" :key="w.value" :value="w.value">{{ w.label }}</SelectItem>
                  </SelectContent>
                </Select>
              </InputGroupAddon>
              <InputGroupAddon align="inline-end">
                <Switch
                  :model-value="unlimited.rateLimitPerMinute"
                  @update:model-value="unlimited.rateLimitPerMinute = $event; onUnlimitedChange('rateLimitPerMinute')"
                />
              </InputGroupAddon>
            </InputGroup>
          </div>
        </div>
      </fieldset>

      <!-- 文本限制 -->
      <fieldset>
        <legend class="mb-3 text-sm font-semibold text-foreground">{{ $t('admin.textSection') }}</legend>
        <div class="space-y-1.5">
          <label class="text-sm text-muted-foreground">{{ $t('admin.maxTextChars') }}</label>
          <InputGroup>
            <InputGroupInput
              :model-value="unlimited.maxTextSize ? '' : config.maxTextSize"
              @update:model-value="config.maxTextSize = filterNumericInput($event)"
              :disabled="unlimited.maxTextSize"
              :placeholder="unlimited.maxTextSize ? $t('admin.unlimited') : '100000'"
            />
            <InputGroupAddon align="inline-end">
              <Switch
                :model-value="unlimited.maxTextSize"
                @update:model-value="unlimited.maxTextSize = $event; onUnlimitedChange('maxTextSize')"
              />
            </InputGroupAddon>
          </InputGroup>
        </div>
      </fieldset>

      <div class="flex items-center gap-3 border-t pt-4">
        <Button @click="emit('save')" :disabled="isSaving">
          {{ isSaving ? $t('admin.saving') : $t('admin.saveConfig') }}
        </Button>
      </div>
    </CardContent>
  </Card>
</template>
