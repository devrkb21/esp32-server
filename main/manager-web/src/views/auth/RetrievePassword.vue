<template>
  <AuthFrame :title="$t('auth.resetTitle')" :lead="$t('auth.resetLead')" :mood="mood" :pulse="pulse">
    <form class="auth-form" novalidate @submit.prevent="submit">
      <RuledField :label="$t('auth.mobile')" for-id="reset-mobile" :error="errors.mobile">
        <TbSelect v-model="form.areaCode" :options="areas" :aria-label="$t('auth.areaCode')" />
        <span class="rf__sep" aria-hidden="true"></span>
        <TbInput id="reset-mobile" v-model="form.mobile" type="tel" inputmode="tel" autocomplete="tel-national"
          :placeholder="$t('auth.mobilePh')" :invalid="!!errors.mobile" @update:model-value="touch('mobile')" />
      </RuledField>
      <RuledField :label="$t('auth.captcha')" for-id="reset-captcha" :error="errors.captcha">
        <TbInput id="reset-captcha" v-model="form.captcha" autocomplete="off" :maxlength="8"
          :placeholder="$t('auth.captchaPh')" :invalid="!!errors.captcha" @update:model-value="touch('captcha')" />
        <template #aside><CaptchaButton :url="captcha.url.value" :state="captcha.state.value" @refresh="captcha.refresh" /></template>
      </RuledField>
      <RuledField :label="$t('auth.smsCode')" for-id="reset-smsCode" :error="errors.smsCode">
        <TbInput id="reset-smsCode" v-model="form.smsCode" inputmode="numeric" autocomplete="one-time-code" :maxlength="6"
          :placeholder="$t('auth.smsCodePh')" :invalid="!!errors.smsCode" @update:model-value="touch('smsCode')" />
        <template #aside>
          <TbButton size="s" :disabled="!canSend" :loading="sending" @click="sendSms">
            {{ countdown.left.value > 0 ? $t('auth.resendIn', { n: num(countdown.left.value) }) : $t('auth.sendSms') }}
          </TbButton>
        </template>
      </RuledField>
      <RuledField :label="$t('auth.newPassword')" for-id="reset-password" :error="errors.password">
        <TbInput id="reset-password" v-model="form.password" type="password" autocomplete="new-password"
          :placeholder="$t('auth.newPasswordPh')" :invalid="!!errors.password" :show-label="$t('auth.showPassword')"
          :hide-label="$t('auth.hidePassword')" @update:model-value="touch('password')" />
      </RuledField>
      <RuledField :label="$t('auth.confirmPassword')" for-id="reset-confirm" :error="errors.confirm">
        <TbInput id="reset-confirm" v-model="form.confirm" type="password" autocomplete="new-password"
          :placeholder="$t('auth.confirmPasswordPh')" :invalid="!!errors.confirm" :show-label="$t('auth.showPassword')"
          :hide-label="$t('auth.hidePassword')" @update:model-value="touch('confirm')" />
      </RuledField>

      <p v-if="failure" class="auth-form__alert" role="alert"><TbIcon name="warning" :size="18" />{{ failure }}</p>

      <TbButton class="auth-form__submit" variant="primary" size="l" block native-type="submit" :loading="busy">
        {{ $t('auth.submitReset') }}
      </TbButton>

      <div class="auth-form__links">
        <RouterLink class="auth-form__link" to="/login"><TbIcon name="chevron-left" :size="16" />{{ $t('auth.backToLogin') }}</RouterLink>
      </div>
    </form>

    <LegalNote keypath="auth.legalReset" />
  </AuthFrame>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import Api from '@/apis/api';
import { toast } from '@/kit/toast';
import { digits } from '@/kit/calendar';
import { validateMobile } from '@/utils';
import AuthFrame from './AuthFrame.vue';
import RuledField from './RuledField.vue';
import CaptchaButton from './CaptchaButton.vue';
import LegalNote from './LegalNote.vue';
import { NoPublicKeyError, encryptPassword, faceMood, filledCount, mentionsCaptcha } from './authKit';
import { useBusy, useCaptcha, useCountdown, usePubConfig } from './useAuth';

const { t, locale } = useI18n({ useScope: 'global' });
const router = useRouter();
const { publicKey, areas, firstArea, load } = usePubConfig();
const captcha = useCaptcha();
const countdown = useCountdown(60);
const { busy, on: busyOn, off: busyOff } = useBusy();
const num = (n) => digits(n, locale.value);

const form = reactive({ areaCode: firstArea(), mobile: '', captcha: '', smsCode: '', password: '', confirm: '' });
const errors = reactive({ mobile: '', captcha: '', smsCode: '', password: '', confirm: '' });
const failure = ref('');
const outcome = ref('');
const pulse = ref(false);
const sending = ref(false);

const canSend = computed(() => countdown.left.value === 0 && !sending.value && validateMobile(form.mobile, form.areaCode));
const mood = computed(() => faceMood({
  filled: filledCount([form.mobile, form.captcha, form.smsCode, form.password, form.confirm]),
  outcome: outcome.value,
}));

function touch(key) { errors[key] = ''; failure.value = ''; if (outcome.value === 'error') outcome.value = ''; }
function clearErrors() { Object.keys(errors).forEach((k) => { errors[k] = ''; }); failure.value = ''; }
function fail(message) { failure.value = message; outcome.value = 'error'; }
const phone = () => form.areaCode + form.mobile.replace(/\s/g, '');

function sendSms() {
  clearErrors();
  if (!validateMobile(form.mobile, form.areaCode)) { errors.mobile = t('auth.err.mobile'); return; }
  if (!form.captcha.trim()) {
    errors.captcha = t('auth.err.captchaFirst');
    captcha.refresh();
    document.getElementById('reset-captcha')?.focus();
    return;
  }
  countdown.start();
  sending.value = true;
  Api.user.sendSmsVerification({ phone: phone(), captcha: form.captcha, captchaId: captcha.id.value }, () => {
    sending.value = false;
    toast.success(t('auth.smsSent'));
  }, (err) => {
    sending.value = false;
    countdown.stop();
    fail((err && err.data && err.data.msg) || t('auth.smsFailed'));
    form.captcha = '';
    captcha.refresh();
  });
}

function validate() {
  clearErrors();
  if (!validateMobile(form.mobile, form.areaCode)) errors.mobile = t('auth.err.mobile');
  if (!form.captcha.trim()) errors.captcha = t('auth.err.captcha');
  if (!form.smsCode.trim()) errors.smsCode = t('auth.err.smsCode');
  if (!form.password.trim()) errors.password = t('auth.err.newPassword');
  else if (form.password !== form.confirm) errors.confirm = t('auth.err.mismatch');
  const first = Object.keys(errors).find((k) => errors[k]);
  if (first) {
    outcome.value = 'error';
    document.getElementById(`reset-${first}`)?.focus();
    return false;
  }
  return true;
}

function submit() {
  if (busy.value || !validate()) return;
  let password;
  try {
    password = encryptPassword(publicKey.value, form.captcha, form.password);
  } catch (e) {
    fail(e instanceof NoPublicKeyError ? t('auth.err.noKey') : t('auth.err.encrypt'));
    return;
  }
  pulse.value = false; requestAnimationFrame(() => { pulse.value = true; });
  busyOn();
  Api.user.retrievePassword({ phone: phone(), password, code: form.smsCode, captchaId: captcha.id.value }, () => {
    busyOff();
    outcome.value = 'ok';
    toast.success(t('auth.ok.reset'));
    router.push('/login');
  }, (err) => {
    busyOff();
    const msg = err && err.data && err.data.msg;
    fail(msg || t('auth.err.reset'));
    if (mentionsCaptcha(msg)) { form.captcha = ''; captcha.refresh(); }
  });
}

onMounted(() => {
  captcha.refresh();
  load().then(() => { if (!form.mobile) form.areaCode = firstArea(); });
});
</script>
