import { createI18n } from 'vue-i18n'
import zhCN from './locales/zh-CN.json'
import zhTW from './locales/zh-TW.json'
import en from './locales/en.json'
import ja from './locales/ja.json'
import ko from './locales/ko.json'
import es from './locales/es.json'
import fr from './locales/fr.json'
import de from './locales/de.json'
import pt from './locales/pt.json'
import ru from './locales/ru.json'
import ar from './locales/ar.json'

const prefixMap: Record<string, string> = {
  ja: 'ja',
  ko: 'ko',
  es: 'es',
  fr: 'fr',
  de: 'de',
  pt: 'pt',
  ru: 'ru',
  ar: 'ar',
}

const zhTraditional = new Set(['zh-TW', 'zh-HK', 'zh-MO', 'zh-Hant'])

function detectLocale(): string {
  const navLang = navigator.language

  if (zhTraditional.has(navLang)) return 'zh-TW'
  if (navLang.startsWith('zh')) return 'zh-CN'

  const prefix = navLang.split('-')[0] ?? ''
  return prefixMap[prefix] ?? 'en'
}

const i18n = createI18n({
  legacy: false,
  locale: detectLocale(),
  fallbackLocale: 'en',
  messages: {
    'zh-CN': zhCN,
    'zh-TW': zhTW,
    en,
    ja,
    ko,
    es,
    fr,
    de,
    pt,
    ru,
    ar,
  },
})

export default i18n
