import type { Ref } from 'vue'
import { defineStore } from 'pinia'
import { ref } from 'vue'

// The app speaks Bangla and English only
export type Language = 'bn' | 'en'

// A saved choice of any other (older) language falls back to Bangla.
export function normalizeLanguage(value: unknown): Language {
  return value === 'en' ? 'en' : 'bn'
}

export interface LangStore {
  currentLang: Ref<Language>
  changeLang: (lang: Language) => void
}

export const useLangStore = defineStore(
  'lang',
  (): LangStore => {
    // Get language setting from local storage, or use default
    const currentLang = ref<Language>(normalizeLanguage(uni.getStorageSync('app_language')))

    // Switch language
    const changeLang = (lang: Language) => {
      const code = normalizeLanguage(lang)
      currentLang.value = code
      // Save language setting to local storage
      uni.setStorageSync('app_language', code)
    }

    return {
      currentLang,
      changeLang,
    }
  },
  {
    persist: {
      key: 'lang',
      serializer: {
        serialize: state => JSON.stringify(state.currentLang),
        deserialize: (value) => {
          let saved: unknown = null
          try {
            saved = JSON.parse(value)
          }
          catch {}
          return { currentLang: normalizeLanguage(saved) }
        },
      },
    },
  },
)
