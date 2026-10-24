<template>
  <CustomDialog
    :visible.sync="dialogVisible"
    :title="$t('modelConfigDialog.addModel')"
    width="880px"
    class="model-form-dialog"
    :confirmLoading="saving"
    :cancel-text="$t('button.cancel')"
    :confirm-text="$t('modelConfigDialog.addModel')"
    @close="handleClose"
    @confirm="confirm"
  >
    <div class="mf">
      <!-- Model information -->
      <section class="mf-section">
        <div class="mf-section__head">
          <h3 class="mf-section__title">{{ $t('modelConfigDialog.modelInfo') }}</h3>
          <label class="mf-toggle">
            <span>{{ $t('modelConfigDialog.enable') }}</span>
            <el-switch v-model="formData.isEnabled" :aria-label="$t('modelConfigDialog.enable')"></el-switch>
          </label>
        </div>

        <el-form :model="formData" label-position="top" class="mf-grid" @submit.native.prevent>
          <el-form-item :label="$t('modelConfigDialog.modelName')" prop="modelName">
            <el-input v-model="formData.modelName" :placeholder="$t('modelConfigDialog.enterModelName')"></el-input>
          </el-form-item>
          <el-form-item :label="$t('modelConfigDialog.supplier')" prop="supplier" required>
            <el-select v-model="formData.supplier" :placeholder="$t('modelConfigDialog.selectSupplier')"
              class="mf-full" filterable @focus="loadProviders">
              <el-option v-for="item in providers" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </el-form-item>
          <el-form-item :label="$t('modelConfigDialog.modelCode')" prop="modelCode">
            <el-input v-model="formData.modelCode" :placeholder="$t('modelConfigDialog.enterModelCode')"
              class="mf-mono"></el-input>
          </el-form-item>
          <el-form-item :label="$t('modelConfigDialog.modelId')" prop="id">
            <el-input v-model="formData.id" :placeholder="$t('modelConfigDialog.enterModelId')" maxlength="32"
              class="mf-mono"></el-input>
          </el-form-item>
          <el-form-item :label="$t('modelConfigDialog.remark')" prop="remark" class="mf-span">
            <el-input v-model="formData.remark" type="textarea" :placeholder="$t('modelConfigDialog.enterRemark')"
              :autosize="{ minRows: 2, maxRows: 5 }"></el-input>
          </el-form-item>
        </el-form>
      </section>

      <!-- Connection fields from the selected provider -->
      <section v-if="basicCallInfoFields.length" class="mf-section">
        <div class="mf-section__head">
          <h3 class="mf-section__title">{{ $t('modelConfigDialog.callInfo') }}</h3>
        </div>
        <el-form :model="formData.configJson" label-position="top" class="mf-grid" @submit.native.prevent>
          <el-form-item v-for="field in basicCallInfoFields" :key="field.prop" :label="field.label" :prop="field.prop">
            <el-input v-model="formData.configJson[field.prop]" :placeholder="field.placeholder"
              :type="field.type || 'text'" :show-password="field.type === 'password'"
              :autocomplete="field.type === 'password' ? 'new-password' : 'off'"
              :class="{ 'mf-mono': field.type === 'password' }">
            </el-input>
          </el-form-item>
        </el-form>
      </section>

      <!-- Advanced: JSON settings, sort order, documentation -->
      <section class="mf-section mf-advanced" :class="{ 'is-open': showAdvanced }">
        <button type="button" class="mf-disclosure" :aria-expanded="showAdvanced ? 'true' : 'false'"
          @click="showAdvanced = !showAdvanced">
          <i class="el-icon-arrow-right mf-disclosure__icon" aria-hidden="true"></i>
          <span class="mf-section__title">{{ tx('modelConfig.advanced', 'Advanced') }}</span>
          <span class="mf-disclosure__hint">{{ tx('modelConfig.advancedHint', 'JSON settings, sort order and documentation link') }}</span>
        </button>
        <div v-show="showAdvanced" class="mf-advanced__body">
          <el-form :model="formData.configJson" label-position="top" class="mf-grid" @submit.native.prevent>
            <el-form-item v-for="field in jsonCallInfoFields" :key="field.prop" :label="field.label" :prop="field.prop"
              class="mf-span">
              <el-input v-model="formData.configJson[field.prop]" type="textarea" class="mf-code"
                :autosize="{ minRows: 3, maxRows: 12 }" :placeholder="$t('modelConfigDialog.enterJsonExample')">
              </el-input>
            </el-form-item>
          </el-form>
          <el-form :model="formData" label-position="top" class="mf-grid" @submit.native.prevent>
            <el-form-item :label="$t('modelConfigDialog.sortOrder')" prop="sortOrder">
              <el-input v-model="formData.sort" type="number" :placeholder="$t('modelConfigDialog.enterSortOrder')"
                class="nx-num"></el-input>
            </el-form-item>
            <el-form-item :label="$t('modelConfigDialog.docLink')" prop="docLink">
              <el-input v-model="formData.docLink" :placeholder="$t('modelConfigDialog.enterDocLink')"></el-input>
            </el-form-item>
          </el-form>
        </div>
      </section>
    </div>
  </CustomDialog>
</template>

<script>
import Api from '@/apis/api';
import CustomDialog from './CustomDialog.vue';
export default {
  name: 'AddModelDialog',
  components: {
    CustomDialog
  },
  props: {
    visible: { type: Boolean, required: true },
    modelType: { type: String, required: true }
  },
  data() {
    return {
      saving: false,
      providers: [],
      dialogVisible: false,
      providersLoaded: false,
      providerFields: [],
      currentProvider: null,
      showAdvanced: false,
      formData: {
        id: '',
        modelName: '',
        modelCode: '',
        supplier: '',
        sort: 1,
        docLink: '',
        remark: '',
        isEnabled: true,
        isDefault: true,
        configJson: {}
      }
    }
  },
  watch: {
    visible(val) {
      this.dialogVisible = val;
      if (val) {
        this.initConfigJson();
      } else {
        this.resetForm();
      }
    },
    'formData.supplier'(newVal) {
      this.currentProvider = this.providers.find(p => p.value === newVal);
      this.providerFields = this.currentProvider?.fields || [];
      this.initDynamicConfig();
    }
  },
  computed: {
    dynamicCallInfoFields() {
      return this.providerFields;
    },
    basicCallInfoFields() {
      return this.dynamicCallInfoFields.filter(f => f.type !== 'json-textarea');
    },
    jsonCallInfoFields() {
      return this.dynamicCallInfoFields.filter(f => f.type === 'json-textarea');
    },
    chunkedCallInfoFields() {
      const chunkSize = 2;
      const result = [];
      for (let i = 0; i < this.dynamicCallInfoFields.length; i += chunkSize) {
        result.push(this.dynamicCallInfoFields.slice(i, i + chunkSize));
      }
      return result;
    }
  },
  methods: {
    // $t with an English fallback for keys still waiting in i18n/_pending
    tx(key, fallback) {
      const value = this.$t(key);
      return value !== key ? value : fallback;
    },
    loadProviders() {
      if (this.providersLoaded)
        return

      Api.model.getModelProviders(this.modelType, (data) => {
        this.providers = data.map(item => ({
          label: item.name,
          value: item.providerCode,
          fields: JSON.parse(item.fields || '[]').map(f => ({
            label: f.label,
            prop: f.key,
            type: f.type === 'dict' ? 'json-textarea' : f.type === 'password' ? 'password' : 'text',
            placeholder: `Please enter ${f.key}`
          }))
        }))
        this.providersLoaded = true
      })
    },
    initConfigJson() {
      const defaultConfig = {};
      this.providerFields.forEach(field => {
        defaultConfig[field.prop] = '';
      });
      this.formData.configJson = { ...defaultConfig };
    },

    handleClose() {
      this.saving = false;
      this.dialogVisible = false;
      this.$emit('update:visible', false);
    },
    initDynamicConfig() {
      const newConfig = {};
      this.providerFields.forEach(field => {
        newConfig[field.prop] = this.formData.configJson[field.prop] || '';
      });
      this.formData.configJson = newConfig;
    },
    confirm() {
      this.saving = true;

      // Validate model ID: cannot be pure text or spaces
      if (this.formData.id && !this.validateModelId(this.formData.id)) {
        this.$message.error(this.$t('modelConfigDialog.invalidModelId'));
        this.saving = false;
        return;
      }

      if (!this.formData.supplier) {
        this.$message.error(this.$t('addModelDialog.requiredSupplier'));
        this.saving = false;
        return;
      }

      // dict 字段必须解析为 JSON 对象再提交，否则会以字符串入库
      for (const field of this.providerFields) {
        if (field.type !== 'json-textarea') continue;
        const raw = this.formData.configJson[field.prop];
        if (!raw || typeof raw === 'object') continue;
        try {
          const parsed = JSON.parse(raw);
          if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error('not object');
          }
          this.formData.configJson[field.prop] = parsed;
        } catch (e) {
          this.showAdvanced = true;
          this.$message.error(this.tx('modelConfig.jsonObjectRequired', 'Enter a JSON object, for example {"key":"value"}.'));
          this.saving = false;
          return;
        }
      }

      const submitData = {
        id: this.formData.id || '',
        modelName: this.formData.modelName || '',
        modelCode: this.formData.modelCode || '',
        supplier: this.formData.supplier,
        sort: this.formData.sort || 1,
        docLink: this.formData.docLink || '',
        remark: this.formData.remark || '',
        isEnabled: this.formData.isEnabled ? 1 : 0,
        isDefault: this.formData.isDefault ? 1 : 0,
        provideCode: this.formData.supplier,
        configJson: {
          ...this.formData.configJson,
          type: this.formData.supplier
        }
      };

      try {
        this.$emit('confirm', submitData);
        this.handleClose();
        this.resetForm();
      } catch (e) {
        console.error(e);
      } finally {
        this.saving = false;
      }
    },
    resetForm() {
      this.saving = false;
      this.formData = {
        id: '',
        modelName: '',
        modelCode: '',
        supplier: '',
        sort: 1,
        docLink: '',
        remark: '',
        isEnabled: true,
        isDefault: true,
        configJson: {}
      };
      // Reset loading state
      this.providers = [];
      this.providersLoaded = false;
      // Reset field configuration
      this.providerFields = [];
      this.currentProvider = null;
      this.showAdvanced = false;
    },
    
    // Validate model ID: cannot be pure text or spaces
    validateModelId(modelId) {
      if (!modelId || typeof modelId !== 'string') {
        return false;
      }
      
      // Trim leading and trailing spaces
      const trimmedId = modelId.trim();
      
      // Check whether empty or pure spaces
      if (trimmedId === '') {
        return false;
      }
      
      // Check whether contains only letters
      if (/^[a-zA-Z]+$/.test(trimmedId)) {
        return false;
      }
      
      // Check whether contains spaces
      if (/\s/.test(trimmedId)) {
        return false;
      }
      
      // Allow letters, numbers, underscores, hyphens
      if (!/^[a-zA-Z0-9_-]+$/.test(trimmedId)) {
        return false;
      }
      
      return true;
    }
  }
}
</script>

<style lang="scss" scoped>
// Model form dialog (shared look with AddModelDialog / ModelEditDialog)
.mf {
  display: flex;
  flex-direction: column;
  gap: var(--nx-space-5);
}

.mf-section {
  & + & {
    padding-top: var(--nx-space-5);
    border-top: 1px solid var(--nx-border);
  }

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--nx-space-3);
    margin-bottom: var(--nx-space-3);
  }
  &__title {
    margin: 0;
    font-size: var(--nx-text-callout);
    font-weight: 600;
    color: var(--nx-text);
  }
}

.mf-toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--nx-space-3);
  padding: var(--nx-space-1) var(--nx-space-1) var(--nx-space-1) var(--nx-space-3);
  border-radius: var(--nx-radius-pill);
  background: var(--nx-surface-2);
  font-size: var(--nx-text-footnote);
  color: var(--nx-text-2);
  cursor: pointer;
}

// Two columns on wide dialogs, one on narrow screens; labels sit above fields
.mf-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: var(--nx-space-4);

  ::v-deep .el-form-item {
    min-width: 0;
    margin-bottom: var(--nx-space-4);
  }
  ::v-deep .el-form-item__label {
    padding-bottom: var(--nx-space-1);
    line-height: 1.4;
    overflow-wrap: anywhere;
  }
  ::v-deep .el-select,
  ::v-deep .el-input-number {
    width: 100%;
  }
}

.mf-span {
  grid-column: 1 / -1;
}

.mf-full {
  width: 100%;
}

.mf-mono ::v-deep .el-input__inner,
.mf-code ::v-deep .el-textarea__inner {
  font-family: var(--nx-font-mono);
  font-size: var(--nx-text-footnote);
}

.mf-code ::v-deep .el-textarea__inner {
  line-height: 1.55;
}

// "Advanced" disclosure
.mf-disclosure {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--nx-space-1) var(--nx-space-2);
  width: 100%;
  min-height: var(--nx-control-h-lg);
  margin: calc(-1 * var(--nx-space-2)) 0 0;
  padding: var(--nx-space-2) var(--nx-space-2) var(--nx-space-2) 0;
  border: 0;
  border-radius: var(--nx-radius);
  background: transparent;
  color: var(--nx-text);
  font: inherit;
  text-align: left;
  cursor: pointer;

  &:hover .mf-disclosure__icon {
    color: var(--nx-text);
  }

  &__icon {
    color: var(--nx-text-3);
    transition: transform var(--nx-dur-2) var(--nx-ease);
  }
  &__hint {
    font-size: var(--nx-text-footnote);
    color: var(--nx-text-3);
  }
}

.mf-advanced.is-open .mf-disclosure__icon {
  transform: rotate(90deg);
}

.mf-advanced__body {
  padding-top: var(--nx-space-3);
}

@media (max-width: 640px) {
  .mf-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .mf-disclosure__hint {
    flex-basis: 100%;
    padding-left: 22px;
  }
}
</style>
