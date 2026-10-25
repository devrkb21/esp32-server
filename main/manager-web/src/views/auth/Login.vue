<template>
  <AuthFrame :title="$t('auth.signInTitle')" :mood="mood" :pulse="pulse">
    <TbChoice v-if="mobileEnabled" class="auth-form__method" :model-value="mode" :options="modeOptions"
      :aria-label="$t('auth.method')" @change="switchMode" />

    <form class="auth-form" novalidate @submit.prevent="submit">
      <RuledField v-if="mode === 'username'" :label="$t('auth.username')" for-id="login-username" :error="errors.username">
        <TbInput id="login-username" v-model="form.username" :placeholder="$t('auth.usernamePh')" autocomplete="username"
          :invalid="!!errors.username" @update:model-value="touch('username')" />
      </RuledField>

      <RuledField v-else :label="$t('auth.mobile')" for-id="login-mobile" :error="errors.mobile">
        <TbSelect v-model="form.areaCode" :options="areas" :aria-label="$t('auth.areaCode')" />
        <span class="rf__sep" aria-hidden="true"></span>
        <TbInput id="login-mobile" v-model="form.mobile" type="tel" inputmode="tel" autocomplete="tel-national"
          :placeholder="$t('auth.mobilePh')" :invalid="!!errors.mobile" @update:model-value="touch('mobile')" />
      </RuledField>

      <RuledField :label="$t('auth.password')" for-id="login-password" :error="errors.password">
        <TbInput id="login-password" v-model="form.password" type="password" autocomplete="current-password"
          :placeholder="$t('auth.passwordPh')" :invalid="!!errors.password" :show-label="$t('auth.showPassword')"
          :hide-label="$t('auth.hidePassword')" @update:model-value="touch('password')" />
      </RuledField>

      <RuledField :label="$t('auth.captcha')" for-id="login-captcha" :error="errors.captcha">
        <TbInput id="login-captcha" v-model="form.captcha" autocomplete="off" :maxlength="8"
          :placeholder="$t('auth.captchaPh')" :invalid="!!errors.captcha" @update:model-value="touch('captcha')" />
        <template #aside><CaptchaButton :url="captcha.url.value" :state="captcha.state.value" @refresh="captcha.refresh" /></template>
      </RuledField>

      <p v-if="failure" class="auth-form__alert" role="alert"><TbIcon name="warning" :size="18" />{{ failure }}</p>

      <TbButton class="auth-form__submit" variant="primary" size="l" block native-type="submit" :loading="busy">
        {{ $t('auth.submitSignIn') }}
      </TbButton>

      <div v-if="allowRegister || mobileEnabled" class="auth-form__links">
        <RouterLink v-if="allowRegister" class="auth-form__link" to="/register">{{ $t('auth.toRegister') }}</RouterLink>
        <RouterLink v-if="mobileEnabled" class="auth-form__link" to="/retrieve-password">{{ $t('auth.toReset') }}</RouterLink>
      </div>
    </form>

    <LegalNote keypath="auth.legalSignIn" />
  </AuthFrame>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import Api from '@/apis/api';
import { toast } from '@/kit/toast';
import { validateMobile } from '@/utils';
import AuthFrame from './AuthFrame.vue';
import RuledField from './RuledField.vue';
import CaptchaButton from './CaptchaButton.vue';
import LegalNote from './LegalNote.vue';
import { NoPublicKeyError, encryptPassword, faceMood, filledCount } from './authKit';
import { useBusy, useCaptcha, usePubConfig } from './useAuth';

const { t } = useI18n({ useScope: 'global' });
const router = useRouter();
const { store, mobileEnabled, allowRegister, publicKey, areas, firstArea, load } = usePubConfig();
const captcha = useCaptcha();
const { busy, on: busyOn, off: busyOff } = useBusy();

const mode = ref('username'); // username | mobile
const form = reactive({ username: '', mobile: '', areaCode: firstArea(), password: '', captcha: '' });
const errors = reactive({ username: '', mobile: '', password: '', captcha: '' });
const failure = ref('');
const outcome = ref('');
const pulse = ref(false);

const modeOptions = computed(() => [
  { value: 'mobile', label: t('auth.byMobile') },
  { value: 'username', label: t('auth.byUsername') },
]);
const mood = computed(() => faceMood({
  filled: filledCount([mode.value === 'mobile' ? form.mobile : form.username, form.password, form.captcha]),
  outcome: outcome.value,
}));

function touch(key) { errors[key] = ''; failure.value = ''; if (outcome.value === 'error') outcome.value = ''; }
function clearErrors() { Object.keys(errors).forEach((k) => { errors[k] = ''; }); failure.value = ''; }

function hasToken() {
  try { return Boolean(localStorage.getItem('token')); } catch (e) { return false; }
}

function switchMode(next) {
  mode.value = next;
  form.username = ''; form.mobile = ''; form.password = ''; form.captcha = '';
  clearErrors();
  captcha.refresh();
}

function fail(message) {
  failure.value = message;
  outcome.value = 'error';
}

function validate() {
  clearErrors();
  if (mode.value === 'mobile') {
    if (!validateMobile(form.mobile, form.areaCode)) errors.mobile = t('auth.err.mobile');
  } else if (!form.username.trim()) errors.username = t('auth.err.username');
  if (!form.password.trim()) errors.password = t('auth.err.password');
  if (!form.captcha.trim()) errors.captcha = t('auth.err.captcha');
  const first = Object.keys(errors).find((k) => errors[k]);
  if (first) {
    outcome.value = 'error';
    document.getElementById(`login-${first}`)?.focus();
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
  const username = mode.value === 'mobile' ? form.areaCode + form.mobile.replace(/\s/g, '') : form.username.trim();
  pulse.value = false; requestAnimationFrame(() => { pulse.value = true; });
  busyOn();
  Api.user.login({ username, password, captchaId: captcha.id.value }, ({ data }) => {
    store.commit('setToken', JSON.stringify(data.data));
    Api.user.getUserInfo(({ data: info }) => {
      busyOff();
      if (info.code === 0) {
        store.commit('setUserInfo', info.data);
        outcome.value = 'ok';
        toast.success(t('auth.ok.signIn'));
        router.push('/today');
      } else {
        fail(info.msg || t('auth.err.userInfo'));
      }
    });
  }, (err) => {
    busyOff();
    fail((err && err.data && err.data.msg) || t('auth.err.signIn'));
    form.captcha = '';
    captcha.refresh();
  });
}

onMounted(() => {
  if (hasToken()) { router.push('/today'); return; }
  captcha.refresh();
  load().then(() => {
    mode.value = mobileEnabled.value ? 'mobile' : 'username';
    if (!form.mobile) form.areaCode = firstArea();
  });
});
</script>
