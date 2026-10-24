<route lang="jsonc" type="page">
{
  "layout": "default",
  "style": {
    "navigationStyle": "custom",
    "navigationBarTitleText": "ForgotPassword"
  }
}
</route>

<script lang="ts" setup>
import { onLoad } from '@dcloudio/uni-app'
import { computed, onMounted, ref } from 'vue'
// Import API interfaces
import { retrievePassword, sendSmsCode } from '@/api/auth'
// Import i18n related functions
import { initI18n, t } from '@/i18n'
import { useConfigStore } from '@/store'
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
interface ForgotPasswordData {
  mobile: string
  captcha: string
  captchaId: string
  mobileCaptcha: string
  newPassword: string
  confirmPassword: string
  areaCode: string
}

const formData = ref<ForgotPasswordData>({
  mobile: '',
  captcha: '',
  captchaId: '',
  mobileCaptcha: '',
  newPassword: '',
  confirmPassword: '',
  areaCode: '+86',
})

// Captcha image
const captchaImage = ref('')
const loading = ref(false)

// Get config store
const configStore = useConfigStore()

// State for area code action sheet
const showAreaCodeSheet = ref(false)
const selectedAreaCode = ref('+86')
// SMS verification code countdown
const smsCountdown = ref(0)
const smsLoading = ref(false)
const areaCodeList = computed(() =>
  (configStore.config.mobileAreaList || []).map((item) => {
    return {
      value: item.key,
      label: `${item.name} (${item.key})`,
    }
  }),
)

const canSendMobileCaptcha = computed(() => {
  const mobile = formData.value.mobile
  const phoneRegex = /^1[3-9]\d{9}$/
  return phoneRegex.test(mobile) && smsCountdown.value === 0
})

// SM2 public key
const sm2PublicKey = computed(() => {
  return configStore.config.sm2PublicKey
})

// Open area code selection dialog
function openAreaCodeSheet() {
  showAreaCodeSheet.value = true
}

// Select area code
function selectAreaCode(item: { value: string, label: string }) {
  selectedAreaCode.value = item.value
  formData.value.areaCode = item.value
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

// Get graphic captcha
async function refreshCaptcha() {
  const uuid = generateUUID()
  formData.value.captchaId = uuid
  captchaImage.value = `${getEnvBaseUrl()}/user/captcha?uuid=${uuid}&t=${Date.now()}`
}

// Send SMS verification code
async function handleSendSmsCode() {
  // Phone format validation
  const phoneRegex = /^1[3-9]\d{9}$/
  if (!phoneRegex.test(formData.value.mobile)) {
    toast.warning(t('retrievePassword.inputCorrectMobile'))
    return
  }

  if (!formData.value.captcha) {
    toast.warning(t('retrievePassword.captchaRequired'))
    return
  }

  try {
    smsLoading.value = true
    // Convert phone number to international format
    const internationalPhone = formData.value.areaCode + formData.value.mobile
    // Call send SMS verification code API
    await sendSmsCode({
      phone: internationalPhone,
      captcha: formData.value.captcha,
      captchaId: formData.value.captchaId,
    })

    toast.success(t('retrievePassword.captchaSendSuccess'))

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
    // Handle captcha error
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

// Reset password
async function handleResetPassword() {
  // Form validation
  if (!formData.value.mobile) {
    toast.warning(t('retrievePassword.mobileRequired'))
    return
  }

  // Phone format validation
  const phoneRegex = /^1[3-9]\d{9}$/
  if (!phoneRegex.test(formData.value.mobile)) {
    toast.warning(t('retrievePassword.inputCorrectMobile'))
    return
  }

  // Convert phone number to international format
  const internationalPhone = formData.value.areaCode + formData.value.mobile

  if (!formData.value.captcha) {
    toast.warning(t('retrievePassword.captchaRequired'))
    return
  }

  if (!formData.value.mobileCaptcha) {
    toast.warning(t('retrievePassword.mobileCaptchaRequired'))
    return
  }

  if (!formData.value.newPassword) {
    toast.warning(t('retrievePassword.newPasswordRequired'))
    return
  }

  if (!formData.value.confirmPassword) {
    toast.warning(t('retrievePassword.confirmNewPasswordRequired'))
    return
  }

  if (formData.value.newPassword !== formData.value.confirmPassword) {
    toast.warning(t('retrievePassword.passwordsNotMatch'))
    return
  }

  try {
    loading.value = true

    // Check if SM2 public key is configured
    if (!sm2PublicKey.value) {
      toast.warning(t('sm2.publicKeyNotConfigured'))
      return
    }

    // Encrypt password
    let encryptedPassword
    try {
      // Concatenate captcha and new password for encryption
      const captchaAndPassword = formData.value.captcha + formData.value.newPassword
      encryptedPassword = sm2Encrypt(sm2PublicKey.value, captchaAndPassword)
    }
    catch (error) {
      console.error('Password encryption failed:', error)
      toast.warning(t('sm2.encryptionFailed'))
      return
    }

    // Call reset password API
    await retrievePassword({
      phone: internationalPhone,
      code: formData.value.mobileCaptcha,
      password: encryptedPassword,
      captchaId: formData.value.captchaId,
    })

    toast.success(t('retrievePassword.passwordUpdateSuccess'))

    // Navigate to login page
    setTimeout(() => {
      uni.redirectTo({
        url: '/pages/login/index',
      })
    }, 1000)
  }
  catch (error: any) {
    // Handle captcha error
    if (error.message.includes('10067')) {
      toast.warning(t('login.captchaError'))
    }
    // Refresh captcha on reset failure
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
      <view class="nx-auth__chip nx-auth__back" role="button" :aria-label="t('retrievePassword.goToLogin')" @click="goBack">
        <wd-icon name="arrow-left" size="18px" />
        <text>{{ tx('register.backToSignIn', 'Sign in') }}</text>
      </view>
    </view>

    <view class="nx-auth__body">
      <view class="nx-auth__hero">
        <image class="nx-auth__logo" src="/static/logo.svg" mode="aspectFit" />
        <text class="nx-auth__title">
          {{ t('retrievePassword.title') }}
        </text>
        <text class="nx-auth__subtitle">
          {{ tx('retrievePassword.heroSubtitle', 'We’ll text a code to your phone so you can choose a new password.') }}
        </text>
      </view>

      <view class="nx-group">
        <view class="nx-group__header">
          {{ tx('retrievePassword.phoneHeader', 'Your phone') }}
        </view>
        <view class="nx-group__body">
          <view class="nx-field">
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
              :placeholder="t('retrievePassword.mobilePlaceholder')"
              placeholder-class="nx-field__placeholder"
            >
          </view>

          <view class="nx-field">
            <wd-icon name="check" size="18px" custom-class="nx-field__icon" />
            <input
              v-model="formData.captcha"
              class="nx-field__input"
              type="text"
              :maxlength="6"
              :placeholder="t('retrievePassword.captchaPlaceholder')"
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

          <view class="nx-field">
            <wd-icon name="phone" size="18px" custom-class="nx-field__icon" />
            <input
              v-model="formData.mobileCaptcha"
              class="nx-field__input"
              type="text"
              :maxlength="6"
              :placeholder="t('retrievePassword.mobileCaptchaPlaceholder')"
              placeholder-class="nx-field__placeholder"
            >
            <view
              class="nx-num nx-field__send"
              :class="{ 'is-disabled': smsCountdown > 0 || smsLoading }"
              role="button"
              @click="smsCountdown > 0 || smsLoading ? null : handleSendSmsCode()"
            >
              {{ smsCountdown > 0 ? `${smsCountdown}s` : t('retrievePassword.getMobileCaptcha') }}
            </view>
          </view>
        </view>
      </view>

      <view class="nx-group">
        <view class="nx-group__header">
          {{ tx('retrievePassword.passwordHeader', 'New password') }}
        </view>
        <view class="nx-group__body">
          <view class="nx-field">
            <wd-icon name="lock-on" size="18px" custom-class="nx-field__icon" />
            <input
              v-model="formData.newPassword"
              class="nx-field__input"
              type="text"
              :password="!showPassword"
              :maxlength="20"
              :placeholder="t('retrievePassword.newPasswordPlaceholder')"
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
              :placeholder="t('retrievePassword.confirmNewPasswordPlaceholder')"
              placeholder-class="nx-field__placeholder"
            >
          </view>
        </view>
      </view>

      <view
        class="nx-btn nx-btn--primary nx-btn--block nx-auth__submit"
        :class="{ 'is-loading': loading }"
        role="button"
        @click="!loading && handleResetPassword()"
      >
        <wd-loading v-if="loading" size="18px" custom-class="nx-auth__spinner" />
        {{ loading ? t('common.loading') : t('retrievePassword.resetButton') }}
      </view>

      <view class="nx-auth__links nx-auth__links--center">
        <text class="nx-auth__link" @click="goBack">
          {{ t('retrievePassword.goToLogin') }}
        </text>
      </view>
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
              :key="item.value"
              class="nx-row nx-row--tap"
              @click="selectAreaCode(item)"
            >
              <view class="nx-row__main">
                <view class="nx-row__title nx-truncate">
                  {{ item.label }}
                </view>
              </view>
              <wd-icon v-if="selectedAreaCode === item.value" name="check" size="18px" custom-class="nx-check" />
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
