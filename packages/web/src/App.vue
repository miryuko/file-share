<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <header class="border-b px-4">
      <nav class="mx-auto flex max-w-[480px]">
        <RouterLink
          to="/"
          class="border-b-2 border-transparent px-5 py-3 text-sm font-medium text-gray-500 no-underline transition-colors hover:text-gray-700 [&.router-link-exact-active]:border-blue-500 [&.router-link-exact-active]:text-blue-500"
        >
          发送
        </RouterLink>
        <RouterLink
          to="/receive"
          class="border-b-2 border-transparent px-5 py-3 text-sm font-medium text-gray-500 no-underline transition-colors hover:text-gray-700 [&.router-link-exact-active]:border-blue-500 [&.router-link-exact-active]:text-blue-500"
        >
          接收
        </RouterLink>
      </nav>
    </header>

    <main class="flex-1">
      <RouterView />
    </main>

    <footer class="border-t px-4 py-6 text-center text-xs text-gray-400">
      <p>文件在服务器保留 1 小时后自动删除 · 端到端加密传输</p>
    </footer>
  </div>
</template>
