<script setup lang="ts">
import { computed } from 'vue'
import { Sun, Moon } from 'lucide-vue-next'
import { useColorMode } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const { t } = useI18n()
const mode = useColorMode()

// mode.store holds the raw value ('light'|'dark'|'auto') without resolving 'auto' to system preference.
// We bind v-model to mode.store so the RadioGroup can properly match all three options.
const stored = mode.store

const modeLabel = computed(() => {
  const map: Record<string, string> = {
    light: t('app.theme.light'),
    dark: t('app.theme.dark'),
    auto: t('app.theme.system'),
  }
  return map[stored.value] || stored.value
})
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger
      class="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-muted-foreground outline-none hover:bg-accent focus:bg-accent"
    >
      <Sun class="size-4 block dark:hidden" />
      <Moon class="size-4 hidden dark:block" />
      <span class="hidden sm:inline">{{ modeLabel }}</span>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuRadioGroup v-model="stored">
        <DropdownMenuRadioItem value="light">
          {{ t('app.theme.light') }}
        </DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="dark">
          {{ t('app.theme.dark') }}
        </DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="auto">
          {{ t('app.theme.system') }}
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
