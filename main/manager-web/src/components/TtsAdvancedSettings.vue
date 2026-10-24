<template>
  <el-drawer
    :visible.sync="drawerVisible"
    :before-close="handleClose"
    direction="rtl"
    size="min(420px, 100%)"
    :modal="true"
    :show-close="false"
    custom-class="tts-advanced-drawer"
  >
    <div class="drawer-header" slot="title">
      <div class="drawer-titles">
        <span class="drawer-title">{{ $t('roleConfig.ttsAdvanced') }}</span>
        <span class="drawer-subtitle">{{ $t('roleConfig.advancedSettings') }}</span>
      </div>
      <button type="button" class="nx-icon-btn" :aria-label="$t('button.close')" @click="handleClose">
        <i class="el-icon-close" aria-hidden="true"></i>
      </button>
    </div>

    <div class="drawer-content">
      <el-form label-position="top">
        <!-- Volume -->
        <el-form-item>
          <template #label>
            <span class="slider-label">
              <span>{{ $t('roleConfig.ttsVolume') }}</span>
              <span class="slider-value">{{ formatValue(localSettings.volume) }}</span>
            </span>
          </template>
          <div class="slider-container">
            <el-slider
              v-model="localSettings.volume"
              :min="-100"
              :max="100"
              :step="1"
              :format-tooltip="formatTooltip"
              class="tts-slider"
              @change="markTtsSettingChanged('volume')"
            />
            <span class="slider-hint">{{ $t('roleConfig.volumeHint') }}</span>
          </div>
        </el-form-item>

        <!-- Speed -->
        <el-form-item>
          <template #label>
            <span class="slider-label">
              <span>{{ $t('roleConfig.ttsRate') }}</span>
              <span class="slider-value">{{ formatValue(localSettings.speed) }}</span>
            </span>
          </template>
          <div class="slider-container">
            <el-slider
              v-model="localSettings.speed"
              :min="-100"
              :max="100"
              :step="1"
              :format-tooltip="formatTooltip"
              class="tts-slider"
              @change="markTtsSettingChanged('speed')"
            />
            <span class="slider-hint">{{ $t('roleConfig.speedHint') }}</span>
          </div>
        </el-form-item>

        <!-- Pitch -->
        <el-form-item>
          <template #label>
            <span class="slider-label">
              <span>{{ $t('roleConfig.ttsPitch') }}</span>
              <span class="slider-value">{{ formatValue(localSettings.pitch) }}</span>
            </span>
          </template>
          <div class="slider-container">
            <el-slider
              v-model="localSettings.pitch"
              :min="-100"
              :max="100"
              :step="1"
              :format-tooltip="formatTooltip"
              class="tts-slider"
              @change="markTtsSettingChanged('pitch')"
            />
            <span class="slider-hint">{{ $t('roleConfig.pitchHint') }}</span>
          </div>
        </el-form-item>

      </el-form>
      <!-- Associated Replacement Words -->
      <div class="replacement-section">
        <h4 class="replacement-label">
          {{ $t('roleConfig.replacementWordLabel') }}
          <el-tooltip popper-class="tts-tooltip" :content="$t('roleConfig.replacementWordTip')" placement="top">
            <i class="el-icon-question" tabindex="0" :aria-label="$t('roleConfig.replacementWordTip')"></i>
          </el-tooltip>
        </h4>
        <el-select
          v-model="replacementWordIds"
          multiple
          filterable
          collapse-tags
          :placeholder="$t('replacementDialog.selectPlaceholder')"
          class="replacement-word-select"
        >
          <el-option
            v-for="item in replacementWordList"
            :key="item.id"
            :label="item.fileName"
            :value="item.id"
          />
        </el-select>
      </div>
    </div>

    <div class="drawer-footer">
      <el-button @click="handleCancel">{{ $t('button.cancel') }}</el-button>
      <el-button type="primary" @click="handleSave">{{ $t('button.save') }}</el-button>
    </div>
  </el-drawer>
</template>

<script>
import correctWord from '@/apis/module/correctWord';

export default {
  name: 'TtsAdvancedSettings',
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    settings: {
      type: Object,
      default: () => ({
        volume: 0,
        speed: 0,
        pitch: 0
      })
    },
    checkedReplacementWordIds: {
      type: Array,
      default: () => []
    },
  },
  data() {
    return {
      localSettings: {
        volume: 0,
        speed: 0,
        pitch: 0,
      },
      changedTtsFields: {
        volume: false,
        speed: false,
        pitch: false,
      },
      replacementWordIds: [],
      replacementWordList: []
    };
  },
  computed: {
    drawerVisible: {
      get() {
        return this.visible;
      },
      set(val) {
        this.$emit('update:visible', val);
      }
    }
  },
  watch: {
    visible(newVal) {
      if (newVal) {
        // Copy current settings locally when drawer opens
        this.localSettings = { ...this.settings };
        this.changedTtsFields = {
          volume: false,
          speed: false,
          pitch: false,
        };
        this.replacementWordIds = [...this.checkedReplacementWordIds];
        this.fetchReplacementWordList();
      }
    }
  },
  methods: {
    handleClose() {
      this.$emit('update:visible', false);
    },
    handleCancel() {
      // Close directly without saving on cancel
      this.handleClose();
    },
    handleSave() {
      // Save settings and close
      const changedTtsFields = Object.keys(this.changedTtsFields)
        .filter((field) => this.changedTtsFields[field]);
      this.$emit('save', {
        ...this.localSettings,
        changedTtsFields,
        replacementWordIds: this.replacementWordIds
      });
      this.handleClose();
    },
    markTtsSettingChanged(field) {
      this.$set(this.changedTtsFields, field, true);
    },
    formatTooltip(val) {
      return `${val}%`;
    },
    formatValue(val) {
      const number = Number(val) || 0;
      return number > 0 ? `+${number}` : String(number);
    },
    fetchReplacementWordList() {
      correctWord.selectAll(({ data }) => {
        if (data.code === 0) {
          this.replacementWordList = data.data;
        }
      });
    },
    getTagName(id) {
      const item = this.replacementWordList.find(item => item.id === id);
      return item ? item.fileName : '';
    }
  }
};
</script>

<style scoped lang="scss">
// Voice tuning sheet: enters and leaves by the right edge, dialog-style header and footer.
.drawer-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--nx-space-3);
  padding: var(--nx-space-5) var(--nx-space-4) var(--nx-space-4) var(--nx-space-6);
  border-bottom: 1px solid var(--nx-border);
}
.drawer-titles {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.drawer-title {
  color: var(--nx-text);
  font-size: var(--nx-text-headline);
  font-weight: 600;
  letter-spacing: -0.01em;
}
.drawer-subtitle {
  color: var(--nx-text-2);
  font-size: var(--nx-text-footnote);
}
.drawer-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--nx-space-5) var(--nx-space-6);
}
.slider-container {
  width: 100%;
  padding: 0 6px;
}
.slider-label {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: var(--nx-space-3);
}
.slider-value {
  min-width: 44px;
  padding: 2px 8px;
  border-radius: var(--nx-radius-pill);
  background: var(--nx-surface-2);
  color: var(--nx-text);
  font-size: var(--nx-text-caption);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-align: center;
}
.slider-hint {
  display: block;
  margin-top: 4px;
  color: var(--nx-text-3);
  font-size: var(--nx-text-caption);
  line-height: 1.4;
}
.tts-slider {
  width: 100%;
}
.drawer-footer {
  flex: none;
  display: flex;
  justify-content: flex-end;
  gap: var(--nx-space-2);
  padding: var(--nx-space-3) var(--nx-space-6) var(--nx-space-5);
  border-top: 1px solid var(--nx-border);
  .el-button + .el-button {
    margin-left: 0;
  }
}
::v-deep .el-form-item {
  margin-bottom: var(--nx-space-5);
}
::v-deep .el-form-item__label {
  display: flex;
  width: 100%;
  padding-bottom: 4px;
  color: var(--nx-text-2);
  font-size: var(--nx-text-footnote);
  font-weight: 500;
  line-height: 1.4;
}
.replacement-section {
  padding-top: var(--nx-space-5);
  border-top: 1px solid var(--nx-border);
}
.replacement-label {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 var(--nx-space-2);
  color: var(--nx-text-2);
  font-size: var(--nx-text-footnote);
  font-weight: 500;
  i {
    color: var(--nx-text-3);
    cursor: help;
    &:hover,
    &:focus-visible {
      color: var(--nx-text-2);
    }
  }
}
</style>

<style lang="scss">
.tts-advanced-drawer {
  border-radius: var(--nx-radius-xl) 0 0 var(--nx-radius-xl);
  overflow: hidden;
  .el-drawer__header {
    margin-bottom: 0;
    padding: 0;
  }
  .el-drawer__body {
    display: flex;
    flex-direction: column;
    min-height: 0;
    padding: 0;
  }
}
.replacement-word-select {
  width: 100%;
}
.tts-tooltip {
  max-height: 60vh;
  max-width: 400px;
  overflow-y: auto;
  scrollbar-width: thin;
  word-break: break-word;
}
</style>
