<template>
  <div class="nx-auth">
    <aside class="nx-auth__aside">
      <div class="nx-auth__brand">
        <img src="@/assets/nobix/mark.svg" alt="" width="36" height="36" />
        <span>Nobix <span class="nx-auth__brand-product">Console</span></span>
      </div>
      <div class="nx-auth__hero">
        <div class="nx-bot" aria-hidden="true">
          <span class="nx-bot__antenna"></span>
          <span class="nx-bot__ear nx-bot__ear--l"></span>
          <span class="nx-bot__ear nx-bot__ear--r"></span>
          <span class="nx-bot__head">
            <span class="nx-bot__visor">
              <span class="nx-bot__eye nx-bot__eye--l"></span>
              <span class="nx-bot__eye nx-bot__eye--r"></span>
              <span class="nx-bot__cheek nx-bot__cheek--l"></span>
              <span class="nx-bot__cheek nx-bot__cheek--r"></span>
              <span class="nx-bot__smile"></span>
            </span>
          </span>
        </div>
        <p class="nx-auth__tagline">{{ tt('auth.tagline', 'Look after your robots, their voices and every conversation, all in one calm place.') }}</p>
      </div>
    </aside>

    <main class="nx-auth__main">
      <div class="nx-auth__topbar">
        <div class="nx-auth__brand nx-auth__brand--compact">
          <img src="@/assets/nobix/mark.svg" alt="" width="30" height="30" />
          <span>Nobix <span class="nx-auth__brand-product">Console</span></span>
        </div>
      </div>

      <div class="nx-auth__center">
        <section class="nx-auth-card" aria-labelledby="reset-title">
          <h1 id="reset-title" class="nx-auth-card__title">{{ $t('retrievePassword.title') }}</h1>
          <p class="nx-auth-card__subtitle">{{ tt('auth.resetSubtitle', "We'll text you a code so you can choose a new password.") }}</p>

          <form class="nx-auth-form" novalidate @submit.prevent="retrievePassword">
            <!-- Mobile -->
            <div class="nx-field">
              <label class="nx-field__label" for="reset-mobile">{{ $t('retrievePassword.mobile') }}</label>
              <div class="nx-field__row">
                <el-select v-model="form.areaCode" class="nx-auth-area" filterable>
                  <el-option v-for="item in mobileAreaList" :key="item.key" :label="`${item.name} (${item.key})`"
                    :value="item.key" />
                </el-select>
                <el-input id="reset-mobile" v-model="form.mobile" :placeholder="$t('retrievePassword.mobilePlaceholder')"
                  autocomplete="tel-national" inputmode="tel" />
              </div>
            </div>

            <!-- Image captcha -->
            <div class="nx-field">
              <label class="nx-field__label" for="reset-captcha">{{ $t('retrievePassword.captcha') }}</label>
              <div class="nx-field__row">
                <el-input id="reset-captcha" v-model="form.captcha"
                  :placeholder="$t('retrievePassword.captchaPlaceholder')" autocomplete="off" />
                <button v-if="captchaUrl" type="button" class="nx-auth-captcha"
                  :aria-label="tt('auth.refreshCaptcha', 'Get a new code')"
                  :title="tt('auth.refreshCaptcha', 'Get a new code')" @click="fetchCaptcha">
                  <img :src="captchaUrl" alt="Captcha" />
                </button>
              </div>
            </div>

            <!-- SMS code -->
            <div class="nx-field">
              <label class="nx-field__label" for="reset-sms">{{ $t('retrievePassword.mobileCaptcha') }}</label>
              <div class="nx-field__row">
                <el-input id="reset-sms" v-model="form.mobileCaptcha"
                  :placeholder="$t('retrievePassword.mobileCaptchaPlaceholder')" maxlength="6" inputmode="numeric"
                  autocomplete="one-time-code" />
                <el-button class="nx-auth-send" :disabled="!canSendMobileCaptcha" @click="sendMobileCaptcha">
                  {{ countdown > 0 ? `${countdown}${$t('register.secondsLater')}` : $t('retrievePassword.getMobileCaptcha') }}
                </el-button>
              </div>
            </div>

            <!-- New password -->
            <div class="nx-field">
              <label class="nx-field__label" for="reset-password">{{ $t('retrievePassword.newPassword') }}</label>
              <el-input id="reset-password" v-model="form.newPassword"
                :placeholder="$t('retrievePassword.newPasswordPlaceholder')" type="password" show-password
                autocomplete="new-password" />
            </div>

            <div class="nx-field">
              <label class="nx-field__label" for="reset-confirm">{{ $t('retrievePassword.confirmNewPassword') }}</label>
              <el-input id="reset-confirm" v-model="form.confirmPassword"
                :placeholder="$t('retrievePassword.confirmNewPasswordPlaceholder')" type="password" show-password
                autocomplete="new-password" />
            </div>

            <el-button type="primary" native-type="submit" class="nx-auth-submit">
              {{ $t('retrievePassword.resetButton') }}
            </el-button>

            <div class="nx-auth-links nx-auth-links--center">
              <button type="button" class="nx-link" @click="goToLogin">
                <i class="el-icon-arrow-left" aria-hidden="true"></i> {{ $t('retrievePassword.goToLogin') }}
              </button>
            </div>
          </form>

          <p class="nx-auth-legal">
            {{ $t('retrievePassword.agreeTo') }}
            <button type="button" class="nx-link" @click="openPage('/user-agreement.html')">{{ $t('register.userAgreement') }}</button>
            {{ $t('login.and') }}
            <button type="button" class="nx-link" @click="openPage('/privacy-policy.html')">{{ $t('register.privacyPolicy') }}</button>
          </p>
        </section>
      </div>

      <footer class="nx-auth__footer">
        <version-footer />
      </footer>
    </main>
  </div>
</template>

<script>
import Api from '@/apis/api';
import VersionFooter from '@/components/VersionFooter.vue';
import { getUUID, goToPage, showDanger, showSuccess, validateMobile, sm2Encrypt } from '@/utils';
import { mapState } from 'vuex';
import i18n from '@/i18n';

// Import language switch feature
import { changeLanguage } from '@/i18n';

export default {
  name: 'retrieve',
  components: {
    VersionFooter
  },
  computed: {
    ...mapState({
      allowUserRegister: state => state.pubConfig.allowUserRegister,
      mobileAreaList: state => state.pubConfig.mobileAreaList,
      sm2PublicKey: state => state.pubConfig.sm2PublicKey
    }),
    // Get current language
    currentLanguage() {
      return i18n.locale || "en";
    },
    canSendMobileCaptcha() {
      return this.countdown === 0 && validateMobile(this.form.mobile, this.form.areaCode);
    }
  },
  data() {
    return {
      form: {
        areaCode: '+86',
        mobile: '',
        captcha: '',
        captchaId: '',
        mobileCaptcha: '',
        newPassword: '',
        confirmPassword: ''
      },
      captchaUrl: '',
      countdown: 0,
      timer: null
    }
  },
  mounted() {
    this.fetchCaptcha();
  },
  methods: {
    // Translate with an English fallback for strings still pending in src/i18n/_pending
    tt(key, fallback) {
      return this.$te(key) ? this.$t(key) : fallback;
    },
    openPage(url) {
      const lang = this.$i18n ? this.$i18n.locale : 'en';
      if (!lang.startsWith('zh')) {
        url = url.replace('.html', '-en.html');
      }
      window.open(url, '_blank');
    },
    // Captcha fetch method
    fetchCaptcha() {
      this.form.captchaId = getUUID();
      Api.user.getCaptcha(this.form.captchaId, (res) => {
        if (res.status === 200) {
          const blob = new Blob([res.data], { type: res.data.type });
          this.captchaUrl = URL.createObjectURL(blob);

        } else {
          console.error('Failed to load captcha:', res);
          showDanger(this.$t('register.captchaLoadFailed'));
        }
      });
    },

    // Input validation logic
    validateInput(input, message) {
      if (!input.trim()) {
        showDanger(message);
        return false;
      }
      return true;
    },

    // Send mobile verification code
    sendMobileCaptcha() {
      if (!validateMobile(this.form.mobile, this.form.areaCode)) {
        showDanger(this.$t('retrievePassword.inputCorrectMobile'));
        return;
      }

      // Validate graphic captcha
      if (!this.validateInput(this.form.captcha, this.$t('retrievePassword.captchaRequired'))) {
        this.fetchCaptcha();
        return;
      }

      // Clear existing timer
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }

      // Start countdown
      this.countdown = 60;
      this.timer = setInterval(() => {
        if (this.countdown > 0) {
          this.countdown--;
        } else {
          clearInterval(this.timer);
          this.timer = null;
        }
      }, 1000);

      // Call send verification code API
      Api.user.sendSmsVerification({
        phone: this.form.areaCode + this.form.mobile,
        captcha: this.form.captcha,
        captchaId: this.form.captchaId
      }, (res) => {
        showSuccess(this.$t('retrievePassword.captchaSendSuccess'));
      }, (err) => {
        showDanger(err.data.msg || this.$t('register.captchaSendFailed'));
        this.countdown = 0;
        this.fetchCaptcha();
      });
    },

    // Update logic
    retrievePassword() {
      // Validation logic
      if (!validateMobile(this.form.mobile, this.form.areaCode)) {
        showDanger(this.$t('retrievePassword.inputCorrectMobile'));
        return;
      }
      if (!this.form.captcha) {
        showDanger(this.$t('retrievePassword.captchaRequired'));
        return;
      }
      if (!this.form.mobileCaptcha) {
        showDanger(this.$t('retrievePassword.mobileCaptchaRequired'));
        return;
      }
      if (this.form.newPassword !== this.form.confirmPassword) {
        showDanger(this.$t('retrievePassword.passwordsNotMatch'));
        return;
      }

      // Encrypt password
      let encryptedPassword;
      try {
        // Concatenate graphic captcha and new password for encryption
        const captchaAndPassword = this.form.captcha + this.form.newPassword;
        encryptedPassword = sm2Encrypt(this.sm2PublicKey, captchaAndPassword);
      } catch (error) {
        console.error("Password encryption failed:", error);
        showDanger(this.$t('sm2.encryptionFailed'));
        return;
      }

      Api.user.retrievePassword({
        phone: this.form.areaCode + this.form.mobile,
        password: encryptedPassword,
        code: this.form.mobileCaptcha,
        captchaId: this.form.captchaId
      }, (res) => {
        showSuccess(this.$t('retrievePassword.passwordUpdateSuccess'));
        goToPage('/login');
      }, (err) => {
        showDanger(err.data.msg || this.$t('message.error'));
        if (err.data != null && err.data.msg != null && (err.data.msg.indexOf('\u56fe\u5f62\u9a8c\u8bc1\u7801') > -1 || err.data.msg.toLowerCase().indexOf('captcha') > -1)) {
          this.fetchCaptcha()
        }
      });
    },

    goToLogin() {
      goToPage('/login')
    }
  },
  beforeDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }
}
</script>

<style lang="scss" scoped>
@import "./auth.scss";
</style>
