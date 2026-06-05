<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { RouterLink, RouterView } from 'vue-router'
import { Globe } from 'lucide-vue-next'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const { locale } = useI18n()

interface LocaleOption {
  code: string
  nativeName: string
}

const locales: LocaleOption[] = [
  { code: 'zh-CN', nativeName: '简体中文' },
  { code: 'zh-TW', nativeName: '繁體中文' },
  { code: 'en', nativeName: 'English' },
  { code: 'ja', nativeName: '日本語' },
  { code: 'ko', nativeName: '한국어' },
  { code: 'es', nativeName: 'Español' },
  { code: 'fr', nativeName: 'Français' },
  { code: 'de', nativeName: 'Deutsch' },
  { code: 'pt', nativeName: 'Português' },
  { code: 'ru', nativeName: 'Русский' },
  { code: 'ar', nativeName: 'العربية' },
]

function switchLocale(code: string): void {
  locale.value = code
}

function currentNativeName(): string {
  return locales.find(l => l.code === locale.value)?.nativeName || locale.value
}
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <header class="border-b px-4">
      <nav class="mx-auto flex max-w-[480px] items-center">
        <RouterLink
          to="/"
          class="border-b-2 border-transparent px-5 py-3 text-sm font-medium text-gray-500 no-underline transition-colors hover:text-gray-700 [&.router-link-exact-active]:border-blue-500 [&.router-link-exact-active]:text-blue-500"
        >
          {{ $t('app.nav.send') }}
        </RouterLink>
        <RouterLink
          to="/receive"
          class="border-b-2 border-transparent px-5 py-3 text-sm font-medium text-gray-500 no-underline transition-colors hover:text-gray-700 [&.router-link-exact-active]:border-blue-500 [&.router-link-exact-active]:text-blue-500"
        >
          {{ $t('app.nav.receive') }}
        </RouterLink>

        <!-- Language Switcher -->
        <div class="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger class="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-gray-500 outline-none hover:bg-gray-100 focus:bg-gray-100">
              <Globe class="size-4" />
              <span class="hidden sm:inline">{{ currentNativeName() }}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="w-40">
              <DropdownMenuLabel>{{ $t('app.nav.language') }}</DropdownMenuLabel>
              <DropdownMenuItem
                v-for="item in locales"
                :key="item.code"
                :class="{ 'bg-accent text-accent-foreground': locale === item.code }"
                @click="switchLocale(item.code)"
              >
                {{ item.nativeName }}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>
    </header>

    <main class="flex-1">
      <RouterView />
    </main>

    <footer class="border-t px-4 py-6 text-center text-xs text-gray-400">
      <p>{{ $t('app.footer.notice') }}</p>
    </footer>
  </div>
</template>
