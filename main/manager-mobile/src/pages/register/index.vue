<route lang="jsonc" type="page">
{
  "layout": "default",
  "style": {
    "navigationStyle": "custom",
    "navigationBarTitleText": "Register"
  }
}
</route>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { register, sendSmsCode } from '@/api/auth'
// Import i18n related functions
import { getCurrentLanguage, initI18n, t } from '@/i18n'
import { useConfigStore } from '@/store'
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

// Registration form data
interface RegisterData {
  username: string
  password: string
  confirmPassword: string
  captcha: string
  captchaId: string
  areaCode: string
  mobile: string
  mobileCaptcha: string
}

const formData = ref<RegisterData>({
  username: '',
  password: '',
  confirmPassword: '',
  captcha: '',
  captchaId: '',
  areaCode: '+86',
  mobile: '',
  mobileCaptcha: '',
})

// Captcha image
const captchaImage = ref('')
const loading = ref(false)
const smsLoading = ref(false)
const smsCountdown = ref(0)

// Registration method: 'username' | 'mobile'
const registerType = ref<'username' | 'mobile'>('username')

// Get config store
const configStore = useConfigStore()

// Area code selection related
const showAreaCodeSheet = ref(false)
const selectedAreaCode = ref('+86')
const selectedAreaName = ref('Mainland China')

// Computed property: whether mobile registration is enabled
const enableMobileRegister = computed(() => {
  return configStore.config.enableMobileRegister
})

// Computed property: area code list
const areaCodeList = computed(() => {
  return configStore.config.mobileAreaList || [{ name: 'Mainland China', key: '+86' }]
})

// SM2 public key
const sm2PublicKey = computed(() => {
  return configStore.config.sm2PublicKey
})

// Switch registration method
function toggleRegisterType() {
  registerType.value = registerType.value === 'username' ? 'mobile' : 'username'
  // Clear inputs
  formData.value.username = ''
  formData.value.mobile = ''
  formData.value.mobileCaptcha = ''
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

// Generate UUID
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// Get captcha
async function refreshCaptcha() {
  const uuid = generateUUID()
  formData.value.captchaId = uuid
  captchaImage.value = `${getEnvBaseUrl()}/user/captcha?uuid=${uuid}&t=${Date.now()}`
}

// Send SMS verification code
async function sendSmsVerification() {
  if (!formData.value.mobile) {
    toast.warning(t('register.enterPhone'))
    return
  }
  if (!formData.value.captcha) {
    toast.warning(t('register.enterCode'))
    return
  }

  // Phone format validation
  const phoneRegex = /^1[3-9]\d{9}$/
  if (!phoneRegex.test(formData.value.mobile)) {
    toast.warning(t('register.enterPhone'))
    return
  }

  try {
    smsLoading.value = true
    await sendSmsCode({
      phone: `${selectedAreaCode.value}${formData.value.mobile}`,
      captcha: formData.value.captcha,
      captchaId: formData.value.captchaId,
    })

    toast.success(t('register.captchaSendSuccess'))

    // Start countdown
    smsCountdown.value = 60
    const timer = setInterval(() => {
      smsCountdown.value--
      if (smsCountdown.value <= 0) {
        clearInterval(timer)
      }
    }, 1000)
  }
  catch (error: any) {
    // Handle captcha error - parse error code from error.message
    if (error.message.includes('10067')) {
      toast.warning(t('login.captchaError'))
    }
    // Refresh graphic captcha on send failure
    refreshCaptcha()
  }
  finally {
    smsLoading.value = false
  }
}

// Register
async function handleRegister() {
  // Form validation
  if (enableMobileRegister.value) {
    // Phone registration validation
    if (!formData.value.mobile) {
      toast.warning(t('register.enterPhone'))
      return
    }
    // Phone format validation
    const phoneRegex = /^1[3-9]\d{9}$/
    if (!phoneRegex.test(formData.value.mobile)) {
      toast.warning(t('register.enterPhone'))
      return
    }
    if (!formData.value.mobileCaptcha) {
      toast.warning(t('register.enterCode'))
      return
    }
  }
  else {
    // Username registration validation
    if (!formData.value.username) {
      toast.warning(t('register.enterUsername'))
      return
    }
  }

  if (!formData.value.password) {
    toast.warning(t('register.enterPassword'))
    return
  }

  if (!formData.value.confirmPassword) {
    toast.warning(t('register.confirmPassword'))
    return
  }

  if (formData.value.password !== formData.value.confirmPassword) {
    toast.warning(t('register.confirmPassword'))
    return
  }

  if (!formData.value.captcha) {
    toast.warning(t('register.enterCode'))
    return
  }

  // Check if SM2 public key is configured
  if (!sm2PublicKey.value) {
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
      encryptedPassword = sm2Encrypt(sm2PublicKey.value, captchaAndPassword)
    }
    catch (error) {
      console.error('Password encryption failed:', error)
      toast.warning(t('sm2.encryptionFailed'))
      return
    }

    // Build registration data
    const registerData = {
      username: enableMobileRegister.value ? `${selectedAreaCode.value}${formData.value.mobile}` : formData.value.username,
      password: encryptedPassword,
      captchaId: formData.value.captchaId,
      areaCode: formData.value.areaCode,
      mobile: formData.value.mobile,
      mobileCaptcha: formData.value.mobileCaptcha,
    }

    await register(registerData)
    toast.success(t('message.registerSuccess'))

    // Navigate to login page
    setTimeout(() => {
      uni.redirectTo({
        url: '/pages/login/index',
      })
    }, 1000)
  }
  catch (error: any) {
    // Handle captcha error - parse error code from error.message
    if (error.message.includes('10067')) {
      toast.warning(t('login.captchaError'))
    }
    // Handle phone number already registered error
    else if (error.message.includes('10070')) {
      toast.warning(t('message.phoneRegistered'))
    }
    // Refresh captcha on registration failure
    refreshCaptcha()
  }
  finally {
    loading.value = false
  }
}

// Show / hide the password text
const showPassword = ref(false)

// Pending copy (src/i18n/_pending/mobile-home-agents.ts): English fallback until merged
function tx(key: string, fallback: string) {
  const value = t(key)
  return value === key ? fallback : value
}

// Legal pages
function goToUserAgreement() {
  const lang = getCurrentLanguage() === 'zh_CN' ? 'zh' : 'en'
  uni.navigateTo({ url: `/pages/login/user-agreement-${lang}` })
}

function goToPrivacyPolicy() {
  const lang = getCurrentLanguage() === 'zh_CN' ? 'zh' : 'en'
  uni.navigateTo({ url: `/pages/login/privacy-policy-${lang}` })
}

// Back to login
function goBack() {
  uni.redirectTo({
    url: '/pages/login/index',
  })
}

// Fetch captcha on page load
onLoad(() => {
  refreshCaptcha()
})

// Ensure config is loaded on mount
onMounted(async () => {
  if (!configStore.config.name) {
    try {
      await configStore.fetchPublicConfig()
    }
    catch (error) {
      console.error('Failed to get configuration:', error)
    }
  }
  // Initialize i18n
  initI18n()
})
</script>

<template>
  <view class="nx-auth" :style="{ paddingTop: `${safeAreaInsets?.top || 0}px` }">
    <view class="nx-auth__topbar nx-auth__topbar--split">
      <view class="nx-auth__chip nx-auth__back" role="button" :aria-label="t('register.loginNow')" @click="goBack">
        <wd-icon name="arrow-left" size="18px" />
        <text>{{ tx('register.backToSignIn', 'Sign in') }}</text>
      </view>
    </view>

    <view class="nx-auth__body">
      <view class="nx-auth__hero">
        <image class="nx-auth__logo" src="/static/logo.svg" mode="aspectFit" />
        <text class="nx-auth__title">
          Nobix Console
        </text>
        <text class="nx-auth__subtitle">
          {{ tx('register.heroSubtitle', 'Create an account to set up and care for your robots.') }}
        </text>
      </view>

      <view class="nx-group">
        <view class="nx-group__header">
          {{ t('register.createAccount') }}
        </view>
        <view class="nx-group__body">
          <!-- Mobile registration -->
          <view v-if="enableMobileRegister" class="nx-field">
            <view class="nx-field__prefix" role="button" :aria-label="t('register.selectCountry')" @click="openAreaCodeSheet">
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
              :placeholder="t('register.enterPhone')"
              placeholder-class="nx-field__placeholder"
            >
          </view>

          <!-- Username registration -->
          <view v-else class="nx-field">
            <wd-icon name="user" size="18px" custom-class="nx-field__icon" />
            <input
              v-model="formData.username"
              class="nx-field__input"
              type="text"
              :placeholder="t('register.enterUsername')"
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
              :placeholder="t('register.enterPassword')"
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
            <wd-icon name="lock-on" size="18px" custom-class="nx-field__icon" />
            <input
              v-model="formData.confirmPassword"
              class="nx-field__input"
              type="text"
              :password="!showPassword"
              :maxlength="20"
              :placeholder="t('register.confirmPassword')"
              placeholder-class="nx-field__placeholder"
            >
          </view>
        </view>
      </view>

      <view class="nx-group">
        <view class="nx-group__header">
          {{ tx('register.verifyHeader', 'Verification') }}
        </view>
        <view class="nx-group__body">
          <view class="nx-field">
            <wd-icon name="check" size="18px" custom-class="nx-field__icon" />
            <input
              v-model="formData.captcha"
              class="nx-field__input"
              type="text"
              :maxlength="6"
              :placeholder="t('register.enterCode')"
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

          <!-- SMS verification code -->
          <view v-if="enableMobileRegister" class="nx-field">
            <wd-icon name="phone" size="18px" custom-class="nx-field__icon" />
            <input
              v-model="formData.mobileCaptcha"
              class="nx-field__input"
              type="number"
              :maxlength="6"
              :placeholder="t('register.enterCode')"
              placeholder-class="nx-field__placeholder"
            >
            <view
              class="nx-num nx-field__send"
              :class="{ 'is-disabled': smsCountdown > 0 || smsLoading }"
              role="button"
              @click="smsCountdown > 0 || smsLoading ? null : sendSmsVerification()"
            >
              {{ smsCountdown > 0 ? `${smsCountdown}s` : t('register.getCode') }}
            </view>
          </view>
        </view>
        <view class="nx-group__footer">
          {{ tx('register.captchaHint', 'Tap the picture for a new code.') }}
        </view>
      </view>

      <view
        class="nx-btn nx-btn--primary nx-btn--block nx-auth__submit"
        :class="{ 'is-loading': loading }"
        role="button"
        @click="!loading && handleRegister()"
      >
        <wd-loading v-if="loading" size="18px" custom-class="nx-auth__spinner" />
        {{ loading ? t('register.registering') : t('register.registerButton') }}
      </view>

      <view class="nx-auth__links nx-auth__links--center">
        <text class="nx-auth__muted">
          {{ t('register.haveAccount') }}
        </text>
        <text class="nx-auth__link" @click="goBack">
          {{ t('register.loginNow') }}
        </text>
      </view>
    </view>

    <view class="nx-auth__legal">
      <text>{{ t('register.agreeTerms') }}</text>
      <text class="nx-auth__link" @click="goToUserAgreement">
        {{ t('register.terms') }}
      </text>
      <text>{{ tx('login.agreeAnd', 'and') }}</text>
      <text class="nx-auth__link" @click="goToPrivacyPolicy">
        {{ t('register.privacy') }}
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
            {{ t('register.selectCountry') }}
          </text>
          <text class="nx-sheet__done" @click="closeAreaCodeSheet">
            {{ t('register.confirm') }}
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
