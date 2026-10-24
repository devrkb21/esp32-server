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
import { useMessage } from 'wot-design-uni/components/wd-message-box'
import { useToast } from 'wot-design-uni/components/wd-toast'
import { changeLanguage, getCurrentLanguage, getSupportedLanguages, t } from '@/i18n'
import { useConfigStore, useThemeStore, useUserStore } from '@/store'
import { clearServerBaseUrlOverride, getEnvBaseUrl, getServerBaseUrlOverride, setServerBaseUrlOverride } from '@/utils'

defineOptions({
  name: 'SettingsPage',
})

const toast = useToast()
const message = useMessage()

// App version shown in About (same value the About dialog has always used)
const APP_VERSION = '1.0.0'

// Cache info
const cacheInfo = reactive({
  storageSize: '0MB',
  imageCache: '0MB',
  dataCache: '0MB',
})

const configStore = useConfigStore()
const userStore = useUserStore()

// System info (reserved)
const systemInfo = computed(() => {
  const info = uni.getSystemInfoSync()
  return `${info.platform} ${info.system}`
})

// Safe area for the custom large title
const safeTop = (uni.getSystemInfoSync().safeAreaInsets?.top) || 0

// Pending copy (src/i18n/_pending/mobile-home-agents.ts): English fallback until merged
function tx(key: string, fallback: string) {
  const value = t(key)
  return value === key ? fallback : value
}

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

// ---- Account
const isSignedIn = computed(() => Boolean(uni.getStorageSync('token')) && Boolean(userStore.userInfo?.username))
const accountName = computed(() => userStore.userInfo?.realName || userStore.userInfo?.username || '')
const accountDetail = computed(() => {
  const info = userStore.userInfo
  if (!info)
    return ''
  return info.mobile || info.email || (info.realName ? info.username : '') || ''
})
const accountInitial = computed(() => {
  const name = accountName.value.trim()
  return name ? Array.from(name)[0].toUpperCase() : '?'
})

function goToLogin() {
  uni.reLaunch({ url: '/pages/login/index' })
}

function handleSignOut() {
  message
    .confirm({
      title: tx('settings.signOutTitle', 'Sign out?'),
      msg: tx('settings.signOutMessage', 'You’ll need to sign in again to manage your robots.'),
      confirmButtonText: tx('settings.signOut', 'Sign out'),
      cancelButtonText: t('common.cancel'),
    })
    .then(async () => {
      await userStore.logout()
      uni.reLaunch({ url: '/pages/login/index' })
    })
    .catch(() => {})
}

// ---- Language switch
const supportedLanguages = getSupportedLanguages()
const currentLanguage = ref<Language>(getCurrentLanguage())
const showLanguageSheet = ref(false)
const currentLanguageName = computed(() => supportedLanguages.find(lang => lang.code === currentLanguage.value)?.name || '')

function handleLanguageChange(lang: Language) {
  changeLanguage(lang)
  showLanguageSheet.value = false
  currentLanguage.value = lang
  toast.success(t('settings.languageChanged'))
}

// ---- Theme settings (segmented: auto / light / dark)
const themeStore = useThemeStore()

const themeOptions = computed(() => [
  { mode: 'auto' as ThemeMode, name: tx('settings.themeAutoShort', 'Auto'), fullName: t('settings.themeAuto') },
  { mode: 'light' as ThemeMode, name: tx('settings.themeLightShort', 'Light'), fullName: t('settings.themeLight') },
  { mode: 'dark' as ThemeMode, name: tx('settings.themeDarkShort', 'Dark'), fullName: t('settings.themeDark') },
])

function handleThemeChange(mode: ThemeMode) {
  if (themeStore.themeMode === mode)
    return
  themeStore.setThemeMode(mode)
  toast.success(t('settings.themeChanged'))
}

// ---- Server address
const currentServerUrl = ref(getEnvBaseUrl())
const isCustomServer = ref(Boolean(getServerBaseUrlOverride()))
const showServerSheet = ref(false)
const serverDraft = ref('')
const serverError = ref('')

function openServerSheet() {
  serverDraft.value = currentServerUrl.value
  serverError.value = ''
  showServerSheet.value = true
}

function isValidServerUrl(url: string) {
  return /^https?:\/\/\S+$/i.test(url)
}

function restartToLogin() {
  setTimeout(() => {
    uni.reLaunch({ url: '/pages/login/index' })
  }, 1500)
}

function saveServerUrl() {
  const url = serverDraft.value.trim().replace(/\/+$/, '')
  if (!url) {
    serverError.value = t('settings.enterServerUrl')
    return
  }
  if (!isValidServerUrl(url)) {
    serverError.value = t('settings.validServerUrl')
    return
  }
  setServerBaseUrlOverride(url)
  clearAllCacheAfterUrlChange()
  currentServerUrl.value = getEnvBaseUrl()
  isCustomServer.value = true
  showServerSheet.value = false
  toast.success(t('settings.serverUrlSavedAndCacheCleared'))
  restartToLogin()
}

function resetServerUrl() {
  clearServerBaseUrlOverride()
  clearAllCacheAfterUrlChange()
  currentServerUrl.value = getEnvBaseUrl()
  isCustomServer.value = false
  showServerSheet.value = false
  toast.success(t('settings.resetToDefaultAndCacheCleared'))
  restartToLogin()
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
      version: APP_VERSION,
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
  <view class="nx-page settings" :style="{ paddingTop: `${safeTop}px` }">
    <view class="nx-large-title settings__title">
      <view class="nx-large-title__title">
        {{ t('settings.title') }}
      </view>
    </view>

    <!-- Account -->
    <view class="nx-group">
      <view class="nx-group__header">
        {{ tx('settings.account', 'Account') }}
      </view>
      <view class="nx-group__body">
        <view v-if="isSignedIn" class="nx-row settings-account">
          <view class="settings-account__avatar">
            {{ accountInitial }}
          </view>
          <view class="nx-row__main">
            <view class="nx-row__title nx-truncate settings-account__name">
              {{ accountName }}
            </view>
            <view v-if="accountDetail" class="nx-truncate nx-row__subtitle">
              {{ accountDetail }}
            </view>
          </view>
        </view>
        <view v-else class="nx-row nx-row--tap" @click="goToLogin">
          <view class="nx-icon-tile nx-icon-tile--neutral settings-icon">
            <wd-icon name="user" size="18px" />
          </view>
          <view class="nx-row__main">
            <view class="nx-row__title settings-link">
              {{ t('login.loginButton') }}
            </view>
          </view>
          <wd-icon name="arrow-right" size="14px" custom-class="settings-chevron" />
        </view>
      </view>
    </view>

    <!-- Appearance -->
    <view class="nx-group">
      <view class="nx-group__header">
        {{ t('settings.themeSettings') }}
      </view>
      <view class="nx-group__body settings-appearance">
        <view class="nx-segmented" role="radiogroup" :aria-label="t('settings.theme')">
          <view
            v-for="item in themeOptions"
            :key="item.mode"
            class="nx-segmented__item"
            :class="{ 'is-active': themeStore.themeMode === item.mode }"
            role="radio"
            :aria-checked="themeStore.themeMode === item.mode"
            :aria-label="item.fullName"
            @click="handleThemeChange(item.mode)"
          >
            {{ item.name }}
          </view>
        </view>
      </view>
      <view class="nx-group__footer">
        {{ tx('settings.themeFooter', 'Auto follows your phone’s light or dark setting.') }}
      </view>
    </view>

    <!-- General -->
    <view class="nx-group">
      <view class="nx-group__header">
        {{ tx('settings.general', 'General') }}
      </view>
      <view class="nx-group__body">
        <view class="nx-row nx-row--tap" @click="showLanguageSheet = true">
          <view class="nx-icon-tile settings-icon">
            <wd-icon name="translate-bold" size="18px" />
          </view>
          <view class="nx-row__main">
            <view class="nx-row__title">
              {{ t('settings.language') }}
            </view>
          </view>
          <text class="nx-row__value nx-truncate">
            {{ currentLanguageName }}
          </text>
          <wd-icon name="arrow-right" size="14px" custom-class="settings-chevron" />
        </view>

        <view class="nx-row nx-row--tap" @click="openServerSheet">
          <view class="nx-icon-tile settings-icon">
            <wd-icon name="link" size="18px" />
          </view>
          <view class="nx-row__main">
            <view class="nx-row__title">
              {{ t('settings.serverApiUrl') }}
            </view>
            <view class="nx-row__subtitle nx-mono nx-break">
              {{ currentServerUrl }}
            </view>
          </view>
          <wd-icon name="arrow-right" size="14px" custom-class="settings-chevron" />
        </view>
      </view>
    </view>

    <!-- Storage -->
    <view class="nx-group">
      <view class="nx-group__header">
        {{ t('settings.cacheManagement') }}
      </view>
      <view class="nx-group__body">
        <view class="nx-row">
          <view class="nx-row__main">
            <view class="nx-row__title">
              {{ t('settings.totalCacheSize') }}
            </view>
          </view>
          <text class="nx-row__value nx-num">
            {{ cacheInfo.storageSize }}
          </text>
        </view>
        <view class="nx-row nx-row--tap" @click="clearCache">
          <view class="nx-row__main">
            <view class="nx-row__title settings-link">
              {{ t('settings.clearCache') }}
            </view>
          </view>
        </view>
      </view>
      <view class="nx-group__footer">
        {{ t('settings.confirmClearMessage') }}
      </view>
    </view>

    <!-- About -->
    <view class="nx-group">
      <view class="nx-group__header">
        {{ t('settings.appInfo') }}
      </view>
      <view class="nx-group__body">
        <view class="nx-row nx-row--tap" @click="showAbout">
          <view class="nx-row__main">
            <view class="nx-row__title">
              {{ t('settings.aboutUs') }}
            </view>
          </view>
          <wd-icon name="arrow-right" size="14px" custom-class="settings-chevron" />
        </view>
        <view class="nx-row">
          <view class="nx-row__main">
            <view class="nx-row__title">
              {{ tx('settings.version', 'Version') }}
            </view>
          </view>
          <text class="nx-row__value nx-mono">
            {{ APP_VERSION }}
          </text>
        </view>
      </view>
    </view>

    <!-- Sign out -->
    <view v-if="isSignedIn" class="nx-group">
      <view class="nx-group__body">
        <view class="nx-row nx-row--tap settings-signout" role="button" @click="handleSignOut">
          {{ tx('settings.signOut', 'Sign out') }}
        </view>
      </view>
    </view>

    <!-- Language sheet -->
    <wd-popup
      v-model="showLanguageSheet"
      position="bottom"
      custom-class="nx-sheet"
      safe-area-inset-bottom
    >
      <view class="nx-sheet__inner">
        <view class="nx-sheet__handle" />
        <view class="nx-sheet__header">
          <text class="nx-headline">
            {{ t('settings.selectLanguage') }}
          </text>
        </view>
        <scroll-view scroll-y class="nx-sheet__scroll">
          <view class="nx-group__body">
            <view
              v-for="lang in supportedLanguages"
              :key="lang.code"
              class="nx-row nx-row--tap"
              @click="handleLanguageChange(lang.code)"
            >
              <view class="nx-row__main">
                <view class="nx-row__title">
                  {{ lang.name }}
                </view>
              </view>
              <wd-icon v-if="currentLanguage === lang.code" name="check" size="18px" custom-class="nx-check" />
            </view>
          </view>
        </scroll-view>
      </view>
    </wd-popup>

    <!-- Server address sheet -->
    <wd-popup
      v-model="showServerSheet"
      position="bottom"
      custom-class="nx-sheet"
      safe-area-inset-bottom
    >
      <view class="nx-sheet__inner">
        <view class="nx-sheet__handle" />
        <view class="nx-sheet__header">
          <text class="nx-headline">
            {{ t('settings.serverApiUrl') }}
          </text>
        </view>
        <view class="nx-group">
          <view class="nx-group__body">
            <view class="nx-row">
              <input
                v-model="serverDraft"
                class="nx-mono settings-input"
                type="text"
                :placeholder="t('settings.enterServerUrl')"
                placeholder-class="settings-placeholder"
                @input="serverError = ''"
              >
            </view>
          </view>
          <view class="nx-group__footer" :class="{ 'settings-error': serverError }">
            {{ serverError || t('settings.modifyWillClearCache') }}
          </view>
        </view>
        <view class="nx-btn nx-btn--primary nx-btn--block" role="button" @click="saveServerUrl">
          {{ t('settings.saveSettings') }}
        </view>
        <view
          v-if="isCustomServer"
          class="nx-btn nx-btn--block settings-reset"
          role="button"
          @click="resetServerUrl"
        >
          {{ t('settings.resetDefault') }}
        </view>
      </view>
    </wd-popup>
  </view>
</template>

<style lang="scss" scoped>
.settings {
  padding-bottom: calc(var(--nx-space-7) + env(safe-area-inset-bottom));

  &__title {
    padding-top: var(--nx-space-5);
  }
}

.settings-icon {
  width: 56rpx;
  height: 56rpx;
  border-radius: var(--nx-radius-sm);
}

:deep(.settings-chevron) {
  flex: none;
  color: var(--nx-text-3);
}

.settings-account {
  padding-top: var(--nx-space-4);
  padding-bottom: var(--nx-space-4);

  &__avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 96rpx;
    height: 96rpx;
    border-radius: 50%;
    background: var(--nx-accent-soft);
    color: var(--nx-accent);
    font-size: var(--nx-text-title);
    font-weight: 700;
  }
  &__name {
    font-size: var(--nx-text-headline);
    font-weight: 600;
  }
}

.settings-appearance {
  padding: var(--nx-space-3);
}

.settings-link {
  color: var(--nx-accent);
}

.settings-signout {
  justify-content: center;
  color: var(--nx-danger);
  font-size: var(--nx-text-body);
  font-weight: 500;
}

.settings-input {
  flex: 1;
  min-width: 0;
  height: 72rpx;
  font-size: var(--nx-text-callout);
  color: var(--nx-text);
}

:deep(.settings-placeholder) {
  color: var(--nx-text-3);
}

.settings-error {
  color: var(--nx-danger);
}

.settings-reset {
  margin-top: var(--nx-space-2);
  color: var(--nx-danger);
  background: transparent;
}

// Sheets
:deep(.wd-popup.nx-sheet) {
  overflow: hidden;
  border-radius: var(--nx-radius-xl) var(--nx-radius-xl) 0 0;
  background: var(--nx-bg);
}

.nx-sheet {
  &__inner {
    padding: 0 var(--nx-gutter) var(--nx-space-4);
  }
  &__handle {
    width: 72rpx;
    height: 10rpx;
    margin: var(--nx-space-2) auto 0;
    border-radius: var(--nx-radius-pill);
    background: var(--nx-surface-3);
  }
  &__header {
    display: flex;
    align-items: center;
    min-height: var(--nx-touch);
    padding: var(--nx-space-2) 0;
  }
  &__scroll {
    max-height: 60vh;
    border-radius: var(--nx-radius-lg);
  }
}

:deep(.nx-check) {
  flex: none;
  color: var(--nx-accent);
}
</style>
