<!-- New password through an SMS code (owner: m-auth) -->
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
import { computed, onMounted, reactive, ref } from 'vue'
import { retrievePassword, sendSmsCode } from '@/api/auth'
import { getCurrentLanguage, initI18n, t } from '@/i18n'
import { faceMood, filledCount, hasCode, fullPhone, isPhone } from '@/pages/login/authKit.mjs'
import AuthField from '@/pages/login/components/auth-field.vue'
import AuthFrame from '@/pages/login/components/auth-frame.vue'
import CaptchaImage from '@/pages/login/components/captcha-image.vue'
import PickSheet from '@/pages/login/components/pick-sheet.vue'
import { useCaptcha, useCountdown, usePubConfig } from '@/pages/login/useAuth'
import { sm2Encrypt } from '@/utils'
import { digits } from '@/utils/calendar.mjs'
import { toast } from '@/utils/toast'

defineOptions({ name: 'ForgotPasswordPage' })

initI18n()

const { publicKey, areas, firstArea, load } = usePubConfig()
const captcha = useCaptcha()
const countdown = useCountdown(60)

const form = reactive({
  mobile: '',
  captcha: '',
  mobileCaptcha: '',
  newPassword: '',
  confirmPassword: '',
  areaCode: firstArea(),
})
const errors = reactive({ mobile: '', captcha: '', mobileCaptcha: '', newPassword: '', confirmPassword: '' })
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
  filled: filledCount([form.mobile, form.captcha, form.mobileCaptcha, form.newPassword, form.confirmPassword]),
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

// The phone number in international form: country code + number
const internationalPhone = () => fullPhone(form.areaCode, form.mobile)

async function handleSendSmsCode() {
  if (countdown.left.value > 0 || smsLoading.value)
    return
  clearErrors()
  if (!isPhone(form.mobile, form.areaCode))
    return fail('mobile', t('mauth.err.mobile'))
  if (!form.captcha)
    return fail('captcha', t('mauth.err.captchaFirst'))

  smsLoading.value = true
  try {
    await sendSmsCode({ phone: internationalPhone(), captcha: form.captcha, captchaId: captcha.id.value })
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

async function handleResetPassword() {
  if (loading.value)
    return
  clearErrors()
  if (!form.mobile || !isPhone(form.mobile, form.areaCode))
    return fail('mobile', t('mauth.err.mobile'))
  if (!form.captcha)
    return fail('captcha', t('mauth.err.captcha'))
  if (!form.mobileCaptcha)
    return fail('mobileCaptcha', t('mauth.err.smsCode'))
  if (!form.newPassword)
    return fail('newPassword', t('mauth.err.newPassword'))
  if (!form.confirmPassword)
    return fail('confirmPassword', t('mauth.err.confirm'))
  if (form.newPassword !== form.confirmPassword)
    return fail('confirmPassword', t('mauth.err.mismatch'))
  if (!publicKey.value)
    return fail('', t('mauth.err.noKey'))

  let encryptedPassword = ''
  try {
    encryptedPassword = sm2Encrypt(publicKey.value, form.captcha + form.newPassword)
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
    await retrievePassword({
      phone: internationalPhone(),
      code: form.mobileCaptcha,
      password: encryptedPassword,
      captchaId: captcha.id.value,
    })
    outcome.value = 'ok'
    toast.success(t('mauth.ok.reset'))
    setTimeout(() => {
      uni.redirectTo({ url: '/pages/login/index' })
    }, 1000)
  }
  catch (error: any) {
    if (hasCode(error, 10067))
      fail('captcha', t('mauth.err.captchaWrong'))
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
  <AuthFrame :title="t('mauth.resetTitle')" :lead="t('mauth.resetLead')" :mood="mood" :pulse="pulse" back @back="goBack">
    <view class="af-form">
      <AuthField :label="t('mauth.mobile')" :error="errors.mobile">
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

      <AuthField :label="t('mauth.captcha')" :error="errors.captcha">
        <tb-input
          v-model="form.captcha" :maxlength="6" :placeholder="t('mauth.captchaPh')" :aria-label="t('mauth.captcha')"
          :invalid="!!errors.captcha" @update:model-value="touch('captcha')"
        />
        <template #aside>
          <CaptchaImage :src="captcha.src.value" @refresh="captcha.refresh" />
        </template>
      </AuthField>

      <AuthField :label="t('mauth.smsCode')" :error="errors.mobileCaptcha">
        <tb-input
          v-model="form.mobileCaptcha" :maxlength="6" :placeholder="t('mauth.smsCodePh')" :aria-label="t('mauth.smsCode')"
          :invalid="!!errors.mobileCaptcha" @update:model-value="touch('mobileCaptcha')"
        />
        <template #aside>
          <tb-button size="s" :loading="smsLoading" :disabled="countdown.left.value > 0" @click="handleSendSmsCode">
            {{ smsLabel }}
          </tb-button>
        </template>
      </AuthField>

      <AuthField :label="t('mauth.newPassword')" :error="errors.newPassword">
        <tb-input
          v-model="form.newPassword" type="password" :maxlength="20" :placeholder="t('mauth.newPasswordPh')"
          :aria-label="t('mauth.newPassword')" :invalid="!!errors.newPassword" @update:model-value="touch('newPassword')"
        />
      </AuthField>
      <AuthField :label="t('mauth.confirmPassword')" :error="errors.confirmPassword">
        <tb-input
          v-model="form.confirmPassword" type="password" :maxlength="20" :placeholder="t('mauth.confirmPasswordPh')"
          :aria-label="t('mauth.confirmPassword')" :invalid="!!errors.confirmPassword" @update:model-value="touch('confirmPassword')"
        />
      </AuthField>
    </view>
    <text class="af-hint">
      {{ t('mauth.captchaHint') }}
    </text>

    <view v-if="failure" class="af-alert" role="alert">
      <tb-icon name="warning" :size="18" /><text>{{ failure }}</text>
    </view>

    <tb-button class="af-submit" variant="primary" size="l" block :loading="loading" @click="handleResetPassword">
      {{ loading ? t('mauth.resetting') : t('mauth.submitReset') }}
    </tb-button>

    <view class="af-links">
      <text class="af-link" role="link" @click="goBack">
        {{ t('mauth.backToLogin') }}
      </text>
    </view>
  </AuthFrame>

  <PickSheet v-model:open="showArea" :title="t('mauth.areaTitle')" :value="form.areaCode" :options="areaOptions" @pick="pickArea" />
</template>

<style lang="scss">
@import '../login/components/auth-form.scss';
</style>
