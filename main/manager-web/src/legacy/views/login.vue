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

        <!-- Language switch -->
        <el-dropdown trigger="click" placement="bottom-end" @visible-change="handleLanguageDropdownVisibleChange">
          <button type="button" class="nx-auth-lang" :aria-label="tt('auth.language', 'Language')">
            <i class="el-icon-s-comment" aria-hidden="true"></i>
            <span>{{ currentLanguageText }}</span>
            <i class="el-icon-arrow-down nx-auth-lang__caret" :class="{ 'is-open': languageDropdownVisible }"
              aria-hidden="true"></i>
          </button>
          <el-dropdown-menu slot="dropdown">
            <el-dropdown-item @click.native="changeLanguage('zh_CN')">{{ $t("language.zhCN") }}</el-dropdown-item>
            <el-dropdown-item @click.native="changeLanguage('zh_TW')">{{ $t("language.zhTW") }}</el-dropdown-item>
            <el-dropdown-item @click.native="changeLanguage('en')">{{ $t("language.en") }}</el-dropdown-item>
            <el-dropdown-item @click.native="changeLanguage('de')">{{ $t("language.de") }}</el-dropdown-item>
            <el-dropdown-item @click.native="changeLanguage('vi')">{{ $t("language.vi") }}</el-dropdown-item>
            <el-dropdown-item @click.native="changeLanguage('pt_BR')">{{ $t("language.ptBR") }}</el-dropdown-item>
          </el-dropdown-menu>
        </el-dropdown>
      </div>

      <div class="nx-auth__center">
        <section class="nx-auth-card" aria-labelledby="login-title">
          <h1 id="login-title" class="nx-auth-card__title">{{ $t("login.title") }}</h1>
          <p class="nx-auth-card__subtitle">{{ tt('auth.loginSubtitle', 'Welcome back. Sign in to continue.') }}</p>

          <!-- Login method (only when mobile sign-in is enabled) -->
          <div v-if="enableMobileRegister" class="nx-segmented nx-auth-segmented" role="tablist"
            :aria-label="tt('auth.loginMethod', 'Sign-in method')">
            <button type="button" role="tab" :aria-selected="String(isMobileLogin)"
              :class="{ 'is-active': isMobileLogin }" @click="switchLoginType('mobile')">
              <i class="el-icon-mobile" aria-hidden="true"></i>
              <span class="nx-truncate">{{ $t("login.mobileLogin") }}</span>
            </button>
            <button type="button" role="tab" :aria-selected="String(!isMobileLogin)"
              :class="{ 'is-active': !isMobileLogin }" @click="switchLoginType('username')">
              <i class="el-icon-user" aria-hidden="true"></i>
              <span class="nx-truncate">{{ $t("login.usernameLogin") }}</span>
            </button>
          </div>

          <form class="nx-auth-form" novalidate @submit.prevent="login">
            <!-- Username -->
            <div v-if="!isMobileLogin" class="nx-field">
              <label class="nx-field__label" for="login-username">{{ $t("login.username") }}</label>
              <el-input id="login-username" v-model="form.username" :placeholder="$t('login.usernamePlaceholder')"
                autocomplete="username" />
            </div>

            <!-- Mobile -->
            <div v-else class="nx-field">
              <label class="nx-field__label" for="login-mobile">{{ $t("retrievePassword.mobile") }}</label>
              <div class="nx-field__row">
                <el-select v-model="form.areaCode" class="nx-auth-area" filterable>
                  <el-option v-for="item in mobileAreaList" :key="item.key" :label="`${item.name} (${item.key})`"
                    :value="item.key" />
                </el-select>
                <el-input id="login-mobile" v-model="form.mobile" :placeholder="$t('login.mobilePlaceholder')"
                  autocomplete="tel-national" inputmode="tel" />
              </div>
            </div>

            <!-- Password -->
            <div class="nx-field">
              <label class="nx-field__label" for="login-password">{{ $t("login.password") }}</label>
              <el-input id="login-password" v-model="form.password" :placeholder="$t('login.passwordPlaceholder')"
                type="password" show-password autocomplete="current-password" />
            </div>

            <!-- Image captcha -->
            <div class="nx-field">
              <label class="nx-field__label" for="login-captcha">{{ $t("retrievePassword.captcha") }}</label>
              <div class="nx-field__row">
                <el-input id="login-captcha" v-model="form.captcha" :placeholder="$t('login.captchaPlaceholder')"
                  autocomplete="off" />
                <button v-if="captchaUrl" type="button" class="nx-auth-captcha"
                  :aria-label="tt('auth.refreshCaptcha', 'Get a new code')"
                  :title="tt('auth.refreshCaptcha', 'Get a new code')" @click="fetchCaptcha">
                  <img :src="captchaUrl" alt="Captcha" />
                </button>
              </div>
            </div>

            <div v-if="allowUserRegister || enableMobileRegister" class="nx-auth-links">
              <button v-if="allowUserRegister" type="button" class="nx-link" @click="goToRegister">
                {{ $t("login.register") }}
              </button>
              <button v-if="enableMobileRegister" type="button" class="nx-link nx-link--end"
                @click="goToForgetPassword">
                {{ $t("login.forgetPassword") }}
              </button>
            </div>

            <el-button type="primary" native-type="submit" class="nx-auth-submit">{{ $t("login.login") }}</el-button>
          </form>

          <p class="nx-auth-legal">
            {{ $t("login.agreeTo") }}
            <button type="button" class="nx-link" @click="openPage('/user-agreement.html')">{{ $t("login.userAgreement") }}</button>
            {{ $t("login.and") }}
            <button type="button" class="nx-link" @click="openPage('/privacy-policy.html')">{{ $t("login.privacyPolicy") }}</button>
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
import Api from "@/apis/api";
import VersionFooter from "@/components/VersionFooter.vue";
import i18n, { changeLanguage } from "@/i18n";
import { getUUID, goToPage, showDanger, showSuccess, sm2Encrypt, validateMobile } from "@/utils";
import { mapState } from "vuex";
import featureManager from "@/utils/featureManager";

export default {
  name: "login",
  components: {
    VersionFooter,
  },
  computed: {
    ...mapState({
      allowUserRegister: (state) => state.pubConfig.allowUserRegister,
      enableMobileRegister: (state) => state.pubConfig.enableMobileRegister,
      mobileAreaList: (state) => state.pubConfig.mobileAreaList,
      sm2PublicKey: (state) => state.pubConfig.sm2PublicKey,
    }),
    // Get current language
    currentLanguage() {
      return i18n.locale || "en";
    },
    // Get display text for current language
    currentLanguageText() {
      const currentLang = this.currentLanguage;
      switch (currentLang) {
        case "zh_CN":
          return this.$t("language.zhCN");
        case "zh_TW":
          return this.$t("language.zhTW");
        case "en":
          return this.$t("language.en");
        case "de":
          return this.$t("language.de");
        case "vi":
          return this.$t("language.vi");
        case "pt_BR":
          return this.$t("language.ptBR");
        default:
          return this.$t("language.en");
      }
    },
  },
  data() {
    return {
      activeName: "username",
      form: {
        username: "",
        password: "",
        captcha: "",
        captchaId: "",
        areaCode: "+86",
        mobile: "",
      },
      captchaUuid: "",
      captchaUrl: "",
      isMobileLogin: false,
      languageDropdownVisible: false,
    };
  },
  mounted() {
    this.fetchCaptcha();
    this.$store.dispatch("fetchPubConfig").then(() => {
      // Determine default login method based on configuration
      this.isMobileLogin = this.enableMobileRegister;
    });
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
    fetchCaptcha() {
      // Handle issue where clearing localStorage prevents fetching captcha
      const token = localStorage.getItem('token')
      if (token) {
        if (this.$route.path !== "/home") {
          this.$router.push("/home");
        }
      } else {
        this.captchaUuid = getUUID();

        Api.user.getCaptcha(this.captchaUuid, (res) => {
          if (res.status === 200) {
            const blob = new Blob([res.data], { type: res.data.type });
            this.captchaUrl = URL.createObjectURL(blob);
          } else {
            showDanger("Failed to load captcha, click to refresh");
          }
        });
      }
    },

    // Toggle language dropdown visibility
    handleLanguageDropdownVisibleChange(visible) {
      this.languageDropdownVisible = visible;
    },

    // Switch language
    changeLanguage(lang) {
      changeLanguage(lang);
      this.languageDropdownVisible = false;
      this.$message.success({
        message: this.$t("message.success"),
        showClose: true,
      });
    },

    // Switch login method
    switchLoginType(type) {
      this.isMobileLogin = type === "mobile";
      // Clear form
      this.form.username = "";
      this.form.mobile = "";
      this.form.password = "";
      this.form.captcha = "";
      this.fetchCaptcha();
    },

    // Input validation logic
    validateInput(input, messageKey) {
      if (!input.trim()) {
        showDanger(this.$t(messageKey));
        return false;
      }
      return true;
    },
    
    getUserInfo() {
      Api.user.getUserInfo(({ data }) => {
        if (data.code === 0) {
          this.$store.commit("setUserInfo", data.data);
          goToPage("/home");
        } else {
          showDanger("Failed to get user info");
        }
      });
    },

    async login() {
      if (this.isMobileLogin) {
        // Phone login validation
        if (!validateMobile(this.form.mobile, this.form.areaCode)) {
          showDanger(this.$t('login.requiredMobile'));
          return;
        }
        // Concatenate phone number as username
        this.form.username = this.form.areaCode + this.form.mobile;
      } else {
        // Username login validation
        if (!this.validateInput(this.form.username, 'login.requiredUsername')) {
          return;
        }
      }

      // Validate password
      if (!this.validateInput(this.form.password, 'login.requiredPassword')) {
        return;
      }
      // Validate captcha
      if (!this.validateInput(this.form.captcha, 'login.requiredCaptcha')) {
        return;
      }
      // Encrypt password
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

      const plainUsername = this.form.username;

      this.form.captchaId = this.captchaUuid;

      // Encrypt
      const loginData = {
        username: plainUsername,
        password: encryptedPassword,
        captchaId: this.form.captchaId
      };

      Api.user.login(
        loginData,
        ({ data }) => {
          showSuccess(this.$t('login.loginSuccess'));
          this.$store.commit("setToken", JSON.stringify(data.data));
          this.getUserInfo();
        },
        (err) => {
          // Use internationalized message from backend directly
          let errorMessage = err.data.msg || "Login failed";

          showDanger(errorMessage);
        }
      );

      // Refresh captcha
      setTimeout(() => {
        this.fetchCaptcha();
      }, 1000);
    },

    goToRegister() {
      goToPage("/register");
    },
    goToForgetPassword() {
      goToPage("/retrieve-password");
    }
  },
};
</script>

<style lang="scss" scoped>
@import "./auth.scss";
</style>
