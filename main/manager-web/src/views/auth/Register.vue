<template>
  <AuthFrame :title="$t('auth.registerTitle')" :mood="mood" :pulse="pulse">
    <p v-if="closed" class="auth-form__alert" role="alert"><TbIcon name="warning" :size="18" />{{ $t('auth.registerClosed') }}</p>

    <form v-else class="auth-form" novalidate @submit.prevent="submit">
      <RuledField v-if="!mobileEnabled" :label="$t('auth.username')" for-id="register-username" :error="errors.username">
        <TbInput id="register-username" v-model="form.username" :placeholder="$t('auth.usernameNewPh')" autocomplete="username"
          :invalid="!!errors.username" @update:model-value="touch('username')" />
      </RuledField>

      <template v-else>
        <RuledField :label="$t('auth.mobile')" for-id="register-mobile" :error="errors.mobile">
          <TbSelect v-model="form.areaCode" :options="areas" :aria-label="$t('auth.areaCode')" />
          <span class="rf__sep" aria-hidden="true"></span>
          <TbInput id="register-mobile" v-model="form.mobile" type="tel" inputmode="tel" autocomplete="tel-national"
            :placeholder="$t('auth.mobilePh')" :invalid="!!errors.mobile" @update:model-value="touch('mobile')" />
        </RuledField>
        <RuledField :label="$t('auth.captcha')" for-id="register-captcha" :error="errors.captcha">
          <TbInput id="register-captcha" v-model="form.captcha" autocomplete="off" :maxlength="8"
            :placeholder="$t('auth.captchaPh')" :invalid="!!errors.captcha" @update:model-value="touch('captcha')" />
          <template #aside><CaptchaButton :url="captcha.url.value" :state="captcha.state.value" @refresh="captcha.refresh" /></template>
        </RuledField>
        <RuledField :label="$t('auth.smsCode')" for-id="register-smsCode" :error="errors.smsCode">
          <TbInput id="register-smsCode" v-model="form.smsCode" inputmode="numeric" autocomplete="one-time-code" :maxlength="6"
            :placeholder="$t('auth.smsCodePh')" :invalid="!!errors.smsCode" @update:model-value="touch('smsCode')" />
          <template #aside>
            <TbButton size="s" :disabled="!canSend" :loading="sending" @click="sendSms">
              {{ countdown.left.value > 0 ? $t('auth.resendIn', { n: num(countdown.left.value) }) : $t('auth.sendSms') }}
            </TbButton>
          </template>
        </RuledField>
      </template>

      <RuledField :label="$t('auth.password')" for-id="register-password" :error="errors.password">
        <TbInput id="register-password" v-model="form.password" type="password" autocomplete="new-password"
          :placeholder="$t('auth.newPasswordPh')" :invalid="!!errors.password" :show-label="$t('auth.showPassword')"
          :hide-label="$t('auth.hidePassword')" @update:model-value="touch('password')" />
      </RuledField>
      <RuledField :label="$t('auth.confirmPassword')" for-id="register-confirm" :error="errors.confirm">
        <TbInput id="register-confirm" v-model="form.confirm" type="password" autocomplete="new-password"
          :placeholder="$t('auth.confirmPasswordPh')" :invalid="!!errors.confirm" :show-label="$t('auth.showPassword')"
          :hide-label="$t('auth.hidePassword')" @update:model-value="touch('confirm')" />
      </RuledField>

      <RuledField v-if="!mobileEnabled" :label="$t('auth.captcha')" for-id="register-captcha" :error="errors.captcha">
        <TbInput id="register-captcha" v-model="form.captcha" autocomplete="off" :maxlength="8"
          :placeholder="$t('auth.captchaPh')" :invalid="!!errors.captcha" @update:model-value="touch('captcha')" />
        <template #aside><CaptchaButton :url="captcha.url.value" :state="captcha.state.value" @refresh="captcha.refresh" /></template>
      </RuledField>

      <p v-if="failure" class="auth-form__alert" role="alert"><TbIcon name="warning" :size="18" />{{ failure }}</p>

      <TbButton class="auth-form__submit" variant="primary" size="l" block native-type="submit" :loading="busy">
        {{ $t('auth.submitRegister') }}
      </TbButton>

      <div class="auth-form__links">
        <RouterLink class="auth-form__link" :to="{ path: '/login', query: carry }">{{ $t('auth.toLogin') }}</RouterLink>
      </div>
    </form>

    <LegalNote v-if="!closed" keypath="auth.legalRegister" />
  </AuthFrame>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { redirectQuery } from '@/utils/linkCode';
import { useI18n } from 'vue-i18n';
import Api from '@/apis/api';
import { toast } from '@/kit/toast';
import { digits } from '@/kit/calendar';
import { fullMobile, validateMobile } from '@/utils';
import AuthFrame from './AuthFrame.vue';
import RuledField from './RuledField.vue';
import CaptchaButton from './CaptchaButton.vue';
import LegalNote from './LegalNote.vue';
import { NoPublicKeyError, encryptPassword, faceMood, filledCount, mentionsCaptcha } from './authKit';
import { useBusy, useCaptcha, useCountdown, usePubConfig } from './useAuth';

const { t, locale } = useI18n({ useScope: 'global' });
const router = useRouter();
const route = useRoute();
// Keep a sign-in redirect (e.g. back to the robot link page) while moving between the sign-in pages.
const carry = computed(() => redirectQuery(route.query.redirect));
const { mobileEnabled, allowRegister, publicKey, areas, firstArea, load } = usePubConfig();
const captcha = useCaptcha();
const countdown = useCountdown(60);
const { busy, on: busyOn, off: busyOff } = useBusy();
const num = (n) => digits(n, locale.value);

const form = reactive({ username: '', mobile: '', areaCode: firstArea(), captcha: '', smsCode: '', password: '', confirm: '' });
const errors = reactive({ username: '', mobile: '', captcha: '', smsCode: '', password: '', confirm: '' });
const failure = ref('');
const outcome = ref('');
const pulse = ref(false);
const sending = ref(false);
const closed = ref(false);
let leaveTimer = null;

const canSend = computed(() => countdown.left.value === 0 && !sending.value && validateMobile(form.mobile, form.areaCode));
const mood = computed(() => (closed.value ? 'sleepy' : faceMood({
  filled: filledCount([mobileEnabled.value ? form.mobile : form.username, form.password, form.confirm, form.captcha, form.smsCode]),
  outcome: outcome.value,
})));

function touch(key) { errors[key] = ''; failure.value = ''; if (outcome.value === 'error') outcome.value = ''; }
function clearErrors() { Object.keys(errors).forEach((k) => { errors[k] = ''; }); failure.value = ''; }
function fail(message) { failure.value = message; outcome.value = 'error'; }
const phone = () => fullMobile(form.areaCode, form.mobile);

function sendSms() {
  clearErrors();
  if (!validateMobile(form.mobile, form.areaCode)) { errors.mobile = t('auth.err.mobile'); return; }
  if (!form.captcha.trim()) {
    errors.captcha = t('auth.err.captchaFirst');
    captcha.refresh();
    document.getElementById('register-captcha')?.focus();
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
  if (mobileEnabled.value) {
    if (!validateMobile(form.mobile, form.areaCode)) errors.mobile = t('auth.err.mobile');
    if (!form.smsCode.trim()) errors.smsCode = t('auth.err.smsCode');
  } else if (!form.username.trim()) errors.username = t('auth.err.username');
  if (!form.password.trim()) errors.password = t('auth.err.newPassword');
  else if (form.password !== form.confirm) errors.confirm = t('auth.err.mismatch');
  if (!form.captcha.trim()) errors.captcha = t('auth.err.captcha');
  const first = Object.keys(errors).find((k) => errors[k]);
  if (first) {
    outcome.value = 'error';
    document.getElementById(`register-${first}`)?.focus();
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
  Api.user.register({
    username: mobileEnabled.value ? phone() : form.username.trim(),
    password,
    captchaId: captcha.id.value,
    mobileCaptcha: form.smsCode,
  }, () => {
    busyOff();
    outcome.value = 'ok';
    toast.success(t('auth.ok.register'));
    router.push({ path: '/login', query: carry.value });
  }, (err) => {
    busyOff();
    const msg = err && err.data && err.data.msg;
    fail(msg || t('auth.err.register'));
    if (mentionsCaptcha(msg)) { form.captcha = ''; captcha.refresh(); }
  });
}

onMounted(() => {
  captcha.refresh();
  load().then(() => {
    if (!form.mobile) form.areaCode = firstArea();
    if (!allowRegister.value) {
      closed.value = true;
      leaveTimer = setTimeout(() => router.push({ path: '/login', query: carry.value }), 1500);
    }
  });
});
onBeforeUnmount(() => clearTimeout(leaveTimer));
</script>
