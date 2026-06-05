<script setup lang="ts">
import { ref, onMounted } from "vue";

/** JWT token 存储 */
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

onMounted(() => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    isLoggedIn.value = true;
    loadData();
  }
});
</script>

<template>
  <div class="admin-page">
    <h1 class="title">管理面板</h1>

    <!-- 登录表单 -->
    <div v-if="!isLoggedIn" class="login-section">
      <div class="login-form">
        <input
          v-model="password"
          type="password"
          class="password-input"
          placeholder="请输入管理员密码"
          @keyup.enter="handleLogin"
        />
        <button
          class="btn btn-login"
          :disabled="!password || isLoading"
          @click="handleLogin"
        >
          {{ isLoading ? "登录中..." : "登录" }}
        </button>
      </div>
      <div v-if="loginError" class="error-message">{{ loginError }}</div>
    </div>

    <!-- 管理面板内容 -->
    <div v-if="isLoggedIn" class="dashboard">
      <div class="toolbar">
        <button class="btn btn-logout" @click="handleLogout">退出登录</button>
        <button class="btn btn-refresh" @click="loadData">刷新</button>
      </div>

      <!-- 活跃传输 -->
      <section class="section">
        <h2>活跃传输 ({{ sessions.length }})</h2>
        <div v-if="sessions.length === 0" class="empty">暂无活跃传输</div>
        <div v-for="s in sessions" :key="s.code" class="session-card">
          <div class="session-header">
            <span class="session-code">{{ s.code }}</span>
            <span class="session-status" :class="s.status">{{ s.status }}</span>
            <span class="session-ip">{{ s.creatorIP }}</span>
          </div>
          <div class="session-files">
            <div v-for="f in s.files" :key="f.fileId" class="session-file">
              {{ f.filename }} ({{ formatSize(f.size) }})
            </div>
          </div>
          <div class="session-meta">
            <span>总大小: {{ formatSize(s.totalSize) }}</span>
            <span>下载: {{ s.downloadCount }}/{{ s.maxDownloads }}</span>
            <span>创建: {{ formatTime(s.createdAt) }}</span>
            <span>过期: {{ formatTime(s.expiresAt) }}</span>
          </div>
          <button class="btn btn-terminate" @click="handleTerminate(s.code)">
            强制终止
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.admin-page {
  max-width: 720px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.title {
  font-size: 1.75rem;
  font-weight: 700;
  margin-bottom: 2rem;
  text-align: center;
}

.login-section {
  max-width: 360px;
  margin: 2rem auto;
}

.login-form {
  display: flex;
  gap: 0.75rem;
}

.password-input {
  flex: 1;
  padding: 0.75rem 1rem;
  font-size: 1rem;
  border: 2px solid #ddd;
  border-radius: 8px;
  outline: none;
}

.password-input:focus {
  border-color: #4a90d9;
}

.btn {
  padding: 0.625rem 1.25rem;
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  cursor: pointer;
}

.btn-login {
  background: #4a90d9;
  color: white;
}

.btn-login:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error-message {
  margin-top: 1rem;
  padding: 0.75rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  color: #dc2626;
}

.toolbar {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 2rem;
}

.btn-logout {
  background: #ef4444;
  color: white;
}

.btn-refresh {
  background: #f3f4f6;
  color: #374151;
}

.section {
  margin-bottom: 2rem;
}

.section h2 {
  font-size: 1.25rem;
  margin-bottom: 1rem;
}

.empty {
  color: #999;
  font-style: italic;
}

.session-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 0.75rem;
}

.session-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.session-code {
  font-weight: 700;
  font-family: monospace;
  font-size: 1.1rem;
}

.session-status {
  font-size: 0.75rem;
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
  background: #e5e7eb;
}

.session-status.uploading {
  background: #fef3c7;
  color: #92400e;
}

.session-status.ready {
  background: #d1fae5;
  color: #065f46;
}

.session-status.downloading {
  background: #dbeafe;
  color: #1e40af;
}

.session-ip {
  margin-left: auto;
  font-size: 0.8rem;
  color: #999;
}

.session-files {
  margin-bottom: 0.5rem;
}

.session-file {
  font-size: 0.85rem;
  color: #666;
}

.session-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  font-size: 0.8rem;
  color: #999;
  margin-bottom: 0.75rem;
}

.btn-terminate {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

.btn-terminate:hover {
  background: #fee2e2;
}
</style>
