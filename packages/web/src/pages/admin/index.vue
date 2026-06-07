<script setup lang="ts">
/**
 * AdminView — 管理面板页面
 *
 * 职责：认证状态管理、数据加载、子组件编排。
 * UI 渲染委托给 AdminLoginForm / SiteConfigForm / PasswordChangeForm。
 */
import { ref, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent, CardHeader } from "../../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { formatFileSize } from "../../lib/utils";
import AdminLoginForm from "./components/AdminLoginForm.vue";
import SiteConfigForm from "./components/SiteConfigForm.vue";
import PasswordChangeForm from "./components/PasswordChangeForm.vue";

const { t, locale } = useI18n();

const TOKEN_KEY = "admin_token";

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

const isLoggedIn = ref(false);
const sessions = ref<SessionItem[]>([]);
const config = ref<AdminConfig | null>(null);
const activeTab = ref("sessions");
const isDefaultPwd = ref(false);
const needsPasswordChange = ref(false);
const isSavingConfig = ref(false);

// ── 认证 ──

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function handleLoginSuccess(token: string, forceChange: boolean): void {
  localStorage.setItem(TOKEN_KEY, token);
  isLoggedIn.value = true;
  needsPasswordChange.value = forceChange;
  if (forceChange) activeTab.value = "security";
  loadData();
}

function handleLogout(): void {
  localStorage.removeItem(TOKEN_KEY);
  isLoggedIn.value = false;
  sessions.value = [];
  config.value = null;
}

// ── 数据加载 ──

async function loadData(): Promise<void> {
  const headers = getAuthHeaders();
  try {
    const [sessionsRes, configRes, checkRes] = await Promise.all([
      fetch("/api/admin/sessions", { headers }),
      fetch("/api/admin/config", { headers }),
      fetch("/api/admin/check-default", { headers }),
    ]);

    if (sessionsRes.status === 401) { handleLogout(); return; }

    if (sessionsRes.ok) {
      const body = await sessionsRes.json() as { sessions: SessionItem[]; total: number };
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
  } catch { /* 静默处理 */ }
}

// ── 会话操作 ──

async function handleTerminate(code: string): Promise<void> {
  const res = await fetch(`/api/admin/sessions/${code}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (res.ok) sessions.value = sessions.value.filter((s) => s.code !== code);
}

// ── 配置保存 ──

async function handleSaveConfig(): Promise<void> {
  if (!config.value) return;
  isSavingConfig.value = true;
  try {
    const res = await fetch("/api/admin/config", {
      method: "PUT",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(config.value),
    });
    if (res.status === 401) { handleLogout(); return; }
    if (res.ok) {
      config.value = await res.json() as AdminConfig;
      toast.success(t("admin.configSaved"));
    }
  } catch { /* 静默处理 */ } finally {
    isSavingConfig.value = false;
  }
}

// ── 工具 ──

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString(locale.value);
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "uploading": return "bg-warning/20 text-warning border-warning/20";
    case "ready": return "bg-success/20 text-success border-success/20";
    case "downloading": return "bg-accent/20 text-accent-foreground border-accent/20";
    default: return "bg-muted text-muted-foreground";
  }
}

onMounted(() => {
  if (localStorage.getItem(TOKEN_KEY)) {
    isLoggedIn.value = true;
    loadData();
  }
});
</script>

<template>
  <div class="mx-auto max-w-[720px] px-4 py-8">
    <h1 class="mb-8 text-center text-2xl font-bold">{{ $t('admin.title') }}</h1>

    <!-- 登录 -->
    <AdminLoginForm v-if="!isLoggedIn" @login-success="handleLoginSuccess" />

    <!-- 管理面板 -->
    <div v-if="isLoggedIn">
      <div class="mb-6 flex gap-3">
        <Button variant="destructive" @click="handleLogout">{{ $t('admin.logout') }}</Button>
        <Button variant="secondary" @click="loadData">{{ $t('admin.refresh') }}</Button>
      </div>

      <div
        v-if="needsPasswordChange"
        class="mb-6 rounded-lg border-2 border-destructive/30 bg-destructive/10 px-5 py-4"
      >
        <p class="font-semibold text-destructive">{{ $t('admin.forcePasswordChangeTitle') }}</p>
        <p class="mt-1 text-sm text-destructive">{{ $t('admin.forcePasswordChangeDesc') }}</p>
      </div>

      <Tabs v-model="activeTab">
        <TabsList class="mb-6 w-full">
          <TabsTrigger value="sessions" :disabled="needsPasswordChange">{{ $t('admin.tabs.sessions') }}</TabsTrigger>
          <TabsTrigger value="config" :disabled="needsPasswordChange">{{ $t('admin.tabs.siteConfig') }}</TabsTrigger>
          <TabsTrigger value="security">{{ $t('admin.tabs.security') }}</TabsTrigger>
        </TabsList>

        <!-- 会话管理 -->
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
                  variant="outline" size="sm"
                  class="border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/20"
                  @click="handleTerminate(s.code)"
                >
                  {{ $t('admin.terminate') }}
                </Button>
              </CardContent>
            </Card>
          </section>
        </TabsContent>

        <!-- 站点配置 -->
        <TabsContent value="config">
          <SiteConfigForm
            v-if="config"
            v-model:config="config"
            :is-saving="isSavingConfig"
            @save="handleSaveConfig"
          />
        </TabsContent>

        <!-- 安全设置 -->
        <TabsContent value="security">
          <PasswordChangeForm
            :is-default-pwd="isDefaultPwd"
            :auth-headers="getAuthHeaders()"
            @changed="isDefaultPwd = false; needsPasswordChange = false"
          />
        </TabsContent>
      </Tabs>
    </div>
  </div>
</template>
