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
import ModeToggle from '@/components/ModeToggle.vue'

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
          class="border-b-2 border-transparent px-5 py-3 text-sm font-medium text-muted-foreground no-underline transition-colors hover:text-foreground [&.router-link-exact-active]:border-primary [&.router-link-exact-active]:text-primary"
        >
          {{ $t('app.nav.send') }}
        </RouterLink>
        <RouterLink
          to="/receive"
          class="border-b-2 border-transparent px-5 py-3 text-sm font-medium text-muted-foreground no-underline transition-colors hover:text-foreground [&.router-link-exact-active]:border-primary [&.router-link-exact-active]:text-primary"
        >
          {{ $t('app.nav.receive') }}
        </RouterLink>

        <!-- Theme Toggle + Language Switcher -->
        <div class="ml-auto flex items-center gap-1">
          <ModeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger class="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-muted-foreground outline-none hover:bg-accent focus:bg-accent">
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

    <footer class="border-t px-4 py-6 text-center text-xs text-muted-foreground">
      <p>{{ $t('app.footer.notice') }}</p>
    </footer>
  </div>
</template>
