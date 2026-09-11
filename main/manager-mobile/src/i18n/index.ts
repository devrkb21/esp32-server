import type { Language } from '@/store/lang'
import { ref } from 'vue'
import { useLangStore } from '@/store/lang'

import de from './de'
import en from './en'
import pt_BR from './pt_BR'
import vi from './vi'
// Import translation files for each language
import zh_CN from './zh_CN'
import zh_TW from './zh_TW'

// Language pack mapping
const messages = {
  zh_CN,
  en,
  zh_TW,
  de,
  vi,
  pt_BR,
}

// Current active language
const currentLang = ref<Language>('en')

// Initialize language
export function initI18n() {
  const langStore = useLangStore()
  currentLang.value = langStore.currentLang
}

// Switch language
export function changeLanguage(lang: Language) {
  currentLang.value = lang
  const langStore = useLangStore()
  langStore.changeLang(lang)
}

// Get translated text
export function t(key: string, params?: Record<string, string | number>): string {
  const langMessages = messages[currentLang.value]

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
    { code: 'zh_CN', name: 'Chinese (Simplified)' },
    { code: 'en', name: 'English' },
    { code: 'zh_TW', name: 'Chinese (Traditional)' },
    { code: 'de', name: 'German' },
    { code: 'vi', name: 'Vietnamese' },
    { code: 'pt_BR', name: 'Portuguese (Brazil)' },
  ]
}
