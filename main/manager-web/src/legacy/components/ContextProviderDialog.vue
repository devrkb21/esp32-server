<template>
  <CustomDialog
    :title="$t('contextProviderDialog.title')"
    :visible.sync="dialogVisible"
    width="760px"
    class="context-provider-dialog"
    :closeOnClickModal="false"
    :confirmText="$t('contextProviderDialog.confirm')"
    :cancelText="$t('contextProviderDialog.cancel')"
    @confirm="handleConfirm"
  >
    <div class="dialog-content">
      <div v-if="localProviders.length === 0" class="nx-empty cp-empty">
        <span class="nx-icon-tile nx-icon-tile--lg" aria-hidden="true"><i class="el-icon-connection"></i></span>
        <p class="nx-empty__title">{{ $t('contextProviderDialog.noContextApi') }}</p>
        <el-button class="nx-empty__action" type="primary" icon="el-icon-plus" @click="addProvider(0)">
          {{ $t('contextProviderDialog.add') }}
        </el-button>
      </div>

      <section
        v-for="(provider, pIndex) in localProviders"
        :key="pIndex"
        class="provider-item"
        :aria-label="tx('contextProviderDialog.sourceN', 'Source {n}', { n: pIndex + 1 })"
      >
        <div class="provider-head">
          <span class="provider-title">{{ tx('contextProviderDialog.sourceN', 'Source {n}', { n: pIndex + 1 }) }}</span>
          <button
            type="button"
            class="nx-icon-btn nx-icon-btn--danger provider-remove"
            :aria-label="tx('contextProviderDialog.removeSource', 'Remove source')"
            :title="tx('contextProviderDialog.removeSource', 'Remove source')"
            @click="removeProvider(pIndex)"
          >
            <i class="el-icon-delete" aria-hidden="true"></i>
          </button>
        </div>

        <label class="field-label" :for="`cp-url-${pIndex}`">{{ $t('contextProviderDialog.apiUrl') }}</label>
        <el-input
          :id="`cp-url-${pIndex}`"
          v-model="provider.url"
          class="url-input"
          :placeholder="$t('contextProviderDialog.apiUrlPlaceholder')"
        ></el-input>

        <div class="field-label field-label--spaced">{{ $t('contextProviderDialog.requestHeaders') }}</div>
        <div class="headers-list">
          <div
            v-for="(header, hIndex) in provider.headers"
            :key="hIndex"
            class="header-row"
          >
            <el-input
              v-model="header.key"
              class="header-key"
              size="small"
              :placeholder="$t('contextProviderDialog.headerKeyPlaceholder')"
            ></el-input>
            <el-input
              v-model="header.value"
              class="header-value"
              size="small"
              :placeholder="$t('contextProviderDialog.headerValuePlaceholder')"
            ></el-input>
            <div class="row-controls">
              <button
                type="button"
                class="nx-icon-btn row-btn"
                :aria-label="$t('contextProviderDialog.addHeader')"
                :title="$t('contextProviderDialog.addHeader')"
                @click="addHeader(pIndex, hIndex + 1)"
              >
                <i class="el-icon-plus" aria-hidden="true"></i>
              </button>
              <button
                type="button"
                class="nx-icon-btn nx-icon-btn--danger row-btn"
                :aria-label="tx('contextProviderDialog.removeHeader', 'Remove header')"
                :title="tx('contextProviderDialog.removeHeader', 'Remove header')"
                @click="removeHeader(pIndex, hIndex)"
              >
                <i class="el-icon-minus" aria-hidden="true"></i>
              </button>
            </div>
          </div>
          <!-- Empty Headers State -->
          <div v-if="provider.headers.length === 0" class="header-row empty-header">
            <span class="no-header-text">{{ $t('contextProviderDialog.noHeaders') }}</span>
            <el-button type="text" icon="el-icon-plus" size="small" @click="addHeader(pIndex, 0)">
              {{ $t('contextProviderDialog.addHeader') }}
            </el-button>
          </div>
        </div>
      </section>

      <el-button
        v-if="localProviders.length"
        class="add-source-btn"
        icon="el-icon-plus"
        @click="addProvider(localProviders.length)"
      >
        {{ tx('contextProviderDialog.addSource', 'Add source') }}
      </el-button>
    </div>
  </CustomDialog>
</template>

<script>
import CustomDialog from './CustomDialog.vue';

export default {
  name: 'ContextProviderDialog',
  components: { CustomDialog },
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    providers: {
      type: Array,
      default: () => []
    }
  },
  data() {
    return {
      localProviders: []
    };
  },
  computed: {
    dialogVisible: {
      get() {
        return this.visible;
      },
      set(val) {
        this.$emit('update:visible', val);
      }
    }
  },
  watch: {
    visible(val) {
      if (val) {
        this.initLocalData();
      }
    }
  },
  methods: {
    // Translation with an English fallback for keys still waiting in i18n/_pending
    tx(key, fallback, params = {}) {
      const value = this.$t(key, params);
      if (value && value !== key) {
        return value;
      }
      return String(fallback).replace(/\{(\w+)\}/g, (match, name) =>
        params[name] !== undefined ? params[name] : match
      );
    },
    initLocalData() {
      // Deep clone and convert headers object to array
      this.localProviders = this.providers.map(p => {
        const headers = p.headers || {};
        return {
          url: p.url || '',
          headers: Object.entries(headers).map(([key, value]) => ({ key, value }))
        };
      });
      
      // If empty, add a default block
      if (this.localProviders.length === 0) {
         this.localProviders.push({ url: '', headers: [{ key: '', value: '' }] });
      }
    },
    addProvider(index) {
      this.localProviders.splice(index, 0, {
        url: '',
        headers: [{ key: '', value: '' }]
      });
    },
    removeProvider(index) {
      this.localProviders.splice(index, 1);
    },
    addHeader(pIndex, hIndex) {
      this.localProviders[pIndex].headers.splice(hIndex, 0, { key: '', value: '' });
    },
    removeHeader(pIndex, hIndex) {
      this.localProviders[pIndex].headers.splice(hIndex, 1);
    },
    handleConfirm() {
      const result = this.localProviders
        .filter(p => p.url.trim() !== '')
        .map(p => {
          const headersObj = {};
          p.headers.forEach(h => {
            if (h.key.trim()) {
              headersObj[h.key.trim()] = h.value;
            }
          });
          return {
            url: p.url.trim(),
            headers: headersObj
          };
        });

      this.$emit('confirm', result);
      this.$emit('update:visible', false);
    }
  }
};
</script>

<style scoped lang="scss">
.dialog-content {
  display: flex;
  flex-direction: column;
  gap: var(--nx-space-4);
}
.cp-empty {
  padding: var(--nx-space-7) var(--nx-space-4);
}
.provider-item {
  padding: var(--nx-space-4);
  border-radius: var(--nx-radius-lg);
  background: var(--nx-surface-2);
}
.provider-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--nx-space-2);
  margin: -4px -4px var(--nx-space-2) 0;
}
.provider-title {
  color: var(--nx-text);
  font-size: var(--nx-text-callout);
  font-weight: 600;
}
.field-label {
  display: block;
  margin-bottom: 6px;
  color: var(--nx-text-2);
  font-size: var(--nx-text-footnote);
  font-weight: 500;
  &--spaced {
    margin-top: var(--nx-space-4);
  }
}
.url-input ::v-deep .el-input__inner,
.headers-list ::v-deep .el-input__inner {
  background: var(--nx-surface);
}
.url-input ::v-deep .el-input__inner {
  font-family: var(--nx-font-mono);
  font-size: var(--nx-text-footnote);
}
.headers-list {
  display: flex;
  flex-direction: column;
  gap: var(--nx-space-2);
}
.header-row {
  display: flex;
  align-items: center;
  gap: var(--nx-space-2);
  min-width: 0;
}
.header-key {
  flex: 0 0 34%;
  min-width: 0;
}
.header-value {
  flex: 1;
  min-width: 0;
}
.row-controls {
  display: flex;
  flex: none;
  gap: 2px;
}
.row-btn {
  width: 32px;
  height: 32px;
  font-size: var(--nx-text-callout);
}
.empty-header {
  justify-content: space-between;
  padding: var(--nx-space-2) var(--nx-space-3);
  border: 1px dashed var(--nx-border-strong);
  border-radius: var(--nx-radius);
  color: var(--nx-text-3);
  font-size: var(--nx-text-footnote);
}
.add-source-btn {
  align-self: flex-start;
}

@media (max-width: 560px) {
  .header-row:not(.empty-header) {
    flex-wrap: wrap;
  }
  .header-key {
    flex: 1 1 100%;
  }
}
</style>
