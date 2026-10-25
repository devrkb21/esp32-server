import type { Language } from '@/store/lang'
import { ref } from 'vue'
import { normalizeLanguage, useLangStore } from '@/store/lang'

import bn from './bn'
import en from './en'

// The app speaks Bangla and English only (like manager-web).
const base: Record<string, Record<string, string>> = {
  bn,
  en,
}

// Each page keeps its new strings in src/i18n/pages/<page>.ts, exporting
// { bn: {...}, en: {...} }, so page work never edits the shared locale files. Tables of other
// languages a page file may still carry are ignored.
const pageFiles = import.meta.glob('./pages/*.ts', { eager: true }) as Record<string, { default: Record<string, Record<string, string>> }>
const messages: Record<string, Record<string, string>> = {}
for (const [code, table] of Object.entries(base)) messages[code] = { ...table }
for (const mod of Object.values(pageFiles)) {
  for (const [code, table] of Object.entries(mod.default || {})) {
    if (base[code])
      messages[code] = { ...(messages[code] || {}), ...table }
  }
}

// Current active language
const currentLang = ref<Language>('bn')

// Initialize language
export function initI18n() {
  const langStore = useLangStore()
  currentLang.value = normalizeLanguage(langStore.currentLang)
}

// Switch language
export function changeLanguage(lang: Language) {
  const code = normalizeLanguage(lang)
  currentLang.value = code
  const langStore = useLangStore()
  langStore.changeLang(code)
}

// Get translated text
export function t(key: string, params?: Record<string, string | number>): string {
  const langMessages = (key in (messages[currentLang.value] || {})) ? messages[currentLang.value] : messages.en

  // Look up flat keys directly
  if (langMessages && typeof langMessages === 'object' && key in langMessages) {
    const value = langMessages[key]
    if (typeof value === 'string') {
      // Handle parameter replacement
      if (params) {
        let result = value
        Object.entries(params).forEach(([paramKey, paramValue]) => {
          const regex = new RegExp(`\\{${paramKey}\\}`, 'g')
          result = result.replace(regex, String(paramValue))
        })
        return result
      }
      return value
    }
    return key
  }

  return key // Return the key itself if no translation is found
}

// Get current language
export function getCurrentLanguage(): Language {
  return currentLang.value
}

// Get supported language list
export function getSupportedLanguages(): { code: Language, name: string }[] {
  return [
    { code: 'bn', name: 'বাংলা' },
    { code: 'en', name: 'English' },
  ]
}
