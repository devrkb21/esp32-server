import type { Ref } from 'vue'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export type ThemeMode = 'light' | 'dark' | 'auto'
export type ActiveTheme = 'light' | 'dark'

export interface ThemeStore {
  themeMode: Ref<ThemeMode>
  currentTheme: Ref<ActiveTheme>
  setThemeMode: (mode: ThemeMode) => void
}

function getSystemTheme(): ActiveTheme {
  try {
    // #ifdef H5
    if (typeof window !== 'undefined' && window.matchMedia) {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark'
      }
    }
    // #endif

    const sys = uni.getSystemInfoSync()
    if (sys.osTheme === 'dark' || (sys as any).hostTheme === 'dark') {
      return 'dark'
    }
  }
  catch (e) {
    console.warn('Failed to detect system theme:', e)
  }
  return 'light'
}

export const useThemeStore = defineStore(
  'theme',
  (): ThemeStore => {
    const savedMode = uni.getStorageSync('app_theme_mode') as ThemeMode | null
    const themeMode = ref<ThemeMode>(savedMode || 'auto')
    const systemTheme = ref<ActiveTheme>(getSystemTheme())

    // Listen to system theme change
    try {
      if (uni.onThemeChange) {
        uni.onThemeChange((res) => {
          if (res?.theme === 'dark') {
            systemTheme.value = 'dark'
          }
          else if (res?.theme === 'light') {
            systemTheme.value = 'light'
          }
        })
      }
    }
    catch (e) {
      console.warn('uni.onThemeChange not supported:', e)
    }

    const currentTheme = computed<ActiveTheme>(() => {
      if (themeMode.value === 'auto') {
        return systemTheme.value
      }
      return themeMode.value
    })

    const setThemeMode = (mode: ThemeMode) => {
      themeMode.value = mode
      uni.setStorageSync('app_theme_mode', mode)

      // #ifdef H5
      if (typeof document !== 'undefined') {
        if (currentTheme.value === 'dark') {
          document.documentElement.classList.add('dark')
          document.body.classList.add('dark')
        }
        else {
          document.documentElement.classList.remove('dark')
          document.body.classList.remove('dark')
        }
      }
      // #endif
    }

    return {
      themeMode,
      currentTheme,
      setThemeMode,
    }
  },
  {
    persist: {
      key: 'theme',
      serializer: {
        serialize: state => JSON.stringify(state.themeMode),
        deserialize: value => ({ themeMode: JSON.parse(value) }),
      },
    },
  },
)
