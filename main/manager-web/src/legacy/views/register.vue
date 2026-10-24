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
        <section class="nx-auth-card" aria-labelledby="register-title">
          <h1 id="register-title" class="nx-auth-card__title">{{ $t('register.title') }}</h1>
          <p class="nx-auth-card__subtitle">{{ tt('auth.registerSubtitle', 'Create an account to set up your first robot.') }}</p>

          <form class="nx-auth-form" novalidate @submit.prevent="register">
            <!-- Username -->
            <div v-if="!enableMobileRegister" class="nx-field">
              <label class="nx-field__label" for="register-username">{{ $t('login.username') }}</label>
              <el-input id="register-username" v-model="form.username" :placeholder="$t('register.usernamePlaceholder')"
                autocomplete="username" />
            </div>

            <!-- Mobile registration -->
            <template v-if="enableMobileRegister">
              <div class="nx-field">
                <label class="nx-field__label" for="register-mobile">{{ $t('retrievePassword.mobile') }}</label>
                <div class="nx-field__row">
                  <el-select v-model="form.areaCode" class="nx-auth-area" filterable>
                    <el-option v-for="item in mobileAreaList" :key="item.key" :label="`${item.name} (${item.key})`"
                      :value="item.key" />
                  </el-select>
                  <el-input id="register-mobile" v-model="form.mobile" :placeholder="$t('register.mobilePlaceholder')"
                    autocomplete="tel-national" inputmode="tel" />
                </div>
              </div>

              <div class="nx-field">
                <label class="nx-field__label" for="register-captcha">{{ $t('retrievePassword.captcha') }}</label>
                <div class="nx-field__row">
                  <el-input id="register-captcha" v-model="form.captcha" :placeholder="$t('register.captchaPlaceholder')"
                    autocomplete="off" />
                  <button v-if="captchaUrl" type="button" class="nx-auth-captcha"
                    :aria-label="tt('auth.refreshCaptcha', 'Get a new code')"
                    :title="tt('auth.refreshCaptcha', 'Get a new code')" @click="fetchCaptcha">
                    <img :src="captchaUrl" alt="Captcha" />
                  </button>
                </div>
              </div>

              <div class="nx-field">
                <label class="nx-field__label" for="register-sms">{{ $t('retrievePassword.mobileCaptcha') }}</label>
                <div class="nx-field__row">
                  <el-input id="register-sms" v-model="form.mobileCaptcha"
                    :placeholder="$t('register.mobileCaptchaPlaceholder')" maxlength="6" inputmode="numeric"
                    autocomplete="one-time-code" />
                  <el-button class="nx-auth-send" :disabled="!canSendMobileCaptcha" @click="sendMobileCaptcha">
                    {{ countdown > 0 ? `${countdown}${$t('register.secondsLater')}` : $t('register.sendCaptcha') }}
                  </el-button>
                </div>
              </div>
            </template>

            <!-- Password -->
            <div class="nx-field">
              <label class="nx-field__label" for="register-password">{{ $t('login.password') }}</label>
              <el-input id="register-password" v-model="form.password" :placeholder="$t('register.passwordPlaceholder')"
                type="password" show-password autocomplete="new-password" />
            </div>

            <div class="nx-field">
              <label class="nx-field__label" for="register-confirm">{{ tt('auth.confirmPassword', 'Confirm password') }}</label>
              <el-input id="register-confirm" v-model="form.confirmPassword"
                :placeholder="$t('register.confirmPasswordPlaceholder')" type="password" show-password
                autocomplete="new-password" />
            </div>

            <!-- Image captcha (username registration) -->
            <div v-if="!enableMobileRegister" class="nx-field">
              <label class="nx-field__label" for="register-captcha-u">{{ $t('retrievePassword.captcha') }}</label>
              <div class="nx-field__row">
                <el-input id="register-captcha-u" v-model="form.captcha" :placeholder="$t('register.captchaPlaceholder')"
                  autocomplete="off" />
                <button v-if="captchaUrl" type="button" class="nx-auth-captcha"
                  :aria-label="tt('auth.refreshCaptcha', 'Get a new code')"
                  :title="tt('auth.refreshCaptcha', 'Get a new code')" @click="fetchCaptcha">
                  <img :src="captchaUrl" alt="Captcha" />
                </button>
              </div>
            </div>

            <el-button type="primary" native-type="submit" class="nx-auth-submit">
              {{ $t('register.registerButton') }}
            </el-button>

            <div class="nx-auth-links nx-auth-links--center">
              <button type="button" class="nx-link" @click="goToLogin">{{ $t('register.goToLogin') }}</button>
            </div>
          </form>

          <p class="nx-auth-legal">
            {{ $t('register.agreeTo') }}
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
import { getUUID, goToPage, showDanger, showSuccess, sm2Encrypt, validateMobile } from '@/utils';
import { mapState } from 'vuex';
import i18n from '@/i18n';

// Import language switch feature

export default {
  name: 'register',
  components: {
    VersionFooter
  },
  computed: {
    ...mapState({
      allowUserRegister: state => state.pubConfig.allowUserRegister,
      enableMobileRegister: state => state.pubConfig.enableMobileRegister,
      mobileAreaList: state => state.pubConfig.mobileAreaList,
      sm2PublicKey: state => state.pubConfig.sm2PublicKey,
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
        username: '',
        password: '',
        confirmPassword: '',
        captcha: '',
        captchaId: '',
        areaCode: '+86',
        mobile: '',
        mobileCaptcha: ''
      },
      captchaUrl: '',
      countdown: 0,
      timer: null,
    }
  },
  mounted() {
    this.$store.dispatch('fetchPubConfig').then(() => {
      if (!this.allowUserRegister) {
        showDanger(this.$t('register.notAllowRegister'));
        setTimeout(() => {
          goToPage('/login');
        }, 1500);
      }
    });
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
        showDanger(this.$t('register.inputCorrectMobile'));
        return;
      }

      // Validate graphic captcha
      if (!this.validateInput(this.form.captcha, this.$t('register.inputCaptcha'))) {
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
        showSuccess(this.$t('register.captchaSendSuccess'));
      }, (err) => {
        showDanger(err.data.msg || this.$t('register.captchaSendFailed'));
        this.countdown = 0;
        this.fetchCaptcha();
      });
    },

    // Registration logic
    async register() {
      if (this.enableMobileRegister) {
        // Phone registration validation
        if (!validateMobile(this.form.mobile, this.form.areaCode)) {
          showDanger(this.$t('register.inputCorrectMobile'));
          return;
        }
        if (!this.form.mobileCaptcha) {
          showDanger(this.$t('register.requiredMobileCaptcha'));
          return;
        }
      } else {
        // Username registration validation
        if (!this.validateInput(this.form.username, this.$t('register.requiredUsername'))) {
          return;
        }
      }

      // Validate password
      if (!this.validateInput(this.form.password, this.$t('register.requiredPassword'))) {
        return;
      }
      if (this.form.password !== this.form.confirmPassword) {
        showDanger(this.$t('register.passwordsNotMatch'))
        return
      }
      // Validate captcha
      if (!this.validateInput(this.form.captcha, this.$t('register.requiredCaptcha'))) {
        return;
      }
      // Encrypt
      let encryptedPassword;
      try {
        // Concatenate captcha and password
        const captchaAndPassword = this.form.captcha + this.form.password;
        encryptedPassword = sm2Encrypt(this.sm2PublicKey, captchaAndPassword);
      } catch (error) {
        console.error("Password encryption failed:", error);
        showDanger(this.$t('sm2.encryptionFailed'));
        return;
      }

      let plainUsername;
      if (this.enableMobileRegister) {
        plainUsername = this.form.areaCode + this.form.mobile;
      } else {
        plainUsername = this.form.username;
      }

      // Prepare registration data
      const registerData = {
        username: plainUsername,
        password: encryptedPassword,
        captchaId: this.form.captchaId,
        mobileCaptcha: this.form.mobileCaptcha
      };

      Api.user.register(registerData, ({ data }) => {
        showSuccess(this.$t('register.registerSuccess'))
        goToPage('/login')
      }, (err) => {
        showDanger(err.data.msg || this.$t('register.registerFailed'))
        if (err.data != null && err.data.msg != null && (err.data.msg.indexOf('\u56fe\u5f62\u9a8c\u8bc1\u7801') > -1 || err.data.msg.toLowerCase().indexOf('captcha') > -1)) {
          this.fetchCaptcha()
        }
      })
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
