<!-- Sign in (owner: m-auth) -->
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
import { onLoad } from '@dcloudio/uni-app'
import { computed, onMounted, reactive, ref } from 'vue'
import { login } from '@/api/auth'
import { changeLanguage, getCurrentLanguage, getSupportedLanguages, initI18n, t } from '@/i18n'
import { useUserStore } from '@/store'
import { sm2Encrypt } from '@/utils'
import { toast } from '@/utils/toast'
import { faceMood, filledCount, fullPhone, isPhone } from './authKit.mjs'
import AuthField from './components/auth-field.vue'
import AuthFrame from './components/auth-frame.vue'
import CaptchaImage from './components/captcha-image.vue'
import LegalNote from './components/legal-note.vue'
import PickSheet from './components/pick-sheet.vue'
import { useCaptcha, usePubConfig } from './useAuth'

defineOptions({ name: 'LoginPage' })

initI18n()

const userStore = useUserStore()
const { mobileEnabled, publicKey, areas, firstArea, load } = usePubConfig()
const captcha = useCaptcha()

// Sign in with a username, or (when the server allows it) a mobile number
const loginType = ref<'username' | 'mobile'>('username')
const form = reactive({ username: '', password: '', captcha: '', mobile: '', areaCode: firstArea() })
const errors = reactive({ username: '', mobile: '', password: '', captcha: '' })
const areaTouched = ref(false)
const failure = ref('')
const outcome = ref('')
const loading = ref(false)
const pulse = ref(false)
const showArea = ref(false)
const showLanguage = ref(false)

const lang = computed(() => getCurrentLanguage())
const languages = getSupportedLanguages()
const languageName = computed(() => languages.find(l => l.code === lang.value)?.name || '')
const languageOptions = computed(() => languages.map(l => ({ value: l.code, label: l.name })))
const areaOptions = computed(() => areas.value.map(a => ({ value: a.key, label: a.name, note: a.key })))
const typeOptions = computed(() => [
  { value: 'username', label: t('mauth.byUsername') },
  { value: 'mobile', label: t('mauth.byMobile') },
])
const mood = computed(() => faceMood({
  filled: filledCount([loginType.value === 'mobile' ? form.mobile : form.username, form.password, form.captcha]),
  outcome: outcome.value,
}))

function touch(key: keyof typeof errors) {
  errors[key] = ''
  failure.value = ''
  if (outcome.value === 'error')
    outcome.value = ''
}
function clearErrors() {
  (Object.keys(errors) as (keyof typeof errors)[]).forEach((k) => {
    errors[k] = ''
  })
  failure.value = ''
}
function fail(key: keyof typeof errors | '', message: string) {
  if (key)
    errors[key] = message
  else failure.value = message
  outcome.value = 'error'
}

// Switching the method clears both identity fields (as before)
function setLoginType(type: 'username' | 'mobile') {
  if (loginType.value === type)
    return
  loginType.value = type
  form.username = ''
  form.mobile = ''
  clearErrors()
}

function pickArea(key: string) {
  form.areaCode = key
  areaTouched.value = true
  showArea.value = false
}

function pickLanguage(code: string) {
  changeLanguage(code as Language)
  showLanguage.value = false
}

function goToRegister() {
  uni.navigateTo({ url: '/pages/register/index' })
}
function goToForgotPassword() {
  uni.navigateTo({ url: '/pages/forgot-password/index' })
}
function goToServerSetting() {
  uni.switchTab({ url: '/pages/settings/index' })
}

async function handleLogin() {
  if (loading.value)
    return
  clearErrors()
  if (loginType.value === 'username') {
    if (!form.username)
      return fail('username', t('mauth.err.username'))
  }
  else if (!form.mobile || !isPhone(form.mobile, form.areaCode)) {
    return fail('mobile', t('mauth.err.mobile'))
  }
  if (!form.password)
    return fail('password', t('mauth.err.password'))
  if (!form.captcha)
    return fail('captcha', t('mauth.err.captcha'))

  // The password travels SM2-encrypted with the server's public key, behind the picture code
  if (!publicKey.value)
    return fail('', t('mauth.err.noKey'))
  let encryptedPassword = ''
  try {
    encryptedPassword = sm2Encrypt(publicKey.value, form.captcha + form.password)
  }
  catch (error) {
    console.error('Password encryption failed:', error)
    return fail('', t('mauth.err.encrypt'))
  }

  const loginData: LoginData = {
    username: loginType.value === 'mobile' ? fullPhone(form.areaCode, form.mobile) : form.username,
    password: encryptedPassword,
    captchaId: captcha.id.value,
  }

  loading.value = true
  pulse.value = false
  setTimeout(() => {
    pulse.value = true
  }, 16)
  try {
    const response = await login(loginData)
    uni.setStorageSync('token', JSON.stringify(response))
    await userStore.getUserInfo()
    outcome.value = 'ok'
    toast.success(t('mauth.ok.signIn'))
    setTimeout(() => {
      uni.reLaunch({ url: '/pages/index/index' })
    }, 1000)
  }
  catch {
    // The request layer has already said why; a used picture code is never valid again
    outcome.value = 'error'
    form.captcha = ''
    captcha.refresh()
  }
  finally {
    loading.value = false
  }
}

onLoad(() => {
  captcha.refresh()
})

onMounted(async () => {
  await load()
  if (!areaTouched.value)
    form.areaCode = firstArea()
})
</script>

<template>
  <AuthFrame :title="t('mauth.signInTitle')" :lead="t('mauth.signInLead')" :mood="mood" :pulse="pulse">
    <template #tools>
      <view class="auth-tool" role="button" :aria-label="t('mauth.language')" hover-class="is-press" @click="showLanguage = true">
        <tb-icon name="language" :size="18" />
        <text class="auth-tool__text">
          {{ languageName }}
        </text>
      </view>
      <view class="auth-tool auth-tool--icon" role="button" :aria-label="t('mauth.serverSetting')" hover-class="is-press" @click="goToServerSetting">
        <tb-icon name="server" :size="20" />
      </view>
    </template>

    <tb-choice
      v-if="mobileEnabled" class="af-method" :model-value="loginType" :options="typeOptions" :aria-label="t('mauth.method')"
      @change="setLoginType"
    />

    <view class="af-form">
      <AuthField v-if="loginType === 'mobile'" :label="t('mauth.mobile')" :error="errors.mobile">
        <view class="af__area" role="button" :aria-label="t('mauth.areaCode')" @click="showArea = true">
          <text class="tb-num">
            {{ form.areaCode }}
          </text><tb-icon name="chevron-down" :size="14" />
        </view>
        <tb-input
          v-model="form.mobile" type="number" :maxlength="15" :placeholder="t('mauth.mobilePh')" :aria-label="t('mauth.mobile')"
          :invalid="!!errors.mobile" @update:model-value="touch('mobile')"
        />
      </AuthField>
      <AuthField v-else :label="t('mauth.username')" :error="errors.username">
        <tb-input
          v-model="form.username" :placeholder="t('mauth.usernamePh')" :aria-label="t('mauth.username')"
          :invalid="!!errors.username" @update:model-value="touch('username')"
        />
      </AuthField>

      <AuthField :label="t('mauth.password')" :error="errors.password">
        <tb-input
          v-model="form.password" type="password" :maxlength="20" :placeholder="t('mauth.passwordPh')" :aria-label="t('mauth.password')"
          :invalid="!!errors.password" @update:model-value="touch('password')"
        />
      </AuthField>

      <AuthField :label="t('mauth.captcha')" :error="errors.captcha">
        <tb-input
          v-model="form.captcha" :maxlength="6" :placeholder="t('mauth.captchaPh')" :aria-label="t('mauth.captcha')"
          :invalid="!!errors.captcha" confirm-type="go" @update:model-value="touch('captcha')" @confirm="handleLogin"
        />
        <template #aside>
          <CaptchaImage :src="captcha.src.value" @refresh="captcha.refresh" />
        </template>
      </AuthField>
    </view>

    <view v-if="failure" class="af-alert" role="alert">
      <tb-icon name="warning" :size="18" /><text>{{ failure }}</text>
    </view>

    <tb-button class="af-submit" variant="primary" size="l" block :loading="loading" @click="handleLogin">
      {{ loading ? t('mauth.signingIn') : t('mauth.submitSignIn') }}
    </tb-button>

    <view class="af-links">
      <text class="af-link" role="link" @click="goToRegister">
        {{ t('mauth.toRegister') }}
      </text>
      <text class="af-link" role="link" @click="goToForgotPassword">
        {{ t('mauth.toReset') }}
      </text>
    </view>

    <template #foot>
      <LegalNote sentence="mauth.legalSignIn" />
    </template>
  </AuthFrame>

  <PickSheet v-model:open="showArea" :title="t('mauth.areaTitle')" :value="form.areaCode" :options="areaOptions" @pick="pickArea" />
  <PickSheet v-model:open="showLanguage" :title="t('mauth.language')" :value="lang" :options="languageOptions" @pick="pickLanguage" />
</template>

<style lang="scss">
@import './components/auth-form.scss';

.auth-tool {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  padding: 0 10px;
  border-radius: 999px;
  color: var(--tb-ink-2);
  font-size: 14px;
  font-weight: 600;
}
.auth-tool.is-press {
  background: var(--tb-paper-2);
}
.auth-tool--icon {
  width: 44px;
  padding: 0;
  justify-content: center;
}
.auth-tool__text {
  max-width: 112px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
