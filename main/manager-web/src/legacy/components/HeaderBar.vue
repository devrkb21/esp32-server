<template>
  <header class="nx-topbar">
    <div class="nx-topbar__inner">
      <!-- Brand -->
      <button type="button" class="nx-brand" @click="handleRouter('home')" aria-label="Nobix Console">
        <img src="@/assets/nobix/mark.svg" alt="" class="nx-brand__mark" width="30" height="30" />
        <span class="nx-brand__name">Nobix <span class="nx-brand__product">Console</span></span>
      </button>

      <!-- Primary navigation (wide screens) -->
      <nav class="nx-nav" :aria-label="$t('header.smartManagement')">
        <button v-for="item in primaryNav" :key="item.key" type="button" class="nx-nav__item"
          :class="{ 'is-active': isActive(item.paths) }" :aria-current="isActive(item.paths) ? 'page' : null"
          @click="handleRouter(item.route)">
          <i :class="item.icon" aria-hidden="true"></i>
          <span>{{ $t(item.label) }}</span>
        </button>

        <el-dropdown v-for="group in navGroups" :key="group.key" trigger="click" placement="bottom-start"
          @command="handleRouter">
          <button type="button" class="nx-nav__item" :class="{ 'is-active': isActive(groupPaths(group)) }">
            <i :class="group.icon" aria-hidden="true"></i>
            <span>{{ $t(group.label) }}</span>
            <i class="el-icon-arrow-down nx-nav__caret" aria-hidden="true"></i>
          </button>
          <el-dropdown-menu slot="dropdown" class="nx-menu">
            <el-dropdown-item v-for="child in group.children" :key="child.route" :command="child.route"
              :class="{ 'is-current': isActive([routerPaths[child.route]]) }">
              {{ $t(child.label) }}
            </el-dropdown-item>
          </el-dropdown-menu>
        </el-dropdown>
      </nav>

      <div class="nx-topbar__right">
        <el-tooltip :content="isDarkMode ? $t('header.lightTheme') : $t('header.darkTheme')" placement="bottom">
          <button type="button" class="nx-icon-btn" :aria-label="isDarkMode ? $t('header.lightTheme') : $t('header.darkTheme')"
            @click="handleToggleTheme">
            <i :class="isDarkMode ? 'el-icon-sunny' : 'el-icon-moon'" aria-hidden="true"></i>
          </button>
        </el-tooltip>

        <el-dropdown trigger="click" placement="bottom-end" @command="handleUserCommand"
          @visible-change="handleUserMenuVisibleChange">
          <button type="button" class="nx-user" :aria-label="userInfo.username || 'Account'">
            <span class="nx-avatar nx-user__avatar">{{ userInitial }}</span>
            <span class="nx-user__name nx-truncate">{{ userInfo.username || '…' }}</span>
            <i class="el-icon-arrow-down nx-nav__caret" :class="{ 'is-open': userMenuVisible }" aria-hidden="true"></i>
          </button>
          <el-dropdown-menu slot="dropdown" class="nx-menu nx-user-menu">
            <div class="nx-user-menu__head">
              <span class="nx-avatar">{{ userInitial }}</span>
              <div class="nx-user-menu__who">
                <div class="nx-truncate nx-user-menu__username">{{ userInfo.username }}</div>
                <div class="nx-caption">{{ currentLanguageText }}</div>
              </div>
            </div>
            <el-dropdown-item v-for="lang in languages" :key="lang.value" :command="'lang:' + lang.value"
              :class="{ 'is-current': currentLanguage === lang.value }">
              <i class="el-icon-check nx-user-menu__check" :class="{ 'is-visible': currentLanguage === lang.value }"
                aria-hidden="true"></i>{{ lang.label }}
            </el-dropdown-item>
            <el-dropdown-item divided command="changePassword">
              <i class="el-icon-lock" aria-hidden="true"></i>{{ $t('header.changePassword') }}
            </el-dropdown-item>
            <el-dropdown-item command="logout" class="nx-user-menu__logout">
              <i class="el-icon-switch-button" aria-hidden="true"></i>{{ $t('header.logout') }}
            </el-dropdown-item>
          </el-dropdown-menu>
        </el-dropdown>

        <!-- Narrow screens: navigation in a drawer -->
        <button type="button" class="nx-icon-btn nx-topbar__menu-btn" aria-label="Menu" @click="drawerOpen = true">
          <i class="el-icon-menu" aria-hidden="true"></i>
        </button>
      </div>
    </div>

    <el-drawer :visible.sync="drawerOpen" direction="rtl" size="300px" :with-header="false" append-to-body
      custom-class="nx-nav-drawer">
      <div class="nx-nav-drawer__head">
        <img src="@/assets/nobix/mark.svg" alt="" width="28" height="28" />
        <span class="nx-brand__name">Nobix <span class="nx-brand__product">Console</span></span>
      </div>
      <nav class="nx-nav-drawer__list">
        <button v-for="item in primaryNav" :key="item.key" type="button" class="nx-nav-drawer__item"
          :class="{ 'is-active': isActive(item.paths) }" @click="navigate(item.route)">
          <i :class="item.icon" aria-hidden="true"></i>{{ $t(item.label) }}
        </button>
        <template v-for="group in navGroups">
          <div :key="group.key + '-title'" class="nx-nav-drawer__group nx-caption">{{ $t(group.label) }}</div>
          <button v-for="child in group.children" :key="child.route" type="button" class="nx-nav-drawer__item"
            :class="{ 'is-active': isActive([routerPaths[child.route]]) }" @click="navigate(child.route)">
            {{ $t(child.label) }}
          </button>
        </template>
      </nav>
    </el-drawer>

    <!-- Change Password Dialog -->
    <ChangePasswordDialog v-model="isChangePasswordDialogVisible" />
  </header>
</template>

<script>
import i18n, { changeLanguage } from "@/i18n";
import featureManager from "@/utils/featureManager"; // Feature manager utility
import { isDark, toggleTheme } from "@/utils/theme";
import { mapActions, mapState } from "vuex";
import ChangePasswordDialog from "./ChangePasswordDialog.vue"; // Change password dialog component

export default {
  name: "HeaderBar",
  components: {
    ChangePasswordDialog,
  },
  props: ["devices"], // Receive device list from parent
  data() {
    return {
      isDarkMode: isDark(),
      themeListener: null,
      isChangePasswordDialogVisible: false, // Control change password dialog visibility
      userMenuVisible: false, // User menu visibility state
      drawerOpen: false,
      // Navigation page configuration
      routerPaths: {
        home: "/home",
        modelConfig: "/model-config",
        knowledgeBaseManagement: "/knowledge-base-management",
        addressBookManagement: "/address-book-management",
        voiceCloneManagement: "/voice-clone-management",
        voiceResourceManagement: "/voice-resource-management",
        paramManagement: "/params-management",
        userManagement: "/user-management",
        otaManagement: "/ota-management",
        dictManagement: "/dict-management",
        providerManagement: "/provider-management",
        agentTemplate: "/agent-template-management",
        replacementWordManagement: "/replacement-word-management",
        serverSideManagement: "/server-side-management",
        featureManagement: "/feature-management",
      },
    };
  },
  computed: {
    ...mapState({
      featureStatus: (state) => ({
        voiceClone: state.pubConfig.systemWebMenu?.features?.voiceClone?.enabled, // Voice clone feature status
        knowledgeBase: state.pubConfig.systemWebMenu?.features?.knowledgeBase?.enabled, // Knowledge base feature status
        addressBook: state.pubConfig.systemWebMenu?.features?.addressBook?.enabled, // Address book feature status
      }),
      userInfo: (state) => state.userInfo,
    }),
    // Top-level destinations, filtered by role and enabled features
    primaryNav() {
      const items = [
        {
          key: "agents",
          route: "home",
          label: "header.smartManagement",
          icon: "el-icon-cpu",
          paths: ["/home", "/role-config", "/device-management", "/companion-management"],
        },
      ];
      if (this.featureStatus.voiceClone && !this.userInfo.superAdmin) {
        items.push({
          key: "voiceClone",
          route: "voiceCloneManagement",
          label: "header.voiceCloneManagement",
          icon: "el-icon-microphone",
          paths: ["/voice-clone-management"],
        });
      }
      if (this.userInfo.superAdmin) {
        items.push({
          key: "models",
          route: "modelConfig",
          label: "header.modelConfig",
          icon: "el-icon-magic-stick",
          paths: ["/model-config"],
        });
      }
      if (this.featureStatus.knowledgeBase) {
        items.push({
          key: "knowledge",
          route: "knowledgeBaseManagement",
          label: "header.knowledgeBase",
          icon: "el-icon-notebook-2",
          paths: ["/knowledge-base-management", "/knowledge-file-upload"],
        });
      }
      if (this.featureStatus.addressBook) {
        items.push({
          key: "addressBook",
          route: "addressBookManagement",
          label: "header.addressBook",
          icon: "el-icon-notebook-1",
          paths: ["/address-book-management"],
        });
      }
      return items;
    },
    // Destinations grouped in a dropdown (admin only)
    navGroups() {
      const groups = [];
      if (this.userInfo.superAdmin && this.featureStatus.voiceClone) {
        groups.push({
          key: "voice",
          label: "header.voiceCloneManagement",
          icon: "el-icon-microphone",
          children: [
            { route: "voiceCloneManagement", label: "header.voiceCloneManagement" },
            { route: "voiceResourceManagement", label: "header.voiceResourceManagement" },
          ],
        });
      }
      if (this.userInfo.superAdmin) {
        groups.push({
          key: "system",
          label: "header.paramDictionary",
          icon: "el-icon-setting",
          children: [
            { route: "paramManagement", label: "header.paramManagement" },
            { route: "userManagement", label: "header.userManagement" },
            { route: "otaManagement", label: "header.otaManagement" },
            { route: "dictManagement", label: "header.dictManagement" },
            { route: "providerManagement", label: "header.providerManagement" },
            { route: "agentTemplate", label: "header.agentTemplate" },
            { route: "replacementWordManagement", label: "header.replacementWordManagement" },
            { route: "serverSideManagement", label: "header.serverSideManagement" },
            { route: "featureManagement", label: "header.featureManagement" },
          ],
        });
      }
      return groups;
    },
    userInitial() {
      const name = (this.userInfo && this.userInfo.username) || "";
      return name ? Array.from(name.trim())[0] || "?" : "?";
    },
    // Get current language
    currentLanguage() {
      return i18n.locale || "en";
    },
    languages() {
      return [
        { value: "en", label: this.$t("language.en") },
        { value: "zh_CN", label: this.$t("language.zhCN") },
        { value: "zh_TW", label: this.$t("language.zhTW") },
        { value: "de", label: this.$t("language.de") },
        { value: "vi", label: this.$t("language.vi") },
        { value: "pt_BR", label: this.$t("language.ptBR") },
      ];
    },
    // Get display text for current language
    currentLanguageText() {
      const found = this.languages.find((l) => l.value === this.currentLanguage);
      return found ? found.label : this.$t("language.en");
    },
  },
  async mounted() {
    // Wait for featureManager initialization before loading feature status
    await this.loadFeatureStatus();
    this.themeListener = (e) => {
      this.isDarkMode = e.detail?.theme === "dark";
    };
    window.addEventListener("app-theme-changed", this.themeListener);
  },
  beforeDestroy() {
    if (this.themeListener) {
      window.removeEventListener("app-theme-changed", this.themeListener);
    }
  },
  methods: {
    isActive(paths) {
      return paths.includes(this.$route.path);
    },
    groupPaths(group) {
      return group.children.map((c) => this.routerPaths[c.route]);
    },
    handleToggleTheme() {
      const next = toggleTheme();
      this.isDarkMode = next === "dark";
    },
    handleRouter(type) {
      const path = this.routerPaths[type];
      if (path && this.$route.path !== path) {
        this.$router.push(path);
      }
    },
    navigate(type) {
      this.drawerOpen = false;
      this.handleRouter(type);
    },
    // Load feature status
    async loadFeatureStatus() {
      // Wait for featureManager initialization
      await featureManager.waitForInitialization();
    },
    // Show change password dialog
    showChangePasswordDialog() {
      this.isChangePasswordDialogVisible = true;
      this.userMenuVisible = false;
    },
    handleUserCommand(command) {
      if (command.startsWith("lang:")) {
        this.changeLanguage(command.slice(5));
      } else if (command === "changePassword") {
        this.showChangePasswordDialog();
      } else if (command === "logout") {
        this.handleLogout();
      }
    },
    // Logout
    async handleLogout() {
      try {
        // Call Vuex logout action
        await this.logout();
        this.$message.success({
          message: this.$t("message.success"),
          showClose: true,
        });
      } catch (error) {
        console.error("Logout failed:", error);
        this.$message.error({
          message: this.$t("message.error"),
          showClose: true,
        });
      }
    },
    // Switch language
    changeLanguage(lang) {
      if (lang === this.currentLanguage) return;
      changeLanguage(lang);
      this.userMenuVisible = false;
    },
    handleUserMenuVisibleChange(visible) {
      this.userMenuVisible = visible;
    },
    // Import Vuex logout action using mapActions
    ...mapActions(["logout"]),
  },
};
</script>

<style lang="scss" scoped>
.nx-topbar {
  position: sticky;
  top: 0;
  z-index: 100;
  height: var(--nx-topbar-h);
  background: var(--nx-glass);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  backdrop-filter: saturate(180%) blur(20px);
  border-bottom: 1px solid var(--nx-border);

  &__inner {
    display: flex;
    align-items: center;
    gap: var(--nx-space-5);
    height: 100%;
    max-width: calc(1440px + 2 * var(--nx-gutter));
    margin: 0 auto;
    padding: 0 var(--nx-gutter);
  }
  &__right {
    display: flex;
    align-items: center;
    gap: var(--nx-space-2);
    margin-left: auto;
  }
  &__menu-btn {
    display: none;
  }
}

.nx-brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 4px 6px 4px 2px;
  border: 0;
  border-radius: var(--nx-radius);
  background: transparent;
  cursor: pointer;
  flex: none;
  &:active {
    transform: scale(0.98);
  }
  &__mark {
    display: block;
    width: 30px;
    height: 30px;
  }
  &__name {
    font-family: var(--nx-font);
    font-size: 17px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--nx-text);
    white-space: nowrap;
  }
  &__product {
    font-weight: 500;
    color: var(--nx-text-2);
  }
}

.nx-nav {
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
  overflow: hidden;

  &__item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 34px;
    padding: 0 12px;
    border: 0;
    border-radius: var(--nx-radius-pill);
    background: transparent;
    color: var(--nx-text-2);
    font-family: var(--nx-font);
    font-size: var(--nx-text-callout);
    font-weight: 500;
    white-space: nowrap;
    cursor: pointer;
    transition: background-color var(--nx-dur-1) var(--nx-ease), color var(--nx-dur-1) var(--nx-ease);

    i {
      font-size: 15px;
    }
    &:hover {
      background: var(--nx-surface-2);
      color: var(--nx-text);
    }
    &:active {
      transform: scale(0.97);
    }
    &.is-active {
      background: var(--nx-accent-soft);
      color: var(--nx-accent);
      font-weight: 600;
    }
  }
  &__caret {
    font-size: 11px !important;
    margin-left: 2px;
    transition: transform var(--nx-dur-2) var(--nx-ease);
    &.is-open {
      transform: rotate(180deg);
    }
  }
}

.nx-user {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 200px;
  height: 40px;
  padding: 0 10px 0 3px;
  border: 0;
  border-radius: var(--nx-radius-pill);
  background: transparent;
  color: var(--nx-text);
  font-family: var(--nx-font);
  font-size: var(--nx-text-callout);
  font-weight: 500;
  cursor: pointer;
  &:hover {
    background: var(--nx-surface-2);
  }
  &__avatar {
    width: 32px;
    height: 32px;
    font-size: 13px;
  }
}

@media (max-width: 1080px) {
  .nx-nav__item span {
    display: none;
  }
  .nx-nav__item {
    padding: 0 10px;
  }
}
@media (max-width: 760px) {
  .nx-nav {
    display: none;
  }
  .nx-topbar__menu-btn {
    display: inline-flex;
  }
  .nx-user__name,
  .nx-user .nx-nav__caret {
    display: none;
  }
  .nx-brand__product {
    display: none;
  }
}
</style>

<style lang="scss">
// Dropdown menus are appended to <body>, so these are not scoped
.nx-menu {
  min-width: 200px;
  .el-dropdown-menu__item {
    display: flex;
    align-items: center;
    gap: 8px;
    &.is-current {
      color: var(--nx-accent);
      font-weight: 600;
    }
    i {
      margin-right: 0;
      color: var(--nx-text-3);
    }
  }
}
.nx-user-menu {
  min-width: 240px;
  &__head {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px 12px;
    margin-bottom: 6px;
    border-bottom: 1px solid var(--nx-border);
  }
  &__who {
    min-width: 0;
  }
  &__username {
    font-weight: 600;
    color: var(--nx-text);
  }
  &__check {
    visibility: hidden;
    color: var(--nx-accent) !important;
    &.is-visible {
      visibility: visible;
    }
  }
  &__logout,
  &__logout i {
    color: var(--nx-danger) !important;
  }
}

.nx-nav-drawer {
  padding: 20px 14px;
  background: var(--nx-surface) !important;
  &__head {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 8px 18px;
    font-size: 17px;
  }
  &__list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  &__group {
    padding: 16px 12px 6px;
  }
  &__item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-height: 44px;
    padding: 0 12px;
    border: 0;
    border-radius: var(--nx-radius);
    background: transparent;
    color: var(--nx-text);
    font-family: var(--nx-font);
    font-size: var(--nx-text-body);
    text-align: left;
    cursor: pointer;
    i {
      color: var(--nx-text-2);
      font-size: 17px;
    }
    &:hover {
      background: var(--nx-surface-2);
    }
    &.is-active {
      background: var(--nx-accent-soft);
      color: var(--nx-accent);
      font-weight: 600;
      i {
        color: var(--nx-accent);
      }
    }
  }
}
</style>
