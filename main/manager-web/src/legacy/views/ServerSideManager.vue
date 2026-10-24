<template>
  <div class="nx-admin">
    <HeaderBar />
    <main class="nx-page nx-page--narrow">
      <header class="nx-page-header">
        <div class="nx-page-header__text">
          <h1 class="nx-title">{{ $t('serverSideManager.pageTitle') }}</h1>
          <p class="nx-page-header__desc">{{ tt('serverSideManager.pageDesc', 'Voice servers your robots connect to. Restart one or push the latest config to it.') }}</p>
        </div>
        <div class="nx-page-header__actions">
          <CustomButton icon="el-icon-refresh" :loading="loading" @click="fetchParams">
            {{ tt('serverSideManager.refresh', 'Refresh') }}
          </CustomButton>
        </div>
      </header>

      <section class="nx-card nx-card--flush settings-card">
        <div class="settings-card__head">
          <h2 class="nx-headline">{{ tt('serverSideManager.listTitle', 'WebSocket servers') }}</h2>
          <span v-if="!loading" class="nx-badge nx-num">{{ paramsList.length }}</span>
        </div>

        <!-- Loading -->
        <div v-if="loading && !paramsList.length" aria-busy="true">
          <div v-for="n in 2" :key="n" class="setting-row">
            <span class="nx-skeleton skeleton-tile"></span>
            <div class="setting-row__text">
              <span class="nx-skeleton skeleton-line skeleton-line--short"></span>
              <span class="nx-skeleton skeleton-line"></span>
            </div>
          </div>
        </div>

        <!-- Empty -->
        <div v-else-if="!paramsList.length" class="nx-empty">
          <span class="nx-icon-tile nx-icon-tile--lg" aria-hidden="true"><i class="el-icon-monitor"></i></span>
          <p class="nx-empty__title">{{ tt('serverSideManager.emptyTitle', 'No servers connected') }}</p>
          <p class="nx-empty__text">{{ tt('serverSideManager.emptyText', 'Servers appear here once they register with the console.') }}</p>
          <CustomButton class="nx-empty__action" icon="el-icon-refresh" @click="fetchParams">
            {{ tt('serverSideManager.refresh', 'Refresh') }}
          </CustomButton>
        </div>

        <!-- Server rows -->
        <ul v-else class="setting-list" v-loading="loading">
          <li v-for="(item, index) in paramsList" :key="index" class="setting-row">
            <span class="nx-icon-tile nx-icon-tile--neutral" aria-hidden="true"><i class="el-icon-monitor"></i></span>
            <div class="setting-row__text">
              <span class="setting-row__label">{{ $t('serverSideManager.wsAddress') }}</span>
              <span class="setting-row__value nx-mono nx-break">{{ item.address }}</span>
            </div>
            <div class="setting-row__actions">
              <el-tooltip :content="$t('common.copyAddress')" placement="top">
                <button type="button" class="nx-icon-btn" :aria-label="$t('common.copyAddress')" @click="copyAddress(item.address)">
                  <i class="el-icon-document-copy" aria-hidden="true"></i>
                </button>
              </el-tooltip>
              <CustomButton size="small" icon="el-icon-setting" @click="emitAction(item, actionMap.update_config)">
                {{ $t('serverSideManager.updateConfig') }}
              </CustomButton>
              <CustomButton size="small" icon="el-icon-refresh-right" @click="emitAction(item, actionMap.restart)">
                {{ $t('serverSideManager.restart') }}
              </CustomButton>
            </div>
          </li>
        </ul>
      </section>
    </main>
    <VersionFooter />
  </div>
</template>

<script>
import Api from "@/apis/api";
import CustomButton from "@/components/CustomButton.vue";
import HeaderBar from "@/components/HeaderBar.vue";
import VersionFooter from "@/components/VersionFooter.vue";

export default {
  components: { HeaderBar, VersionFooter, CustomButton },
  data() {
    return {
      paramsList: [],
      loading: false,
    };
  },
  created() {
    this.fetchParams();
  },
  computed: {
    actionMap() {
      return {
        restart: {
          value: 'restart',
          title: this.$t('serverSideManager.restartServer'),
          message: this.$t('serverSideManager.confirmRestart'),
          confirmText: this.$t('serverSideManager.restart'),
        },
        update_config: {
          value: 'update_config',
          title: this.$t('serverSideManager.updateConfigTitle'),
          message: this.$t('serverSideManager.confirmUpdateConfig'),
          confirmText: this.$t('serverSideManager.updateConfig'),
        }
      };
    }
  },
  methods: {
    // $t with an English fallback for keys that are still pending in src/i18n/_pending/web-system.js
    tt(key, fallback) {
      return this.$te(key) || this.$te(key, 'en') ? this.$t(key) : fallback;
    },
    fetchParams() {
      this.loading = true;
      Api.admin.getWsServerList(
        {},
        ({ data }) => {
          this.loading = false;
          if (data.code === 0) {
            this.paramsList = (data.data || []).map(item => ({ address: item }));
          } else {
            this.$message.error({
              message: data.msg || this.$t('serverSideManager.getServerListFailed'),
              showClose: true
            });
          }
        }
      );
    },
    emitAction(rowItem, actionItem) {
      if (actionItem === undefined || rowItem.address === undefined) {
        return;
      }
      this.$confirm(actionItem.message, actionItem.title, {
        confirmButtonText: actionItem.confirmText,
        cancelButtonText: this.$t('common.cancel'),
        type: actionItem.value === 'restart' ? 'warning' : undefined
      }).then(() => {
        Api.admin.sendWsServerAction({
          targetWs: rowItem.address,
          action: actionItem.value
        }, ({ data }) => {
          if (data.code !== 0) {
            this.$message.error({
              message: data.msg || this.$t('serverSideManager.operationFailed'),
              showClose: true
            });
            return;
          }
          this.$message.success({
            message: actionItem.value === 'restart' ? this.$t('serverSideManager.restartSuccess') : this.$t('serverSideManager.updateConfigSuccess'),
            showClose: true
          })
        })
      }).catch(() => {
        // Cancelled: nothing to do
      })
    },
    copyAddress(address) {
      if (!navigator.clipboard || !navigator.clipboard.writeText) {
        this.$message.error(this.$t('common.copyFailed'));
        return;
      }
      navigator.clipboard.writeText(address).then(() => {
        this.$message.success(this.$t('common.copySuccess'));
      }).catch(() => {
        this.$message.error(this.$t('common.copyFailed'));
      });
    }
  }
};
</script>

<style lang="scss" scoped>
.nx-admin {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  > .nx-page {
    flex: 1 0 auto;
  }
}

// Settings card: title + description left, controls right (like system settings)
.settings-card {
  &__head {
    display: flex;
    align-items: center;
    gap: var(--nx-space-2);
    padding: var(--nx-space-4) var(--nx-space-5);
    border-bottom: 1px solid var(--nx-border);
  }
}
.setting-list {
  margin: 0;
  padding: 0;
  list-style: none;
}
.setting-row {
  display: flex;
  align-items: center;
  gap: var(--nx-space-4);
  min-height: 72px;
  padding: var(--nx-space-4) var(--nx-space-5);
  & + & {
    border-top: 1px solid var(--nx-border);
  }
  &__text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }
  &__label {
    font-size: var(--nx-text-footnote);
    color: var(--nx-text-2);
  }
  &__value {
    color: var(--nx-text);
  }
  &__actions {
    display: flex;
    align-items: center;
    gap: var(--nx-space-2);
    flex: none;
    .el-button + .el-button {
      margin-left: 0;
    }
  }
  @media (max-width: 640px) {
    flex-wrap: wrap;
    &__actions {
      width: 100%;
      justify-content: flex-end;
    }
  }
}
.skeleton-tile {
  width: 40px;
  height: 40px;
  border-radius: var(--nx-radius);
}
.skeleton-line {
  width: 70%;
  height: 14px;
  &--short {
    width: 30%;
    height: 12px;
  }
}
</style>
