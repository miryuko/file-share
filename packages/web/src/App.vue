<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div class="app">
    <header class="app-header">
      <nav class="nav">
        <RouterLink to="/" class="nav-link">发送</RouterLink>
        <RouterLink to="/receive" class="nav-link">接收</RouterLink>
      </nav>
    </header>

    <main class="app-main">
      <RouterView />
    </main>

    <footer class="app-footer">
      <p>文件在服务器保留 1 小时后自动删除 · 端到端加密传输</p>
    </footer>
  </div>
</template>

<style>
/* 全局重置 */
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
    'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #1f2937;
  background: #ffffff;
  min-height: 100vh;
}

.app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.app-header {
  border-bottom: 1px solid #e5e7eb;
  padding: 0 1rem;
}

.nav {
  max-width: 480px;
  margin: 0 auto;
  display: flex;
  gap: 0;
}

.nav-link {
  padding: 0.75rem 1.25rem;
  text-decoration: none;
  color: #6b7280;
  font-size: 0.95rem;
  font-weight: 500;
  border-bottom: 2px solid transparent;
  transition: color 0.2s, border-color 0.2s;
}

.nav-link:hover {
  color: #374151;
}

.nav-link.router-link-exact-active {
  color: #4a90d9;
  border-bottom-color: #4a90d9;
}

.app-main {
  flex: 1;
}

.app-footer {
  text-align: center;
  padding: 1.5rem 1rem;
  font-size: 0.75rem;
  color: #9ca3af;
  border-top: 1px solid #f3f4f6;
}
</style>
