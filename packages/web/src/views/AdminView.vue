<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger as SelectTriggerUi,
  SelectValue,
} from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { InputGroup, InputGroupInput, InputGroupAddon } from "../components/ui/input-group";
import { formatFileSize } from "../lib/utils";

const { t, locale } = useI18n();

const TOKEN_KEY = "admin_token";

const isLoggedIn = ref(false);
const password = ref("");
const loginError = ref("");
const isLoading = ref(false);

interface SessionItem {
  code: string;
  files: { fileId: string; filename: string; size: number }[];
  status: string;
  totalSize: number;
  createdAt: number;
  expiresAt: number;
  downloadCount: number;
  maxDownloads: number;
  creatorIP: string;
}

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

const sessions = ref<SessionItem[]>([]);
const config = ref<AdminConfig | null>(null);
const activeTab = ref("sessions");

// ── 站点配置表单 ──
const isSavingConfig = ref(false);
const configSaved = ref(false);

// 单位选项
const SIZE_UNITS = [
  { value: 1, label: "Bytes" },
  { value: 1024, label: "KB" },
  { value: 1024 * 1024, label: "MB" },
  { value: 1024 * 1024 * 1024, label: "GB" },
] as const;

type SizeUnit = (typeof SIZE_UNITS)[number];

// TTL 单位选项（值 = 秒数）
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

// 速率限制时间窗口选项（值 = 秒数）
const RATE_WINDOWS = [
  { value: 1, label: "秒" },
  { value: 60, label: "分" },
  { value: 3600, label: "时" },
  { value: 86400, label: "天" },
] as const;

type RateWindow = (typeof RATE_WINDOWS)[number];

// 各大小字段当前选中的单位
const sizeUnit = ref<Record<"maxFileSize" | "maxTotalSize", SizeUnit>>({
  maxFileSize: SIZE_UNITS[2], // MB
  maxTotalSize: SIZE_UNITS[2], // MB
});

// TTL 和速率限制当前选中的单位
const ttlUnit = ref<TtlUnit>(TTL_UNITS[2]); // 时
const rateWindow = ref<RateWindow>(RATE_WINDOWS[1]); // 分

// 各限制字段是否无限制
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

/** bytes → 按当前单位显示的值 */
function toUnitValue(bytes: number, unit: SizeUnit): number {
  return Math.round((bytes / unit.value) * 10) / 10;
}

/** 显示值 × 单位 → bytes */
function fromUnitValue(value: number, unit: SizeUnit): number {
  return Math.round(value * unit.value);
}

/** 根据 bytes 自动选择最佳单位（能整除的最大单位） */
function autoSelectUnit(bytes: number): SizeUnit {
  for (let i = SIZE_UNITS.length - 1; i >= 0; i--) {
    const unit = SIZE_UNITS[i];
    if (unit && bytes % unit.value === 0 && bytes / unit.value >= 1) {
      return unit;
    }
  }
  return SIZE_UNITS[0]; // Bytes
}

/** 获取大小字段的显示值 */
function getSizeDisplay(field: "maxFileSize" | "maxTotalSize"): number {
  if (!config.value) return 0;
  const bytes = config.value[field];
  if (bytes === -1) return 0;
  return toUnitValue(bytes, sizeUnit.value[field]);
}

/** 设置大小字段的显示值（单位换算后写入 config） */
function setSizeValue(field: "maxFileSize" | "maxTotalSize", displayVal: number): void {
  if (!config.value) return;
  if (unlimited.value[field]) return;
  config.value[field] = fromUnitValue(displayVal, sizeUnit.value[field]);
}

/** 大小字段切换单位时重新计算显示值 */
function onUnitChange(field: "maxFileSize" | "maxTotalSize", unit: SizeUnit): void {
  sizeUnit.value[field] = unit;
  // 保持 bytes 不变，仅显示值随单位变化（模板会自动重新计算）
}

/** 无限制复选框切换 */
function onUnlimitedChange(field: keyof typeof unlimited.value): void {
  if (!config.value) return;
  if (unlimited.value[field]) {
    config.value[field] = -1 as never;
  } else {
    // 恢复默认值
    const defaults: Record<string, number> = {
      maxFileSize: 100 * 1024 * 1024,
      maxTotalSize: 500 * 1024 * 1024,
      maxFiles: 20,
      maxDownloads: 20,
      maxTextSize: 100000,
      ttlSeconds: 3600,
      rateLimitPerMinute: 10,
    };
    config.value[field] = (defaults[field] ?? 0) as never;
    // 恢复时同步重置单位选择
    if (field === "maxFileSize" || field === "maxTotalSize") {
      sizeUnit.value[field] = autoSelectUnit(defaults[field] ?? 0);
    }
    if (field === "ttlSeconds") {
      ttlUnit.value = autoSelectTtlUnit(defaults[field] ?? 3600);
    }
  }
}

/** 初始化所有字段的单位和无限制状态（加载配置后调用） */
function initSizeFields(): void {
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
  // TTL
  if (config.value.ttlSeconds === -1) {
    unlimited.value.ttlSeconds = true;
  } else {
    unlimited.value.ttlSeconds = false;
    ttlUnit.value = autoSelectTtlUnit(config.value.ttlSeconds);
  }
  // 速率限制
  if (config.value.rateLimitPerMinute === -1) {
    unlimited.value.rateLimitPerMinute = true;
  } else {
    unlimited.value.rateLimitPerMinute = false;
  }
}

/** TTL 秒数 → 按当前单位显示的值 */
function getTtlDisplay(): number {
  if (!config.value) return 0;
  const seconds = config.value.ttlSeconds;
  if (seconds === -1) return 0;
  return Math.round((seconds / ttlUnit.value.value) * 10) / 10;
}

/** TTL 显示值 × 单位 → 秒数写入 config */
function setTtlValue(displayVal: number): void {
  if (!config.value) return;
  if (unlimited.value.ttlSeconds) return;
  config.value.ttlSeconds = Math.round(displayVal * ttlUnit.value.value);
}

/** TTL 切换单位 */
function onTtlUnitChange(unit: TtlUnit): void {
  ttlUnit.value = unit;
}

/** 根据秒数自动选择最佳 TTL 单位 */
function autoSelectTtlUnit(seconds: number): TtlUnit {
  for (let i = TTL_UNITS.length - 1; i >= 0; i--) {
    const unit = TTL_UNITS[i];
    if (unit && seconds % unit.value === 0 && seconds / unit.value >= 1) {
      return unit;
    }
  }
  return TTL_UNITS[0]; // 秒
}

/** 速率限制 per-minute → 按当前窗口显示的值 */
function getRateDisplay(): number {
  if (!config.value) return 0;
  const perMinute = config.value.rateLimitPerMinute;
  if (perMinute === -1) return 0;
  // perMinute = count * 60 / windowSeconds → count = perMinute * windowSeconds / 60
  return Math.round(perMinute * rateWindow.value.value / 60);
}

/** 速率限制显示值 × 窗口 → per-minute 写入 config */
function setRateValue(displayVal: number): void {
  if (!config.value) return;
  if (unlimited.value.rateLimitPerMinute) return;
  // count / window → per minute: count * 60 / windowSeconds
  const perMinute = Math.max(1, Math.round(displayVal * 60 / rateWindow.value.value));
  config.value.rateLimitPerMinute = perMinute;
}

/** 速率限制切换窗口 */
function onRateWindowChange(window: RateWindow): void {
  rateWindow.value = window;
}

/** 过滤数字输入，只允许数字 */
function filterNumericInput(raw: string | number): number {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
  const cleaned = raw.replace(/[^0-9]/g, "");
  return cleaned ? Number(cleaned) : 0;
}

// ── 密码修改表单 ──
const currentPassword = ref("");
const newPassword = ref("");
const confirmPassword = ref("");
const isChangingPassword = ref(false);
const passwordError = ref("");
const passwordSuccess = ref(false);
const isDefaultPwd = ref(false);
const needsPasswordChange = ref(false);

// ── 登录 ──
async function handleLogin(): Promise<void> {
  isLoading.value = true;
  loginError.value = "";

  try {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: password.value }),
    });

    const body = await res.json();

    if (!res.ok) {
      if (res.status === 429) {
        loginError.value = body.message || t("admin.lockedOut");
      } else {
        loginError.value = body.message || t("admin.loginFailed");
      }
      return;
    }

    const { token, needsPasswordChange: forceChange } = body as {
      token: string;
      needsPasswordChange: boolean;
    };
    localStorage.setItem(TOKEN_KEY, token);
    password.value = "";
    isLoggedIn.value = true;
    needsPasswordChange.value = !!forceChange;
    if (forceChange) {
      activeTab.value = "security";
    }
    await loadData();
  } catch {
    loginError.value = t("admin.networkError");
  } finally {
    isLoading.value = false;
  }
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handle401(res: Response): Promise<boolean> {
  if (res.status === 401) {
    isLoggedIn.value = false;
    localStorage.removeItem(TOKEN_KEY);
    return true;
  }
  return false;
}

async function loadData(): Promise<void> {
  const headers = getAuthHeaders();
  try {
    const [sessionsRes, configRes, checkRes] = await Promise.all([
      fetch("/api/admin/sessions", { headers }),
      fetch("/api/admin/config", { headers }),
      fetch("/api/admin/check-default", { headers }),
    ]);

    if (await handle401(sessionsRes)) return;

    if (sessionsRes.ok) {
      const body = await sessionsRes.json() as {
        sessions: SessionItem[];
        total: number;
      };
      sessions.value = body.sessions;
    }

    if (configRes.ok) {
      config.value = await configRes.json() as AdminConfig;
      initSizeFields();
    }

    if (checkRes.ok) {
      const body = await checkRes.json() as { isDefault: boolean };
      isDefaultPwd.value = body.isDefault;
      if (body.isDefault) {
        needsPasswordChange.value = true;
        activeTab.value = "security";
      }
    }
  } catch {
    // 静默处理
  }
}

// ── 会话操作 ──
async function handleTerminate(code: string): Promise<void> {
  const res = await fetch(`/api/admin/sessions/${code}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (res.ok) {
    sessions.value = sessions.value.filter((s) => s.code !== code);
  }
}

// ── 配置保存 ──
async function handleSaveConfig(): Promise<void> {
  if (!config.value) return;
  isSavingConfig.value = true;
  configSaved.value = false;

  try {
    const res = await fetch("/api/admin/config", {
      method: "PUT",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(config.value),
    });

    if (await handle401(res)) return;

    if (res.ok) {
      config.value = await res.json() as AdminConfig;
      configSaved.value = true;
      setTimeout(() => { configSaved.value = false; }, 3000);
    }
  } catch {
    // 静默处理
  } finally {
    isSavingConfig.value = false;
  }
}

// ── 密码修改 ──
async function handleChangePassword(): Promise<void> {
  passwordError.value = "";
  passwordSuccess.value = false;

  if (!newPassword.value) {
    passwordError.value = t("admin.passwordEmpty");
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = t("admin.passwordMismatch");
    return;
  }

  isChangingPassword.value = true;

  try {
    const res = await fetch("/api/admin/password", {
      method: "PUT",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: currentPassword.value,
        newPassword: newPassword.value,
      }),
    });

    if (await handle401(res)) return;

    const body = await res.json();

    if (!res.ok) {
      passwordError.value = body.message || t("admin.passwordChangeFailed");
      return;
    }

    passwordSuccess.value = true;
    isDefaultPwd.value = false;
    needsPasswordChange.value = false;
    currentPassword.value = "";
    newPassword.value = "";
    confirmPassword.value = "";
    setTimeout(() => { passwordSuccess.value = false; }, 3000);
  } catch {
    passwordError.value = t("admin.networkError");
  } finally {
    isChangingPassword.value = false;
  }
}

function handleLogout(): void {
  localStorage.removeItem(TOKEN_KEY);
  isLoggedIn.value = false;
  sessions.value = [];
  config.value = null;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString(locale.value);
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "uploading": return "bg-amber-100 text-amber-800 border-amber-200";
    case "ready": return "bg-green-100 text-green-800 border-green-200";
    case "downloading": return "bg-blue-100 text-blue-800 border-blue-200";
    default: return "bg-muted text-muted-foreground";
  }
}

onMounted(() => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    isLoggedIn.value = true;
    loadData();
  }
});
</script>

<template>
  <div class="mx-auto max-w-[720px] px-4 py-8">
    <h1 class="mb-8 text-center text-2xl font-bold">{{ $t('admin.title') }}</h1>

    <!-- 登录表单 -->
    <div v-if="!isLoggedIn" class="mx-auto mt-8 max-w-[360px]">
      <div class="flex gap-3">
        <Input
          v-model="password"
          type="password"
          :placeholder="$t('admin.passwordPlaceholder')"
          class="flex-1"
          @keyup.enter="handleLogin"
        />
        <Button :disabled="!password || isLoading" @click="handleLogin">
          {{ isLoading ? $t('admin.loggingIn') : $t('admin.login') }}
        </Button>
      </div>
      <div
        v-if="loginError"
        class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
      >
        {{ loginError }}
      </div>
    </div>

    <!-- 管理面板内容 -->
    <div v-if="isLoggedIn">
      <!-- 工具栏 -->
      <div class="mb-6 flex gap-3">
        <Button variant="destructive" @click="handleLogout">{{ $t('admin.logout') }}</Button>
        <Button variant="secondary" @click="loadData">{{ $t('admin.refresh') }}</Button>
      </div>

      <!-- 强制修改密码警告 -->
      <div
        v-if="needsPasswordChange"
        class="mb-6 rounded-lg border-2 border-red-300 bg-red-50 px-5 py-4"
      >
        <p class="font-semibold text-red-700">{{ $t('admin.forcePasswordChangeTitle') }}</p>
        <p class="mt-1 text-sm text-red-600">{{ $t('admin.forcePasswordChangeDesc') }}</p>
      </div>

      <Tabs v-model="activeTab">
        <TabsList class="mb-6 w-full">
          <TabsTrigger value="sessions" :disabled="needsPasswordChange">{{ $t('admin.tabs.sessions') }}</TabsTrigger>
          <TabsTrigger value="config" :disabled="needsPasswordChange">{{ $t('admin.tabs.siteConfig') }}</TabsTrigger>
          <TabsTrigger value="security">{{ $t('admin.tabs.security') }}</TabsTrigger>
        </TabsList>

        <!-- 标签 1：会话管理 -->
        <TabsContent value="sessions">
          <section>
            <h2 class="mb-4 text-lg font-semibold">{{ $t('admin.activeTransfers', { n: sessions.length }) }}</h2>
            <p v-if="sessions.length === 0" class="italic text-muted-foreground">{{ $t('admin.noActiveTransfers') }}</p>
            <Card v-for="s in sessions" :key="s.code" class="mb-3">
              <CardHeader class="pb-0">
                <div class="flex items-center gap-3">
                  <span class="font-mono text-lg font-bold">{{ s.code }}</span>
                  <Badge variant="outline" :class="statusBadgeClass(s.status)">{{ s.status }}</Badge>
                  <span class="ml-auto text-xs text-muted-foreground">{{ s.creatorIP }}</span>
                </div>
              </CardHeader>
              <CardContent class="pt-3">
                <div class="mb-2">
                  <p v-for="f in s.files" :key="f.fileId" class="text-sm text-muted-foreground">
                    {{ f.filename }} ({{ formatFileSize(f.size) }})
                  </p>
                </div>
                <div class="mb-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span>{{ $t('admin.totalSize') }} {{ formatFileSize(s.totalSize) }}</span>
                  <span>{{ $t('admin.downloads') }} {{ s.downloadCount }}/{{ s.maxDownloads }}</span>
                  <span>{{ $t('admin.created') }} {{ formatTime(s.createdAt) }}</span>
                  <span>{{ $t('admin.expires') }} {{ formatTime(s.expiresAt) }}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  class="border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                  @click="handleTerminate(s.code)"
                >
                  {{ $t('admin.terminate') }}
                </Button>
              </CardContent>
            </Card>
          </section>
        </TabsContent>

        <!-- 标签 2：站点配置 -->
        <TabsContent value="config">
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
                  <!-- maxFileSize -->
                  <div class="space-y-1.5">
                    <label class="text-sm text-muted-foreground">{{ $t('admin.maxFileSizeMB') }}</label>
                    <InputGroup>
                      <InputGroupInput
                        :model-value="unlimited.maxFileSize ? '' : getSizeDisplay('maxFileSize')"
                        @update:model-value="setSizeValue('maxFileSize', filterNumericInput($event))"
                        :disabled="unlimited.maxFileSize"
                        :placeholder="unlimited.maxFileSize ? $t('admin.unlimited') : '0'"
                      />
                      <InputGroupAddon align="inline-end">
                        <Select
                          :model-value="sizeUnit.maxFileSize.value"
                          :disabled="unlimited.maxFileSize"
                          @update:model-value="(v: unknown) => { const n = Number(v); onUnitChange('maxFileSize', SIZE_UNITS.find(u => u.value === n) || SIZE_UNITS[2]) }"
                        >
                          <SelectTriggerUi class="w-20 border-0 bg-transparent shadow-none">
                            <SelectValue />
                          </SelectTriggerUi>
                          <SelectContent>
                            <SelectItem v-for="u in SIZE_UNITS" :key="u.value" :value="u.value">
                              {{ u.label }}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </InputGroupAddon>
                      <InputGroupAddon align="inline-end">
                        <Switch
                          :model-value="unlimited.maxFileSize"
                          @update:model-value="unlimited.maxFileSize = $event; onUnlimitedChange('maxFileSize')"
                        />
                      </InputGroupAddon>
                    </InputGroup>
                  </div>
                  <!-- maxTotalSize -->
                  <div class="space-y-1.5">
                    <label class="text-sm text-muted-foreground">{{ $t('admin.maxTotalSizeMB') }}</label>
                    <InputGroup>
                      <InputGroupInput
                        :model-value="unlimited.maxTotalSize ? '' : getSizeDisplay('maxTotalSize')"
                        @update:model-value="setSizeValue('maxTotalSize', filterNumericInput($event))"
                        :disabled="unlimited.maxTotalSize"
                        :placeholder="unlimited.maxTotalSize ? $t('admin.unlimited') : '0'"
                      />
                      <InputGroupAddon align="inline-end">
                        <Select
                          :model-value="sizeUnit.maxTotalSize.value"
                          :disabled="unlimited.maxTotalSize"
                          @update:model-value="(v: unknown) => { const n = Number(v); onUnitChange('maxTotalSize', SIZE_UNITS.find(u => u.value === n) || SIZE_UNITS[2]) }"
                        >
                          <SelectTriggerUi class="w-20 border-0 bg-transparent shadow-none">
                            <SelectValue />
                          </SelectTriggerUi>
                          <SelectContent>
                            <SelectItem v-for="u in SIZE_UNITS" :key="u.value" :value="u.value">
                              {{ u.label }}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </InputGroupAddon>
                      <InputGroupAddon align="inline-end">
                        <Switch
                          :model-value="unlimited.maxTotalSize"
                          @update:model-value="unlimited.maxTotalSize = $event; onUnlimitedChange('maxTotalSize')"
                        />
                      </InputGroupAddon>
                    </InputGroup>
                  </div>
                  <!-- maxFiles -->
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
                  <!-- maxDownloads -->
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
                  <!-- ttlSeconds -->
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
                          @update:model-value="(v: unknown) => onTtlUnitChange(TTL_UNITS.find(u => u.value === Number(v)) || TTL_UNITS[2])"
                        >
                          <SelectTriggerUi class="w-16 border-0 bg-transparent shadow-none">
                            <SelectValue />
                          </SelectTriggerUi>
                          <SelectContent>
                            <SelectItem v-for="u in TTL_UNITS" :key="u.value" :value="u.value">
                              {{ u.label }}
                            </SelectItem>
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
                  <!-- rateLimitPerMinute -->
                  <div class="space-y-1.5">
                    <label class="text-sm text-muted-foreground">{{ $t('admin.rateLimitPerMinute') }}</label>
                    <InputGroup>
                      <InputGroupInput
                        :model-value="unlimited.rateLimitPerMinute ? '' : getRateDisplay()"
                        @update:model-value="setRateValue(filterNumericInput($event))"
                        :disabled="unlimited.rateLimitPerMinute"
                        :placeholder="unlimited.rateLimitPerMinute ? $t('admin.unlimited') : '0'"
                      />
                      <InputGroupAddon align="inline-end">
                        <span class="px-1 text-xs text-muted-foreground">/</span>
                      </InputGroupAddon>
                      <InputGroupAddon align="inline-end">
                        <Select
                          :model-value="rateWindow.value"
                          :disabled="unlimited.rateLimitPerMinute"
                          @update:model-value="(v: unknown) => onRateWindowChange(RATE_WINDOWS.find(w => w.value === Number(v)) || RATE_WINDOWS[1])"
                        >
                          <SelectTriggerUi class="w-16 border-0 bg-transparent shadow-none">
                            <SelectValue />
                          </SelectTriggerUi>
                          <SelectContent>
                            <SelectItem v-for="w in RATE_WINDOWS" :key="w.value" :value="w.value">
                              {{ w.label }}
                            </SelectItem>
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
                <Button @click="handleSaveConfig" :disabled="isSavingConfig">
                  {{ isSavingConfig ? $t('admin.saving') : $t('admin.saveConfig') }}
                </Button>
                <span v-if="configSaved" class="text-sm text-green-600">{{ $t('admin.configSaved') }}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- 标签 3：安全设置 -->
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>{{ $t('admin.securitySettings') }}</CardTitle>
            </CardHeader>
            <CardContent class="space-y-4">
              <!-- 默认密码警告 -->
              <div
                v-if="isDefaultPwd"
                class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700"
              >
                {{ $t('admin.defaultPasswordWarning') }}
              </div>

              <!-- 修改密码表单 -->
              <fieldset>
                <legend class="mb-3 text-sm font-semibold text-foreground">{{ $t('admin.changePassword') }}</legend>
                <div class="space-y-3 max-w-[360px]">
                  <div>
                    <label class="mb-1 block text-sm text-muted-foreground">{{ $t('admin.currentPassword') }}</label>
                    <Input v-model="currentPassword" type="password" />
                  </div>
                  <div>
                    <label class="mb-1 block text-sm text-muted-foreground">{{ $t('admin.newPassword') }}</label>
                    <Input v-model="newPassword" type="password" />
                  </div>
                  <div>
                    <label class="mb-1 block text-sm text-muted-foreground">{{ $t('admin.confirmPassword') }}</label>
                    <Input v-model="confirmPassword" type="password" />
                  </div>
                </div>
              </fieldset>

              <div
                v-if="passwordError"
                class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
              >
                {{ passwordError }}
              </div>
              <div
                v-if="passwordSuccess"
                class="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-600"
              >
                {{ $t('admin.passwordChanged') }}
              </div>

              <div class="border-t pt-4">
                <Button @click="handleChangePassword" :disabled="isChangingPassword">
                  {{ isChangingPassword ? $t('admin.changing') : $t('admin.changePassword') }}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  </div>
</template>
