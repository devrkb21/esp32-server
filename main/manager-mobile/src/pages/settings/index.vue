<!-- More: the fourth tab (owner: m-auth). Every place not on the first three tabs, then the
     account and this app: language, colours, server address, stored data, about, terms, sign out. -->
<route lang="jsonc" type="page">
{
  "layout": "tabbar",
  "style": {
    "navigationBarTitleText": "More",
    "navigationStyle": "custom"
  }
}
</route>

<script lang="ts" setup>
import type { Language } from '@/store/lang'
import type { ThemeMode } from '@/store/theme'
import { onShow } from '@dcloudio/uni-app'
import { computed, ref, watch } from 'vue'
import { changeLanguage, getCurrentLanguage, getSupportedLanguages, t } from '@/i18n'
import { isValidServerUrl, legalPath, normalizeServerUrl, storageMb } from '@/pages/login/authKit.mjs'
import PickSheet from '@/pages/login/components/pick-sheet.vue'
import { useConfigStore, useThemeStore, useUserStore } from '@/store'
import { clearServerBaseUrlOverride, getEnvBaseUrl, getServerBaseUrlOverride, setServerBaseUrlOverride } from '@/utils'
import { digits } from '@/utils/calendar.mjs'
import { tbConfirm } from '@/utils/tbConfirm'
import { visiblePlaces } from '@/utils/tbProducts.mjs'
import { loadRobots, robotFeatures } from '@/utils/tbRobot'
import { toast } from '@/utils/toast'

defineOptions({ name: 'SettingsPage' })

// App version shown in About (the value the About dialog has always used)
const APP_VERSION = '1.0.0'

const configStore = useConfigStore()
const userStore = useUserStore()
const themeStore = useThemeStore()
const lang = computed(() => getCurrentLanguage())
const num = (v: any) => digits(v, lang.value)

// ---- Places: everything that is not Today, Day or Look (without the ones the chosen robot's
// product cannot use: a generic device has no Messages or Robot settings)
const places = computed(() => visiblePlaces([
  {
    group: t('nav.group.robot'),
    items: [
      { url: '/pages/messages/index', icon: 'message', label: t('nav.messages'), ink: 'message' },
      { url: '/pages/robot/index', icon: 'robot', label: t('mauth.more.robotSettings') },
    ],
  },
  {
    group: t('nav.group.character'),
    items: [
      { url: '/pages/agent/index', icon: 'agent', label: t('nav.character') },
      { url: '/pages/voiceprint/index', icon: 'voiceprint', label: t('nav.voiceprint') },
      { url: '/pages/robots/index', icon: 'robots', label: t('nav.robots') },
      { url: '/pages/device-config/index', icon: 'plus', label: t('mauth.more.addRobot') },
    ],
  },
], robotFeatures()))
function go(url: string) {
  uni.navigateTo({ url })
}

// ---- Account
const signedIn = ref(false)
const accountName = computed(() => userStore.userInfo?.realName || userStore.userInfo?.username || '')
const accountDetail = computed(() => {
  const info = userStore.userInfo
  if (!info)
    return ''
  return info.mobile || info.email || (info.realName ? info.username : '') || ''
})
function refreshAccount() {
  signedIn.value = Boolean(uni.getStorageSync('token')) && Boolean(userStore.userInfo?.username)
}
async function loadAccount() {
  refreshAccount()
  if (!signedIn.value && uni.getStorageSync('token')) {
    try {
      await userStore.getUserInfo()
    }
    catch {}
    refreshAccount()
  }
}
function goToLogin() {
  uni.reLaunch({ url: '/pages/login/index' })
}
async function handleSignOut() {
  const ok = await tbConfirm({
    title: t('mauth.more.signOutTitle'),
    message: t('mauth.more.signOutMessage'),
    confirmText: t('nav.logout'),
    danger: true,
  })
  if (!ok)
    return
  await userStore.logout()
  uni.reLaunch({ url: '/pages/login/index' })
}

// ---- Language
const languages = getSupportedLanguages()
const showLanguage = ref(false)
const languageName = computed(() => languages.find(l => l.code === lang.value)?.name || '')
const languageOptions = computed(() => languages.map(l => ({ value: l.code, label: l.name })))
function pickLanguage(code: string) {
  showLanguage.value = false
  if (code === lang.value)
    return
  changeLanguage(code as Language)
  toast.success(t('mauth.more.languageChanged'))
}

// ---- Colours: like the phone / light / dark
const themeOptions = computed(() => [
  { value: 'auto', label: t('mauth.more.themeAuto') },
  { value: 'light', label: t('mauth.more.themeLight') },
  { value: 'dark', label: t('mauth.more.themeDark') },
])
function pickTheme(mode: ThemeMode) {
  if (themeStore.themeMode === mode)
    return
  themeStore.setThemeMode(mode)
  toast.success(t('mauth.more.themeChanged'))
}

// ---- Stored data
const cacheMb = ref('0.00')
function getCacheInfo() {
  try {
    cacheMb.value = storageMb(uni.getStorageInfoSync().currentSize || 0)
  }
  catch (error) {
    console.error('Failed to get cache info:', error)
  }
}

// Clear everything stored, keeping only the server address the owner chose
function clearAllCacheAfterUrlChange() {
  try {
    const preservedOverride = getServerBaseUrlOverride()
    uni.clearStorageSync()
    // #ifdef H5
    if (typeof localStorage !== 'undefined')
      localStorage.clear()
    // #endif
    if (preservedOverride)
      setServerBaseUrlOverride(preservedOverride)
    getCacheInfo()
  }
  catch (error) {
    console.error('Failed to clear cache:', error)
  }
}

async function clearCache() {
  const ok = await tbConfirm({
    title: t('mauth.more.clearTitle'),
    message: t('mauth.more.clearMessage'),
    confirmText: t('mauth.more.clearConfirm'),
    danger: true,
  })
  if (!ok)
    return
  try {
    clearAllCacheAfterUrlChange()
    toast.success(t('mauth.more.cleared'))
    setTimeout(() => {
      uni.reLaunch({ url: '/pages/login/index' })
    }, 1500)
  }
  catch (error) {
    console.error('Failed to clear cache:', error)
    toast.error(t('mauth.more.clearFailed'))
  }
}

// ---- Server address
const currentServerUrl = ref(getEnvBaseUrl())
const isCustomServer = ref(Boolean(getServerBaseUrlOverride()))
const showServer = ref(false)
const serverDraft = ref('')
const serverError = ref('')
// Connection check before saving: idle | testing | ok | failed
const serverTest = ref<'idle' | 'testing' | 'ok' | 'failed'>('idle')
// The address that failed the check; saving it again means "save anyway"
const failedServerUrl = ref('')
const saveAnyway = computed(() => Boolean(failedServerUrl.value) && failedServerUrl.value === normalizeServerUrl(serverDraft.value))
const testState = computed(() => ({ testing: 'pending', ok: 'applied', failed: 'error' } as Record<string, 'pending' | 'applied' | 'error'>)[serverTest.value])
const testText = computed(() => ({
  testing: t('mauth.more.serverTesting'),
  ok: t('mauth.more.serverOk'),
  failed: t('mauth.more.serverUnreachable'),
} as Record<string, string>)[serverTest.value] || '')

let quietDraft = false
watch(serverDraft, () => {
  if (quietDraft)
    return
  serverError.value = ''
  serverTest.value = 'idle'
  failedServerUrl.value = ''
})

function openServer() {
  quietDraft = true
  serverDraft.value = currentServerUrl.value
  serverError.value = ''
  serverTest.value = 'idle'
  failedServerUrl.value = ''
  showServer.value = true
  setTimeout(() => {
    quietDraft = false
  })
}

function restartToLogin() {
  setTimeout(() => {
    uni.reLaunch({ url: '/pages/login/index' })
  }, 1500)
}

/**
 * Ask the server for its public config (no sign-in needed). True when it answers like a
 * manager-api, so a typo or a missing "/xiaozhi" path is caught before the app signs you out.
 */
function checkServer(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    uni.request({
      url: `${url}/user/pub-config`,
      method: 'GET',
      timeout: 8000,
      success: (res) => {
        const data = res.data as any
        resolve(res.statusCode === 200 && !!data && typeof data === 'object' && 'code' in data)
      },
      fail: () => resolve(false),
    })
  })
}

async function testServerUrl() {
  const url = normalizeServerUrl(serverDraft.value)
  if (!url || !isValidServerUrl(url)) {
    serverError.value = t(url ? 'mauth.more.serverInvalid' : 'mauth.more.serverEnter')
    return
  }
  serverError.value = ''
  serverTest.value = 'testing'
  const ok = await checkServer(url)
  serverTest.value = ok ? 'ok' : 'failed'
}

async function saveServerUrl() {
  const url = normalizeServerUrl(serverDraft.value)
  if (!url) {
    serverError.value = t('mauth.more.serverEnter')
    return
  }
  if (!isValidServerUrl(url)) {
    serverError.value = t('mauth.more.serverInvalid')
    return
  }
  if (serverTest.value === 'testing')
    return
  // Check first; a second tap on the same failing address saves it anyway
  if (failedServerUrl.value !== url) {
    serverTest.value = 'testing'
    const ok = await checkServer(url)
    serverTest.value = ok ? 'ok' : 'failed'
    if (!ok) {
      failedServerUrl.value = url
      serverError.value = t('mauth.more.serverSaveAnywayHint')
      return
    }
  }
  setServerBaseUrlOverride(url)
  clearAllCacheAfterUrlChange()
  currentServerUrl.value = getEnvBaseUrl()
  isCustomServer.value = true
  showServer.value = false
  toast.success(t('mauth.more.serverSaved'))
  restartToLogin()
}

function resetServerUrl() {
  clearServerBaseUrlOverride()
  clearAllCacheAfterUrlChange()
  currentServerUrl.value = getEnvBaseUrl()
  isCustomServer.value = false
  showServer.value = false
  toast.success(t('mauth.more.serverResetDone'))
  restartToLogin()
}

// ---- About and terms
const showAbout = ref(false)
const serverVersion = computed(() => {
  const v = configStore.config?.version
  return v && v !== 'null' ? String(v) : ''
})
function openLegal(page: 'terms' | 'privacy') {
  uni.navigateTo({ url: legalPath(page) })
}

onShow(() => {
  getCacheInfo()
  loadAccount()
  if (uni.getStorageSync('token'))
    loadRobots() // keeps the places in step with the chosen robot's product
  currentServerUrl.value = getEnvBaseUrl()
  isCustomServer.value = Boolean(getServerBaseUrlOverride())
})
</script>

<template>
  <view class="tb-wrap more">
    <tb-page-header :title="t('nav.more')" />

    <!-- Account -->
    <view class="more__account">
      <block v-if="signedIn">
        <view class="more__who">
          <text class="more__name">
            {{ accountName }}
          </text>
          <text v-if="accountDetail" class="more__detail">
            {{ accountDetail }}
          </text>
        </view>
      </block>
      <view v-else class="more__row" role="button" hover-class="is-press" @click="goToLogin">
        <tb-icon name="user" />
        <view class="more__rowtext">
          <text>{{ t('mauth.more.signIn') }}</text>
          <text class="more__note">
            {{ t('mauth.more.signInText') }}
          </text>
        </view>
        <tb-icon name="chevron-right" :size="16" />
      </view>
    </view>

    <!-- Every place that is not on the first three tabs -->
    <view v-for="g in places" :key="g.group" class="more__group" role="navigation" :aria-label="g.group">
      <text class="more__title">
        {{ g.group }}
      </text>
      <view
        v-for="it in g.items" :key="it.url" class="more__row" role="link" hover-class="is-press"
        :style="it.ink ? { '--ink': `var(--tb-${it.ink})` } : undefined" @click="go(it.url)"
      >
        <tb-icon :name="it.icon" />
        <text class="more__label">
          {{ it.label }}
        </text>
        <tb-icon name="chevron-right" :size="16" />
      </view>
    </view>

    <!-- This app -->
    <view class="more__group">
      <text class="more__title">
        {{ t('mauth.more.app') }}
      </text>

      <view class="more__row" role="button" hover-class="is-press" @click="showLanguage = true">
        <tb-icon name="language" />
        <text class="more__label">
          {{ t('mauth.language') }}
        </text>
        <text class="more__value">
          {{ languageName }}
        </text>
        <tb-icon name="chevron-right" :size="16" />
      </view>

      <view class="more__block">
        <view class="more__blockhead">
          <tb-icon :name="themeStore.currentTheme === 'dark' ? 'moon' : 'sun'" /><text>{{ t('mauth.more.theme') }}</text>
        </view>
        <tb-choice :model-value="themeStore.themeMode" :options="themeOptions" wrap :aria-label="t('mauth.more.theme')" @change="pickTheme" />
      </view>

      <view class="more__row" role="button" hover-class="is-press" @click="openServer">
        <tb-icon name="server" />
        <view class="more__rowtext">
          <text>{{ t('mauth.more.server') }}</text>
          <text class="more__url">
            {{ currentServerUrl }}
          </text>
          <text class="more__note">
            {{ isCustomServer ? t('mauth.more.serverCustom') : t('mauth.more.serverDefault') }}
          </text>
        </view>
        <tb-icon name="chevron-right" :size="16" />
      </view>

      <view class="more__row is-static">
        <tb-icon name="memory" />
        <text class="more__label">
          {{ t('mauth.more.storage') }}
        </text>
        <text class="more__value tb-num">
          {{ t('mauth.more.storageSize', { n: num(cacheMb) }) }}
        </text>
      </view>
      <view class="more__row is-danger" role="button" hover-class="is-press" @click="clearCache">
        <tb-icon name="trash" />
        <text class="more__label">
          {{ t('mauth.more.clear') }}
        </text>
      </view>
    </view>

    <!-- About and terms -->
    <view class="more__group">
      <text class="more__title">
        {{ t('mauth.more.about') }}
      </text>
      <view class="more__row" role="button" hover-class="is-press" @click="showAbout = true">
        <tb-icon name="info" />
        <text class="more__label">
          {{ t('mauth.more.about') }}
        </text>
        <text class="more__value tb-num">
          {{ num(APP_VERSION) }}
        </text>
        <tb-icon name="chevron-right" :size="16" />
      </view>
      <view class="more__row" role="link" hover-class="is-press" @click="openLegal('terms')">
        <tb-icon name="book" />
        <text class="more__label">
          {{ t('mauth.termsTitle') }}
        </text>
        <tb-icon name="chevron-right" :size="16" />
      </view>
      <view class="more__row" role="link" hover-class="is-press" @click="openLegal('privacy')">
        <tb-icon name="lock" />
        <text class="more__label">
          {{ t('mauth.privacyTitle') }}
        </text>
        <tb-icon name="chevron-right" :size="16" />
      </view>
    </view>

    <view v-if="signedIn" class="more__out">
      <tb-button variant="danger" icon="logout" block @click="handleSignOut">
        {{ t('nav.logout') }}
      </tb-button>
    </view>

    <PickSheet v-model:open="showLanguage" :title="t('mauth.language')" :value="lang" :options="languageOptions" @pick="pickLanguage" />

    <tb-sheet v-model:open="showServer" :title="t('mauth.more.server')">
      <tb-input
        v-model="serverDraft" :placeholder="t('mauth.more.serverPh')" :invalid="!!serverError || serverTest === 'failed'"
        :aria-label="t('mauth.more.server')" :maxlength="300" clearable
      />
      <view class="more__check">
        <tb-button size="s" icon="refresh" :loading="serverTest === 'testing'" @click="testServerUrl">
          {{ t('mauth.more.serverTest') }}
        </tb-button>
        <tb-sync v-if="serverTest !== 'idle'" :state="testState" :text="testText" />
      </view>
      <text class="more__hint" :class="{ 'is-error': !!serverError }">
        {{ serverError || t('mauth.more.serverHint') }}
      </text>
      <tb-button v-if="isCustomServer" variant="quiet" block @click="resetServerUrl">
        {{ t('mauth.more.serverReset') }}
      </tb-button>
      <template #footer>
        <tb-button @click="showServer = false">
          {{ t('common.cancel') }}
        </tb-button>
        <tb-button variant="primary" :loading="serverTest === 'testing'" @click="saveServerUrl">
          {{ saveAnyway ? t('mauth.more.serverSaveAnyway') : t('mauth.more.serverSave') }}
        </tb-button>
      </template>
    </tb-sheet>

    <tb-sheet v-model:open="showAbout" :title="t('mauth.more.about')">
      <view class="more__about">
        <image class="more__mark" src="/static/brand/nx-mark.png" mode="aspectFit" aria-hidden="true" />
        <view class="more__abouttext">
          <text class="more__brand">
            {{ t('nav.brand') }}
          </text>
          <text class="more__note">
            {{ t('mauth.more.aboutText') }}
          </text>
        </view>
      </view>
      <view class="more__maker">
        <image class="more__nobix more__nobix--light" src="/static/brand/nobix-lockup.png" mode="widthFix" role="img" :aria-label="t('mauth.madeBy')" />
        <image class="more__nobix more__nobix--dark" src="/static/brand/nobix-lockup-dark.png" mode="widthFix" role="img" :aria-label="t('mauth.madeBy')" />
      </view>
      <view class="more__facts">
        <view class="more__fact">
          <text>{{ t('mauth.more.appVersion') }}</text><text class="tb-num">
            {{ num(APP_VERSION) }}
          </text>
        </view>
        <view v-if="serverVersion" class="more__fact">
          <text>{{ t('mauth.more.serverVersion') }}</text><text class="tb-num">
            {{ num(serverVersion) }}
          </text>
        </view>
      </view>
    </tb-sheet>
  </view>
</template>

<style lang="scss">
.more {
  padding-bottom: 28px;
}
.more__account {
  padding: 14px 0 4px;
}
.more__who {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-bottom: 6px;
  min-width: 0;
}
.more__name {
  font-family: var(--tb-font-display);
  font-weight: 700;
  font-size: 20px;
  overflow-wrap: anywhere;
}
.more__detail {
  font-size: 14px;
  color: var(--tb-ink-2);
  overflow-wrap: anywhere;
}

.more__group {
  display: flex;
  flex-direction: column;
  padding-top: 22px;
}
.more__title {
  font-family: var(--tb-font-display);
  font-weight: 700;
  font-size: 15px;
  color: var(--tb-ink-2);
  padding-bottom: 6px;
  border-bottom: 1px solid var(--tb-rule);
}

.more__row {
  --ink: var(--tb-ink);
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 52px;
  padding: 8px 0;
  border-bottom: 1px solid var(--tb-rule-soft);
  font-weight: 600;
  font-size: 15px;
  color: var(--tb-ink);
  transition: background-color var(--tb-t-hover) var(--tb-ease);
}
.more__row.is-press {
  background: var(--tb-paper-2);
}
.more__row > .tb-icon:first-child {
  color: var(--ink);
}
.more__row > .tb-icon:last-child:not(:first-child) {
  color: var(--tb-ink-3);
}
.more__label {
  flex: 1;
  min-width: 0;
}
.more__rowtext {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.more__value {
  flex: none;
  max-width: 45%;
  font-weight: 500;
  font-size: 14px;
  color: var(--tb-ink-2);
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.more__note {
  font-weight: 400;
  font-size: 13px;
  color: var(--tb-ink-2);
}
.more__url {
  font-weight: 500;
  font-size: 13px;
  color: var(--tb-ink);
  overflow-wrap: anywhere;
  word-break: break-all;
}
.more__row.is-danger {
  color: var(--tb-danger);
}
.more__row.is-danger > .tb-icon:first-child {
  color: var(--tb-danger);
}

.more__block {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 0 14px;
  border-bottom: 1px solid var(--tb-rule-soft);
}
.more__blockhead {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 600;
  font-size: 15px;
}

.more__out {
  padding-top: 28px;
}

.more__check {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.more__hint {
  font-size: 13px;
  color: var(--tb-ink-2);
}
.more__hint.is-error {
  color: var(--tb-danger);
  font-weight: 500;
}

.more__about {
  display: flex;
  align-items: center;
  gap: 14px;
}
.more__mark {
  width: 48px;
  height: 48px;
  flex: none;
}
.more__abouttext {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.more__brand {
  font-family: var(--tb-font-display);
  font-weight: 800;
  font-size: 20px;
}
/* Nobix, the maker: the official lockup above the version lines, with clear space of at least
   half the mark around it; the dark file (white wordmark) on the dark ground */
.more__maker {
  display: flex;
  justify-content: center;
  padding: 20px 0 18px;
}
.more__nobix {
  width: 140px;
  height: auto;
}
.more__nobix--dark {
  display: none;
}
.is-dark .more__nobix--light {
  display: none;
}
.is-dark .more__nobix--dark {
  display: block;
}
.more__facts {
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--tb-rule);
}
.more__fact {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--tb-rule-soft);
  font-size: 14px;
}

@media (min-width: 768px) {
  .more {
    max-width: 640px;
    margin: 0 auto;
  }
}
</style>
