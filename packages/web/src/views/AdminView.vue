<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";

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

// 编辑时以 MB 显示
function toMB(bytes: number): number {
  return Math.round((bytes / (1024 * 1024)) * 10) / 10;
}

function fromMB(mb: number): number {
  return Math.round(mb * 1024 * 1024);
}

function toMinutes(seconds: number): number {
  return Math.round(seconds / 60);
}

function fromMinutes(minutes: number): number {
  return Math.round(minutes * 60);
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

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
                    {{ f.filename }} ({{ formatSize(f.size) }})
                  </p>
                </div>
                <div class="mb-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span>{{ $t('admin.totalSize') }} {{ formatSize(s.totalSize) }}</span>
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
                  <div>
                    <label class="mb-1 block text-sm text-muted-foreground">{{ $t('admin.maxFileSizeMB') }}</label>
                    <Input
                      type="number"
                      :model-value="toMB(config.maxFileSize)"
                      @update:model-value="config.maxFileSize = fromMB(Number($event))"
                      min="1"
                    />
                  </div>
                  <div>
                    <label class="mb-1 block text-sm text-muted-foreground">{{ $t('admin.maxTotalSizeMB') }}</label>
                    <Input
                      type="number"
                      :model-value="toMB(config.maxTotalSize)"
                      @update:model-value="config.maxTotalSize = fromMB(Number($event))"
                      min="1"
                    />
                  </div>
                  <div>
                    <label class="mb-1 block text-sm text-muted-foreground">{{ $t('admin.maxFiles') }}</label>
                    <Input v-model.number="config.maxFiles" type="number" min="1" />
                  </div>
                  <div>
                    <label class="mb-1 block text-sm text-muted-foreground">{{ $t('admin.maxDownloadsCfg') }}</label>
                    <Input v-model.number="config.maxDownloads" type="number" min="1" />
                  </div>
                  <div>
                    <label class="mb-1 block text-sm text-muted-foreground">{{ $t('admin.ttlMinutes') }}</label>
                    <Input
                      type="number"
                      :model-value="toMinutes(config.ttlSeconds)"
                      @update:model-value="config.ttlSeconds = fromMinutes(Number($event))"
                      min="1"
                    />
                  </div>
                  <div>
                    <label class="mb-1 block text-sm text-muted-foreground">{{ $t('admin.rateLimitPerMinute') }}</label>
                    <Input v-model.number="config.rateLimitPerMinute" type="number" min="1" />
                  </div>
                </div>
              </fieldset>

              <!-- 文本限制 -->
              <fieldset>
                <legend class="mb-3 text-sm font-semibold text-foreground">{{ $t('admin.textSection') }}</legend>
                <div>
                  <label class="mb-1 block text-sm text-muted-foreground">{{ $t('admin.maxTextSizeMB') }}</label>
                  <Input
                    type="number"
                    :model-value="toMB(config.maxTextSize)"
                    @update:model-value="config.maxTextSize = fromMB(Number($event))"
                    min="0.1"
                    step="0.1"
                  />
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
