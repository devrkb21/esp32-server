<!-- New account (owner: m-auth) -->
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
import { onLoad } from '@dcloudio/uni-app'
import { computed, onMounted, reactive, ref } from 'vue'
import { register, sendSmsCode } from '@/api/auth'
import { getCurrentLanguage, initI18n, t } from '@/i18n'
import { faceMood, filledCount, hasCode, fullPhone, isPhone } from '@/pages/login/authKit.mjs'
import AuthField from '@/pages/login/components/auth-field.vue'
import AuthFrame from '@/pages/login/components/auth-frame.vue'
import CaptchaImage from '@/pages/login/components/captcha-image.vue'
import LegalNote from '@/pages/login/components/legal-note.vue'
import PickSheet from '@/pages/login/components/pick-sheet.vue'
import { useCaptcha, useCountdown, usePubConfig } from '@/pages/login/useAuth'
import { sm2Encrypt } from '@/utils'
import { digits } from '@/utils/calendar.mjs'
import { toast } from '@/utils/toast'

defineOptions({ name: 'RegisterPage' })

initI18n()

const { mobileEnabled, publicKey, areas, firstArea, load } = usePubConfig()
const captcha = useCaptcha()
const countdown = useCountdown(60)

const form = reactive({
  username: '',
  password: '',
  confirmPassword: '',
  captcha: '',
  areaCode: firstArea(),
  mobile: '',
  mobileCaptcha: '',
})
const errors = reactive({ username: '', mobile: '', password: '', confirmPassword: '', captcha: '', mobileCaptcha: '' })
const areaTouched = ref(false)
const failure = ref('')
const outcome = ref('')
const loading = ref(false)
const smsLoading = ref(false)
const pulse = ref(false)
const showArea = ref(false)

const lang = computed(() => getCurrentLanguage())
const areaOptions = computed(() => areas.value.map(a => ({ value: a.key, label: a.name, note: a.key })))
const smsLabel = computed(() => (countdown.left.value > 0 ? t('mauth.resendIn', { n: digits(countdown.left.value, lang.value) }) : t('mauth.sendSms')))
const mood = computed(() => faceMood({
  filled: filledCount([mobileEnabled.value ? form.mobile : form.username, form.password, form.confirmPassword, form.captcha, form.mobileCaptcha]),
  outcome: outcome.value,
}))

type Key = keyof typeof errors
function touch(key: Key) {
  errors[key] = ''
  failure.value = ''
  if (outcome.value === 'error')
    outcome.value = ''
}
function clearErrors() {
  (Object.keys(errors) as Key[]).forEach((k) => {
    errors[k] = ''
  })
  failure.value = ''
}
function fail(key: Key | '', message: string) {
  if (key)
    errors[key] = message
  else failure.value = message
  outcome.value = 'error'
}

function pickArea(key: string) {
  form.areaCode = key
  areaTouched.value = true
  showArea.value = false
}

// The SMS code needs the phone number and the picture code first
async function sendSmsVerification() {
  if (countdown.left.value > 0 || smsLoading.value)
    return
  clearErrors()
  if (!form.mobile)
    return fail('mobile', t('mauth.err.mobile'))
  if (!form.captcha)
    return fail('captcha', t('mauth.err.captchaFirst'))
  if (!isPhone(form.mobile, form.areaCode))
    return fail('mobile', t('mauth.err.mobile'))

  smsLoading.value = true
  try {
    await sendSmsCode({ phone: fullPhone(form.areaCode, form.mobile), captcha: form.captcha, captchaId: captcha.id.value })
    toast.success(t('mauth.smsSent'))
    countdown.start()
  }
  catch (error: any) {
    if (hasCode(error, 10067))
      fail('captcha', t('mauth.err.captchaWrong'))
    captcha.refresh()
  }
  finally {
    smsLoading.value = false
  }
}

async function handleRegister() {
  if (loading.value)
    return
  clearErrors()
  if (mobileEnabled.value) {
    if (!form.mobile || !isPhone(form.mobile, form.areaCode))
      return fail('mobile', t('mauth.err.mobile'))
    if (!form.mobileCaptcha)
      return fail('mobileCaptcha', t('mauth.err.smsCode'))
  }
  else if (!form.username) {
    return fail('username', t('mauth.err.username'))
  }
  if (!form.password)
    return fail('password', t('mauth.err.newPassword'))
  if (!form.confirmPassword)
    return fail('confirmPassword', t('mauth.err.confirm'))
  if (form.password !== form.confirmPassword)
    return fail('confirmPassword', t('mauth.err.mismatch'))
  if (!form.captcha)
    return fail('captcha', t('mauth.err.captcha'))
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

  loading.value = true
  pulse.value = false
  setTimeout(() => {
    pulse.value = true
  }, 16)
  try {
    await register({
      username: mobileEnabled.value ? fullPhone(form.areaCode, form.mobile) : form.username,
      password: encryptedPassword,
      captchaId: captcha.id.value,
      areaCode: form.areaCode,
      mobile: form.mobile,
      mobileCaptcha: form.mobileCaptcha,
    })
    outcome.value = 'ok'
    toast.success(t('mauth.ok.register'))
    setTimeout(() => {
      uni.redirectTo({ url: '/pages/login/index' })
    }, 1000)
  }
  catch (error: any) {
    if (hasCode(error, 10067))
      fail('captcha', t('mauth.err.captchaWrong'))
    else if (hasCode(error, 10070))
      fail('mobile', t('mauth.err.phoneTaken'))
    else outcome.value = 'error'
    form.captcha = ''
    captcha.refresh()
  }
  finally {
    loading.value = false
  }
}

function goBack() {
  uni.redirectTo({ url: '/pages/login/index' })
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
  <AuthFrame :title="t('mauth.registerTitle')" :lead="t('mauth.registerLead')" :mood="mood" :pulse="pulse" back @back="goBack">
    <view class="af-form">
      <AuthField v-if="mobileEnabled" :label="t('mauth.mobile')" :error="errors.mobile">
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
          v-model="form.username" :placeholder="t('mauth.usernameNewPh')" :aria-label="t('mauth.username')"
          :invalid="!!errors.username" @update:model-value="touch('username')"
        />
      </AuthField>

      <AuthField :label="t('mauth.password')" :error="errors.password">
        <tb-input
          v-model="form.password" type="password" :maxlength="20" :placeholder="t('mauth.newPasswordPh')" :aria-label="t('mauth.password')"
          :invalid="!!errors.password" @update:model-value="touch('password')"
        />
      </AuthField>
      <AuthField :label="t('mauth.confirmPassword')" :error="errors.confirmPassword">
        <tb-input
          v-model="form.confirmPassword" type="password" :maxlength="20" :placeholder="t('mauth.confirmPasswordPh')"
          :aria-label="t('mauth.confirmPassword')" :invalid="!!errors.confirmPassword" @update:model-value="touch('confirmPassword')"
        />
      </AuthField>

      <AuthField :label="t('mauth.captcha')" :error="errors.captcha">
        <tb-input
          v-model="form.captcha" :maxlength="6" :placeholder="t('mauth.captchaPh')" :aria-label="t('mauth.captcha')"
          :invalid="!!errors.captcha" @update:model-value="touch('captcha')"
        />
        <template #aside>
          <CaptchaImage :src="captcha.src.value" @refresh="captcha.refresh" />
        </template>
      </AuthField>

      <AuthField v-if="mobileEnabled" :label="t('mauth.smsCode')" :error="errors.mobileCaptcha">
        <tb-input
          v-model="form.mobileCaptcha" type="number" :maxlength="6" :placeholder="t('mauth.smsCodePh')" :aria-label="t('mauth.smsCode')"
          :invalid="!!errors.mobileCaptcha" @update:model-value="touch('mobileCaptcha')"
        />
        <template #aside>
          <tb-button size="s" :loading="smsLoading" :disabled="countdown.left.value > 0" @click="sendSmsVerification">
            {{ smsLabel }}
          </tb-button>
        </template>
      </AuthField>
    </view>
    <text class="af-hint">
      {{ t('mauth.captchaHint') }}
    </text>

    <view v-if="failure" class="af-alert" role="alert">
      <tb-icon name="warning" :size="18" /><text>{{ failure }}</text>
    </view>

    <tb-button class="af-submit" variant="primary" size="l" block :loading="loading" @click="handleRegister">
      {{ loading ? t('mauth.registering') : t('mauth.submitRegister') }}
    </tb-button>

    <view class="af-links">
      <text class="af-link" role="link" @click="goBack">
        {{ t('mauth.toLogin') }}
      </text>
    </view>

    <template #foot>
      <LegalNote sentence="mauth.legalRegister" />
    </template>
  </AuthFrame>

  <PickSheet v-model:open="showArea" :title="t('mauth.areaTitle')" :value="form.areaCode" :options="areaOptions" @pick="pickArea" />
</template>

<style lang="scss">
@import '../login/components/auth-form.scss';
</style>
