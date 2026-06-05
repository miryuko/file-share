<script setup lang="ts">
import { ref, onMounted } from "vue";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { Badge } from "../components/ui/badge";

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
}

const sessions = ref<SessionItem[]>([]);
const config = ref<AdminConfig | null>(null);

async function handleLogin(): Promise<void> {
  isLoading.value = true;
  loginError.value = "";

  try {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: password.value }),
    });

    if (!res.ok) {
      const body = await res.json();
      loginError.value = body.message || "登录失败";
      return;
    }

    const { token } = (await res.json()) as { token: string };
    localStorage.setItem(TOKEN_KEY, token);
    isLoggedIn.value = true;
    await loadData();
  } catch {
    loginError.value = "网络异常，请检查连接";
  } finally {
    isLoading.value = false;
  }
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function loadData(): Promise<void> {
  const headers = getAuthHeaders();
  try {
    const [sessionsRes, configRes] = await Promise.all([
      fetch("/api/admin/sessions", { headers }),
      fetch("/api/admin/config", { headers }),
    ]);

    if (sessionsRes.status === 401) {
      isLoggedIn.value = false;
      localStorage.removeItem(TOKEN_KEY);
      return;
    }

    if (sessionsRes.ok) {
      const body = (await sessionsRes.json()) as {
        sessions: SessionItem[];
        total: number;
      };
      sessions.value = body.sessions;
    }

    if (configRes.ok) {
      config.value = (await configRes.json()) as AdminConfig;
    }
  } catch {
    // 加载失败静默处理
  }
}

async function handleTerminate(code: string): Promise<void> {
  const res = await fetch(`/api/admin/sessions/${code}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (res.ok) {
    sessions.value = sessions.value.filter((s) => s.code !== code);
  }
}

function handleLogout(): void {
  localStorage.removeItem(TOKEN_KEY);
  isLoggedIn.value = false;
  sessions.value = [];
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString("zh-CN");
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "uploading": return "bg-amber-100 text-amber-800 border-amber-200";
    case "ready": return "bg-green-100 text-green-800 border-green-200";
    case "downloading": return "bg-blue-100 text-blue-800 border-blue-200";
    default: return "bg-gray-100 text-gray-600";
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
    <h1 class="mb-8 text-center text-2xl font-bold">管理面板</h1>

    <!-- 登录表单 -->
    <div v-if="!isLoggedIn" class="mx-auto mt-8 max-w-[360px]">
      <div class="flex gap-3">
        <Input
          v-model="password"
          type="password"
          placeholder="请输入管理员密码"
          class="flex-1"
          @keyup.enter="handleLogin"
        />
        <Button :disabled="!password || isLoading" @click="handleLogin">
          {{ isLoading ? "登录中..." : "登录" }}
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
    <div v-if="isLoggedIn" class="dashboard">
      <div class="mb-8 flex gap-3">
        <Button variant="destructive" @click="handleLogout">退出登录</Button>
        <Button variant="secondary" @click="loadData">刷新</Button>
      </div>

      <!-- 活跃传输 -->
      <section>
        <h2 class="mb-4 text-lg font-semibold">活跃传输 ({{ sessions.length }})</h2>
        <p v-if="sessions.length === 0" class="italic text-gray-400">暂无活跃传输</p>
        <Card v-for="s in sessions" :key="s.code" class="mb-3">
          <CardHeader class="pb-0">
            <div class="flex items-center gap-3">
              <span class="font-mono text-lg font-bold">{{ s.code }}</span>
              <Badge variant="outline" :class="statusBadgeClass(s.status)">{{ s.status }}</Badge>
              <span class="ml-auto text-xs text-gray-400">{{ s.creatorIP }}</span>
            </div>
          </CardHeader>
          <CardContent class="pt-3">
            <div class="mb-2">
              <p v-for="f in s.files" :key="f.fileId" class="text-sm text-gray-600">
                {{ f.filename }} ({{ formatSize(f.size) }})
              </p>
            </div>
            <div class="mb-3 flex flex-wrap gap-4 text-xs text-gray-400">
              <span>总大小: {{ formatSize(s.totalSize) }}</span>
              <span>下载: {{ s.downloadCount }}/{{ s.maxDownloads }}</span>
              <span>创建: {{ formatTime(s.createdAt) }}</span>
              <span>过期: {{ formatTime(s.expiresAt) }}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              class="border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
              @click="handleTerminate(s.code)"
            >
              强制终止
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  </div>
</template>
