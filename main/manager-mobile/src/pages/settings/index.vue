<route lang="jsonc" type="page">
{
  "layout": "default",
  "style": {
    "navigationBarTitleText": "Settings",
    "navigationStyle": "custom"
  }
}
</route>

<script lang="ts" setup>
import type { Language } from '@/store/lang'
import type { ThemeMode } from '@/store/theme'
import { computed, onMounted, reactive, ref } from 'vue'
import { useToast } from 'wot-design-uni/components/wd-toast'
import { changeLanguage, getCurrentLanguage, getSupportedLanguages, t } from '@/i18n'
import { useConfigStore, useThemeStore } from '@/store'
import { getServerBaseUrlOverride, setServerBaseUrlOverride } from '@/utils'

defineOptions({
  name: 'SettingsPage',
})

const toast = useToast()

// Cache info
const cacheInfo = reactive({
  storageSize: '0MB',
  imageCache: '0MB',
  dataCache: '0MB',
})

const configStore = useConfigStore()

// System info (reserved)
const systemInfo = computed(() => {
  const info = uni.getSystemInfoSync()
  return `${info.platform} ${info.system}`
})

// Get cache info
function getCacheInfo() {
  try {
    const info = uni.getStorageInfoSync()
    const totalSize = (info.currentSize || 0) / 1024 // KB to MB
    cacheInfo.storageSize = `${totalSize.toFixed(2)}MB`
  }
  catch (error) {
    console.error('Failed to get cache info:', error)
  }
}

// Language switch
const supportedLanguages = getSupportedLanguages()
const currentLanguage = ref<Language>(getCurrentLanguage())
const showLanguageSheet = ref(false)

function handleLanguageChange(lang: Language) {
  changeLanguage(lang)
  showLanguageSheet.value = false
  currentLanguage.value = lang
  toast.success(t('settings.languageChanged'))
}

// Theme settings
const themeStore = useThemeStore()
const showThemeSheet = ref(false)

const themeOptions = computed(() => [
  { mode: 'auto' as ThemeMode, name: t('settings.themeAuto') },
  { mode: 'light' as ThemeMode, name: t('settings.themeLight') },
  { mode: 'dark' as ThemeMode, name: t('settings.themeDark') },
])

const currentThemeLabel = computed(() => {
  const found = themeOptions.value.find(opt => opt.mode === themeStore.themeMode)
  return found ? found.name : t('settings.themeAuto')
})

function handleThemeChange(mode: ThemeMode) {
  themeStore.setThemeMode(mode)
  showThemeSheet.value = false
  toast.success(t('settings.themeChanged'))
}

// Clear all cache after switching address
function clearAllCacheAfterUrlChange() {
  try {
    // Backup runtime override URL to restore after cleanup
    const preservedOverride = getServerBaseUrlOverride()

    // Clear all cache including token
    uni.clearStorageSync()

    // Clear localStorage (H5 environment)
    // #ifdef H5
    if (typeof localStorage !== 'undefined') {
      localStorage.clear()
    }
    // #endif

    // Restore runtime override URL after cleanup
    if (preservedOverride) {
      setServerBaseUrlOverride(preservedOverride)
    }

    // Refresh cache info
    getCacheInfo()
  }
  catch (error) {
    console.error('Failed to clear cache:', error)
  }
}

// Clear cache
async function clearCache() {
  try {
    uni.showModal({
      title: t('settings.confirmClear'),
      content: t('settings.confirmClearMessage'),
      confirmText: t('common.confirm'),
      cancelText: t('common.cancel'),
      success: (res) => {
        if (res.confirm) {
          clearAllCacheAfterUrlChange()
          toast.success(t('settings.cacheCleared'))

          // Delay navigation to login page
          setTimeout(() => {
            uni.reLaunch({ url: '/pages/login/index' })
          }, 1500)
        }
      },
    })
  }
  catch (error) {
    console.error('Failed to clear cache:', error)
    toast.error(t('settings.clearCacheFailed'))
  }
}

// About us
function showAbout() {
  uni.showModal({
    title: t('settings.aboutApp', { appName: import.meta.env.VITE_APP_TITLE }),
    content: t('settings.aboutContent', {
      appName: import.meta.env.VITE_APP_TITLE,
      version: '1.0.0',
    }),
    showCancel: false,
    confirmText: t('common.confirm'),
  })
}

onMounted(async () => {
  getCacheInfo()

  // Dynamically set navbar title to i18n text
  uni.setNavigationBarTitle({
    title: t('settings.title'),
  })
})
</script>

<template>
  <view class="min-h-screen bg-[#f5f7fb]">
    <wd-navbar :title="t('settings.title')" placeholder safe-area-inset-top fixed />

    <view class="p-[24rpx]">
      <!-- Cache management -->
      <view class="mb-[32rpx]">
        <view class="mb-[24rpx] flex items-center">
          <text class="text-[32rpx] text-[#232338] font-bold">
            {{ t('settings.cacheManagement') }}
          </text>
        </view>

        <view
          class="border border-[#eeeeee] rounded-[24rpx] bg-[#fbfbfb] p-[32rpx]"
          style="box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.06);"
        >
          <view class="space-y-[16rpx]">
            <!-- Cache information display -->
            <view
              class="flex items-center justify-between border border-[#eeeeee] rounded-[16rpx] bg-[#f5f7fb] p-[24rpx] transition-all active:bg-[#eef3ff]"
            >
              <view>
                <text class="text-[28rpx] text-[#232338] font-medium">
                  {{ t('settings.totalCacheSize') }}
                </text>
                <text class="mt-[4rpx] block text-[24rpx] text-[#9d9ea3]">
                  {{ t('settings.appDataSize') }}
                </text>
              </view>
              <text class="text-[28rpx] text-[#65686f] font-semibold">
                {{ cacheInfo.storageSize }}
              </text>
            </view>

            <!-- Clear cache button -->
            <view
              class="flex items-center justify-between border border-[#eeeeee] rounded-[16rpx] bg-[#f5f7fb] p-[24rpx]"
            >
              <view>
                <text class="text-[28rpx] text-[#232338] font-medium">
                  {{ t('settings.cacheClear') }}
                </text>
                <text class="mt-[4rpx] block text-[24rpx] text-[#9d9ea3]">
                  {{ t('settings.clearAllCache') }}
                </text>
              </view>
              <view
                class="cursor-pointer rounded-[24rpx] bg-[rgba(255,107,107,0.1)] px-[28rpx] py-[16rpx] text-[24rpx] text-[#ff6b6b] font-semibold transition-all duration-300 active:scale-95 active:bg-[#ff6b6b] active:text-white"
                @click="clearCache"
              >
                {{ t('settings.clearCache') }}
              </view>
            </view>
          </view>
        </view>
      </view>

      <!-- Application info -->
      <view class="mb-[32rpx]">
        <view class="mb-[24rpx] flex items-center">
          <text class="text-[32rpx] text-[#232338] font-bold">
            {{ t('settings.appInfo') }}
          </text>
        </view>

        <view
          class="border border-[#eeeeee] rounded-[24rpx] bg-[#fbfbfb] p-[32rpx]"
          style="box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.06);"
        >
          <view
            class="flex cursor-pointer items-center justify-between border border-[#eeeeee] rounded-[16rpx] bg-[#f5f7fb] p-[24rpx] transition-all active:bg-[#eef3ff]"
            @click="showAbout"
          >
            <view>
              <text class="text-[28rpx] text-[#232338] font-medium">
                {{ t('settings.aboutUs') }}
              </text>
              <text class="mt-[4rpx] block text-[24rpx] text-[#9d9ea3]">
                {{ t('settings.appVersion') }}
              </text>
            </view>
            <wd-icon name="arrow-right" custom-class="text-[32rpx] text-[#9d9ea3]" />
          </view>
        </view>
      </view>

      <!-- Language settings -->
      <view class="mb-[32rpx]">
        <view class="mb-[24rpx] flex items-center">
          <text class="text-[32rpx] text-[#232338] font-bold">
            {{ t('settings.languageSettings') }}
          </text>
        </view>

        <view
          class="border border-[#eeeeee] rounded-[24rpx] bg-[#fbfbfb] p-[32rpx]"
          style="box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.06);"
        >
          <view
            class="flex cursor-pointer items-center justify-between border border-[#eeeeee] rounded-[16rpx] bg-[#f5f7fb] p-[24rpx] transition-all active:bg-[#eef3ff]"
            @click="showLanguageSheet = true"
          >
            <view>
              <text class="text-[32rpx] text-[#232338] font-medium">
                {{ t('settings.language') }}
              </text>
              <text class="mt-[4rpx] block text-[24rpx] text-[#9d9ea3]">
                {{ t('settings.selectLanguage') }}
              </text>
            </view>
            <view class="flex items-center">
              <text class="mr-[16rpx] text-[32rpx] text-[#9d9ea3] font-semibold">
                {{ supportedLanguages.find(lang => lang.code === currentLanguage)?.name }}
              </text>
              <wd-icon name="arrow-right" custom-class="text-[32rpx] text-[#9d9ea3]" />
            </view>
          </view>
        </view>
      </view>

      <!-- Language selection dialog -->
      <wd-action-sheet v-model="showLanguageSheet" :title="t('settings.selectLanguage')" :close-on-click-modal="true">
        <view class="language-sheet">
          <scroll-view scroll-y class="language-list">
            <view
              v-for="lang in supportedLanguages" :key="lang.code" class="language-item"
              @click="handleLanguageChange(lang.code)"
            >
              <text class="language-name">
                {{ lang.name }}
              </text>
            </view>
          </scroll-view>
        </view>
      </wd-action-sheet>

      <!-- Theme settings -->
      <view class="mb-[32rpx]">
        <view class="mb-[24rpx] flex items-center">
          <text class="text-[32rpx] text-[#232338] font-bold">
            {{ t('settings.themeSettings') }}
          </text>
        </view>

        <view
          class="border border-[#eeeeee] rounded-[24rpx] bg-[#fbfbfb] p-[32rpx]"
          style="box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.06);"
        >
          <view
            class="flex cursor-pointer items-center justify-between border border-[#eeeeee] rounded-[16rpx] bg-[#f5f7fb] p-[24rpx] transition-all active:bg-[#eef3ff]"
            @click="showThemeSheet = true"
          >
            <view>
              <text class="text-[32rpx] text-[#232338] font-medium">
                {{ t('settings.theme') }}
              </text>
              <text class="mt-[4rpx] block text-[24rpx] text-[#9d9ea3]">
                {{ t('settings.selectTheme') }}
              </text>
            </view>
            <view class="flex items-center">
              <text class="mr-[16rpx] text-[32rpx] text-[#9d9ea3] font-semibold">
                {{ currentThemeLabel }}
              </text>
              <wd-icon name="arrow-right" custom-class="text-[32rpx] text-[#9d9ea3]" />
            </view>
          </view>
        </view>
      </view>

      <!-- Theme selection dialog -->
      <wd-action-sheet v-model="showThemeSheet" :title="t('settings.selectTheme')" :close-on-click-modal="true">
        <view class="language-sheet">
          <scroll-view scroll-y class="language-list">
            <view
              v-for="item in themeOptions" :key="item.mode" class="language-item"
              @click="handleThemeChange(item.mode)"
            >
              <text class="language-name" :class="{ 'text-[#336cff] font-semibold': themeStore.themeMode === item.mode }">
                {{ item.name }}
              </text>
            </view>
          </scroll-view>
        </view>
      </wd-action-sheet>

      <!-- Bottom safe area padding -->
      <!-- Bottom safe area padding -->
      <view style="height: env(safe-area-inset-bottom);" />
    </view>
  </view>
</template>

<style lang="scss" scoped>
// Consistent styles with edit.vue

// Language selection dialog styles
.language-sheet {
  .language-list {
    max-height: 50vh;

    .language-item {
      padding: 30rpx 0;
      text-align: center;
      border-bottom: 1rpx solid #f0f0f0;

      .language-name {
        font-size: 28rpx;
        color: #333;
      }

      &:last-child {
        border-bottom: none;
      }

      &:active {
        background-color: #f5f7fb;
      }
    }
  }
}
</style>
