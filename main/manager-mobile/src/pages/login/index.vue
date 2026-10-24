<route lang="jsonc" type="page">
{
  "layout": "default",
  "style": {
    "navigationStyle": "custom",
    "navigationBarTitleText": "Login"
  }
}
</route>

<script lang="ts" setup>
import type { LoginData } from '@/api/auth'
import type { Language } from '@/store/lang'
import { computed, onMounted, ref } from 'vue'
import { login } from '@/api/auth'
// Import i18n related functions
import { changeLanguage, getCurrentLanguage, getSupportedLanguages, initI18n, t } from '@/i18n'
import { useConfigStore, useUserStore } from '@/store'
// Import SM2 encryption utility
import { getEnvBaseUrl, sm2Encrypt } from '@/utils'
import { toast } from '@/utils/toast'

// Get distance from screen boundary to safe area
let safeAreaInsets
let systemInfo

// #ifdef MP-WEIXIN
// Mini-program uses new API
systemInfo = uni.getWindowInfo()
safeAreaInsets = systemInfo.safeArea
  ? {
      top: systemInfo.safeArea.top,
      right: systemInfo.windowWidth - systemInfo.safeArea.right,
      bottom: systemInfo.windowHeight - systemInfo.safeArea.bottom,
      left: systemInfo.safeArea.left,
    }
  : null
// #endif

// #ifndef MP-WEIXIN
// Other platforms continue using uni API
systemInfo = uni.getSystemInfoSync()
safeAreaInsets = systemInfo.safeAreaInsets
// #endif
// Form data
const formData = ref({
  username: '',
  password: '',
  captcha: '',
  captchaId: '',
  areaCode: '+86',
  mobile: '',
})

// Captcha image
const captchaImage = ref('')
const loading = ref(false)

// Login method: 'username' | 'mobile'
const loginType = ref<'username' | 'mobile'>('username')

// Get config store
const configStore = useConfigStore()
const userStore = useUserStore()

// Area code selection related
const showAreaCodeSheet = ref(false)
const selectedAreaCode = ref('+86')
const selectedAreaName = ref('Mainland China')

// Computed property: whether mobile login is enabled
const enableMobileLogin = computed(() => {
  return configStore.config.enableMobileRegister
})

// Computed property: area code list
const areaCodeList = computed(() => {
  return configStore.config.mobileAreaList || [{ name: 'Mainland China', key: '+86' }]
})

// Switch login method
function toggleLoginType() {
  loginType.value = loginType.value === 'username' ? 'mobile' : 'username'
  // Clear inputs
  formData.value.username = ''
  formData.value.mobile = ''
}

// Segmented control: only switch when a different segment is tapped
function setLoginType(type: 'username' | 'mobile') {
  if (loginType.value !== type)
    toggleLoginType()
}

// Show / hide the password text
const showPassword = ref(false)

// Pending copy (src/i18n/_pending/mobile-home-agents.ts): English fallback until merged
function tx(key: string, fallback: string) {
  const value = t(key)
  return value === key ? fallback : value
}

// Open area code selection dialog
function openAreaCodeSheet() {
  showAreaCodeSheet.value = true
}

// Select area code
function selectAreaCode(item: { name: string, key: string }) {
  selectedAreaCode.value = item.key
  selectedAreaName.value = item.name
  formData.value.areaCode = item.key
  showAreaCodeSheet.value = false
}

// Close area code selection dialog
function closeAreaCodeSheet() {
  showAreaCodeSheet.value = false
}

// Navigate to registration page
function goToRegister() {
  uni.navigateTo({
    url: '/pages/register/index',
  })
}

// Navigate to forgot password page
function goToForgotPassword() {
  uni.navigateTo({
    url: '/pages/forgot-password/index',
  })
}

// Navigate to user agreement
function goToUserAgreement() {
  const lang = getCurrentLanguage() === 'zh_CN' ? 'zh' : 'en'
  uni.navigateTo({
    url: `/pages/login/user-agreement-${lang}`,
  })
}

// Navigate to privacy policy
function goToPrivacyPolicy() {
  const lang = getCurrentLanguage() === 'zh_CN' ? 'zh' : 'en'
  uni.navigateTo({
    url: `/pages/login/privacy-policy-${lang}`,
  })
}

// Generate UUID
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

// Navigate to server settings page
function goToServerSetting() {
  uni.switchTab({
    url: '/pages/settings/index',
  })
}

// Get captcha
async function refreshCaptcha() {
  const uuid = generateUUID()
  formData.value.captchaId = uuid
  captchaImage.value = `${getEnvBaseUrl()}/user/captcha?uuid=${uuid}&t=${Date.now()}`
}

// Login
async function handleLogin() {
  // Form validation
  if (loginType.value === 'username') {
    if (!formData.value.username) {
      toast.warning(t('login.enterUsername'))
      return
    }
  }
  else {
    if (!formData.value.mobile) {
      toast.warning(t('login.enterPhone'))
      return
    }
    // Phone format validation
    const phoneRegex = /^1[3-9]\d{9}$/
    if (!phoneRegex.test(formData.value.mobile)) {
      toast.warning(t('login.enterPhone'))
      return
    }
  }
  if (!formData.value.password) {
    toast.warning(t('login.enterPassword'))
    return
  }
  if (!formData.value.captcha) {
    toast.warning(t('login.enterCaptcha'))
    return
  }

  // Check if SM2 public key is configured
  const sm2PublicKey = configStore.config.sm2PublicKey
  if (!sm2PublicKey) {
    toast.warning(t('sm2.publicKeyNotConfigured'))
    return
  }

  try {
    loading.value = true

    // Encrypt password
    let encryptedPassword
    try {
      // Concatenate captcha and password
      const captchaAndPassword = formData.value.captcha + formData.value.password
      encryptedPassword = sm2Encrypt(sm2PublicKey, captchaAndPassword)
    }
    catch (error) {
      console.error('Password encryption failed:', error)
      toast.warning(t('sm2.encryptionFailed'))
      return
    }

    // Build login data
    const loginData: LoginData = {
      username: '',
      password: encryptedPassword,
      captchaId: formData.value.captchaId,
    }

    // For mobile login, concatenate area code + mobile to username
    if (loginType.value === 'mobile') {
      loginData.username = `${selectedAreaCode.value}${formData.value.mobile}`
    }
    else {
      loginData.username = formData.value.username
    }

    const response = await login(loginData)
    // Store token
    uni.setStorageSync('token', JSON.stringify(response))
    await userStore.getUserInfo()

    toast.success(t('message.loginSuccess'))

    // Navigate to home page
    setTimeout(() => {
      uni.reLaunch({
        url: '/pages/index/index',
      })
    }, 1000)
  }
  catch (error: any) {
    // Refresh captcha on login failure
    refreshCaptcha()
  }
  finally {
    loading.value = false
  }
}

// Fetch captcha on page load
onLoad(() => {
  refreshCaptcha()
})

// Language switch related
const showLanguageSheet = ref(false)
const supportedLanguages = getSupportedLanguages()

// Initialize i18n
initI18n()

// Switch language
function handleLanguageChange(lang: Language) {
  changeLanguage(lang)
  showLanguageSheet.value = false
}

// Ensure config is loaded on mount
onMounted(async () => {
  if (!configStore.config.name) {
    try {
      await configStore.fetchPublicConfig()
    }
    catch (error) {
      console.error(t('login.fetchConfigError'), error)
    }
  }
})
</script>

<template>
  <view class="nx-auth" :style="{ paddingTop: `${safeAreaInsets?.top || 0}px` }">
    <!-- Top actions: language and server address -->
    <view class="nx-auth__topbar">
      <view
        class="nx-auth__chip"
        role="button"
        :aria-label="t('login.selectLanguage')"
        @click="showLanguageSheet = true"
      >
        <wd-icon name="translate-bold" size="16px" />
        <text>{{ t('login.selectLanguageTip') }}</text>
      </view>
      <view
        class="nx-auth__icon-btn"
        role="button"
        :aria-label="t('login.serverSetting')"
        @click="goToServerSetting"
      >
        <wd-icon name="setting" size="18px" />
      </view>
    </view>

    <view class="nx-auth__body">
      <!-- Hero -->
      <view class="nx-auth__hero">
        <image class="nx-auth__logo" src="/static/logo.svg" mode="aspectFit" />
        <text class="nx-auth__title">
          Nobix Console
        </text>
        <text class="nx-auth__subtitle">
          {{ tx('login.heroSubtitle', 'Welcome back. Sign in to look after your robots.') }}
        </text>
      </view>

      <!-- Username / phone switch -->
      <view v-if="enableMobileLogin" class="nx-segmented nx-auth__segmented">
        <view
          class="nx-segmented__item"
          :class="{ 'is-active': loginType === 'username' }"
          @click="setLoginType('username')"
        >
          {{ tx('login.useUsername', 'Username') }}
        </view>
        <view
          class="nx-segmented__item"
          :class="{ 'is-active': loginType === 'mobile' }"
          @click="setLoginType('mobile')"
        >
          {{ tx('login.usePhone', 'Phone') }}
        </view>
      </view>

      <!-- Grouped inset fields -->
      <view class="nx-group">
        <view class="nx-group__body">
          <view v-if="loginType === 'mobile'" class="nx-field">
            <view class="nx-field__prefix" role="button" :aria-label="t('login.selectCountry')" @click="openAreaCodeSheet">
              <text class="nx-num">
                {{ selectedAreaCode }}
              </text>
              <wd-icon name="arrow-down" size="12px" />
            </view>
            <input
              v-model="formData.mobile"
              class="nx-field__input"
              type="number"
              :maxlength="11"
              :placeholder="t('login.enterPhone')"
              placeholder-class="nx-field__placeholder"
            >
          </view>
          <view v-else class="nx-field">
            <wd-icon name="user" size="18px" custom-class="nx-field__icon" />
            <input
              v-model="formData.username"
              class="nx-field__input"
              type="text"
              :placeholder="t('login.enterUsername')"
              placeholder-class="nx-field__placeholder"
            >
          </view>

          <view class="nx-field">
            <wd-icon name="lock-on" size="18px" custom-class="nx-field__icon" />
            <input
              v-model="formData.password"
              class="nx-field__input"
              type="text"
              :password="!showPassword"
              :maxlength="20"
              :placeholder="t('login.enterPassword')"
              placeholder-class="nx-field__placeholder"
            >
            <view
              class="nx-field__action"
              role="button"
              :aria-label="tx('login.togglePassword', 'Show or hide password')"
              @click="showPassword = !showPassword"
            >
              <wd-icon :name="showPassword ? 'view' : 'eye-close'" size="18px" />
            </view>
          </view>

          <view class="nx-field">
            <wd-icon name="check" size="18px" custom-class="nx-field__icon" />
            <input
              v-model="formData.captcha"
              class="nx-field__input"
              type="text"
              :maxlength="6"
              :placeholder="t('login.enterCaptcha')"
              placeholder-class="nx-field__placeholder"
            >
            <view
              class="nx-field__captcha"
              role="button"
              :aria-label="tx('login.refreshCaptcha', 'Get a new code')"
              @click="refreshCaptcha"
            >
              <image :src="captchaImage" class="nx-field__captcha-img" mode="aspectFit" />
            </view>
          </view>
        </view>
      </view>

      <view
        class="nx-btn nx-btn--primary nx-btn--block nx-auth__submit"
        :class="{ 'is-loading': loading }"
        role="button"
        @click="!loading && handleLogin()"
      >
        <wd-loading v-if="loading" size="18px" custom-class="nx-auth__spinner" />
        {{ loading ? t('login.loggingIn') : t('login.loginButton') }}
      </view>

      <view class="nx-auth__links">
        <text class="nx-auth__link" @click="goToRegister">
          {{ t('login.noAccount') }}
        </text>
        <text class="nx-auth__link" @click="goToForgotPassword">
          {{ t('login.forgotPassword') }}
        </text>
      </view>
    </view>

    <!-- Legal consent -->
    <view class="nx-auth__legal">
      <text>{{ tx('login.agreeNotice', 'By signing in you agree to the') }}</text>
      <text class="nx-auth__link" @click="goToUserAgreement">
        {{ t('login.userAgreement') }}
      </text>
      <text>{{ tx('login.agreeAnd', 'and') }}</text>
      <text class="nx-auth__link" @click="goToPrivacyPolicy">
        {{ t('login.privacyPolicy') }}
      </text>
    </view>

    <!-- Area code sheet -->
    <wd-popup
      v-model="showAreaCodeSheet"
      position="bottom"
      custom-class="nx-sheet"
      safe-area-inset-bottom
      @close="closeAreaCodeSheet"
    >
      <view class="nx-sheet__inner">
        <view class="nx-sheet__handle" />
        <view class="nx-sheet__header">
          <text class="nx-headline">
            {{ t('login.selectCountry') }}
          </text>
          <text class="nx-sheet__done" @click="closeAreaCodeSheet">
            {{ t('login.confirm') }}
          </text>
        </view>
        <scroll-view scroll-y class="nx-sheet__scroll">
          <view class="nx-group__body">
            <view
              v-for="item in areaCodeList"
              :key="item.key"
              class="nx-row nx-row--tap"
              @click="selectAreaCode(item)"
            >
              <view class="nx-row__main">
                <view class="nx-row__title nx-truncate">
                  {{ item.name }}
                </view>
              </view>
              <text class="nx-num nx-row__value">
                {{ item.key }}
              </text>
              <wd-icon v-if="selectedAreaCode === item.key" name="check" size="18px" custom-class="nx-check" />
            </view>
          </view>
        </scroll-view>
      </view>
    </wd-popup>

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
            {{ t('login.selectLanguage') }}
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
              <wd-icon v-if="getCurrentLanguage() === lang.code" name="check" size="18px" custom-class="nx-check" />
            </view>
          </view>
        </scroll-view>
      </view>
    </wd-popup>
  </view>
</template>

<style lang="scss" scoped>
// Nobix auth screen (sign in / register / reset share this layout)
.nx-auth {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  box-sizing: border-box;
  padding-left: var(--nx-gutter);
  padding-right: var(--nx-gutter);
  padding-bottom: calc(var(--nx-space-5) + env(safe-area-inset-bottom));
  background: var(--nx-bg);
  color: var(--nx-text);

  &__topbar {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--nx-space-2);
    min-height: var(--nx-touch);
    &--split {
      justify-content: space-between;
    }
  }

  &__chip,
  &__icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--nx-space-1);
    min-width: var(--nx-touch);
    height: 64rpx;
    padding: 0 var(--nx-space-3);
    box-sizing: border-box;
    border-radius: var(--nx-radius-pill);
    background: var(--nx-surface);
    box-shadow: var(--nx-shadow-1);
    color: var(--nx-text-2);
    font-size: var(--nx-text-footnote);
    font-weight: 600;
    transition: transform var(--nx-dur-1) var(--nx-ease);
    &:active {
      transform: scale(0.96);
      background: var(--nx-surface-2);
    }
  }
  &__icon-btn {
    width: 64rpx;
    min-width: 64rpx;
    padding: 0;
  }
  &__back {
    margin-left: calc(var(--nx-space-2) * -1);
    padding: 0 var(--nx-space-2);
    background: transparent;
    box-shadow: none;
    color: var(--nx-accent);
    font-size: var(--nx-text-body);
    font-weight: 500;
  }

  &__body {
    flex: 1;
    width: 100%;
    max-width: 840rpx;
    margin: 0 auto;
  }

  &__hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: var(--nx-space-6) 0 var(--nx-space-6);
  }
  &__logo {
    width: 128rpx;
    height: 128rpx;
    border-radius: var(--nx-radius-lg);
    box-shadow: var(--nx-shadow-2);
  }
  &__title {
    margin-top: var(--nx-space-4);
    font-size: var(--nx-text-display);
    font-weight: 700;
    letter-spacing: -0.022em;
    line-height: 1.15;
    color: var(--nx-text);
  }
  &__subtitle {
    margin-top: var(--nx-space-2);
    max-width: 560rpx;
    font-size: var(--nx-text-callout);
    line-height: 1.45;
    color: var(--nx-text-2);
  }

  &__segmented {
    margin-bottom: var(--nx-space-4);
  }

  &__submit {
    &.is-loading {
      opacity: 0.7;
    }
  }

  &__links {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--nx-space-3);
    margin-top: var(--nx-space-4);
    padding: 0 var(--nx-space-2);
    &--center {
      justify-content: center;
    }
  }
  &__link {
    color: var(--nx-accent);
    font-size: var(--nx-text-callout);
    font-weight: 500;
    padding: var(--nx-space-2) 0;
    &:active {
      opacity: 0.6;
    }
  }
  &__muted {
    color: var(--nx-text-2);
    font-size: var(--nx-text-callout);
  }

  &__legal {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0 var(--nx-space-1);
    margin-top: var(--nx-space-6);
    padding: 0 var(--nx-space-4);
    text-align: center;
    color: var(--nx-text-3);
    font-size: var(--nx-text-caption);
    line-height: 1.6;
    .nx-auth__link {
      font-size: var(--nx-text-caption);
      padding: 0;
    }
  }
}

:deep(.nx-auth__spinner) {
  margin-right: var(--nx-space-1);
}

// One field per row inside an inset group
.nx-field {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--nx-space-3);
  min-height: 104rpx;
  padding: 0 var(--nx-space-4);
  box-sizing: border-box;
  &:not(:last-child)::after {
    content: '';
    position: absolute;
    left: var(--nx-space-4);
    right: 0;
    bottom: 0;
    height: 1rpx;
    background: var(--nx-border);
  }

  &__input {
    flex: 1;
    min-width: 0;
    height: 104rpx;
    font-size: var(--nx-text-body);
    color: var(--nx-text);
    background: transparent;
  }

  &__prefix {
    display: flex;
    align-items: center;
    gap: var(--nx-space-1);
    flex: none;
    height: 64rpx;
    padding: 0 var(--nx-space-3) 0 0;
    border-right: 1rpx solid var(--nx-border);
    color: var(--nx-text);
    font-size: var(--nx-text-body);
    font-weight: 500;
  }

  &__action {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: var(--nx-touch);
    height: var(--nx-touch);
    margin-right: calc(var(--nx-space-3) * -1);
    color: var(--nx-text-3);
    &:active {
      opacity: 0.6;
    }
  }

  &__send {
    flex: none;
    padding: var(--nx-space-2) 0 var(--nx-space-2) var(--nx-space-3);
    border-left: 1rpx solid var(--nx-border);
    color: var(--nx-accent);
    font-size: var(--nx-text-callout);
    font-weight: 600;
    white-space: nowrap;
    &.is-disabled {
      color: var(--nx-text-3);
    }
    &:active {
      opacity: 0.6;
    }
  }

  &__captcha {
    flex: none;
    width: 184rpx;
    height: 72rpx;
    overflow: hidden;
    border-radius: var(--nx-radius-sm);
    background: var(--nx-surface-2);
  }
  &__captcha-img {
    display: block;
    width: 100%;
    height: 100%;
  }
}

:deep(.nx-field__icon) {
  flex: none;
  color: var(--nx-text-3);
}

:deep(.nx-field__placeholder) {
  color: var(--nx-text-3);
}

// Bottom sheet (wd-popup position="bottom")
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
    justify-content: space-between;
    min-height: var(--nx-touch);
    padding: var(--nx-space-2) 0;
  }
  &__done {
    color: var(--nx-accent);
    font-size: var(--nx-text-body);
    font-weight: 600;
    padding: var(--nx-space-2) 0 var(--nx-space-2) var(--nx-space-3);
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
