<template>
  <CustomDialog
    :title="title"
    :visible.sync="dialogVisible"
    width="880px"
    class="model-form-dialog"
    :confirmLoading="saving"
    :cancel-text="$t('button.cancel')"
    :confirm-text="$t('modelConfigDialog.save')"
    @confirm="handleSave"
    @close="handleClose"
    @open="handleOpen"
  >
    <div class="mf">
      <!-- Model information -->
      <section class="mf-section">
        <div class="mf-section__head">
          <h3 class="mf-section__title">{{ $t("modelConfigDialog.modelInfo") }}</h3>
          <label class="mf-toggle">
            <span>{{ $t("modelConfigDialog.enable") }}</span>
            <el-switch v-model="form.isEnabled" :active-value="1" :inactive-value="0"
              :aria-label="$t('modelConfigDialog.enable')"></el-switch>
          </label>
        </div>

        <el-form :model="form" ref="form" label-position="top" class="mf-grid" @submit.native.prevent>
          <el-form-item :label="$t('modelConfigDialog.modelName')" prop="name">
            <el-input v-model="form.modelName" :placeholder="$t('modelConfigDialog.enterModelName')"></el-input>
          </el-form-item>
          <el-form-item :label="$t('modelConfigDialog.supplier')" prop="supplier">
            <el-select v-model="form.configJson.type" :placeholder="$t('modelConfigDialog.selectSupplier')"
              class="mf-full" filterable @focus="loadProviders">
              <el-option v-for="item in providers" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </el-form-item>
          <el-form-item :label="$t('modelConfigDialog.modelCode')" prop="code" class="mf-span">
            <el-input v-model="form.modelCode" :placeholder="$t('modelConfigDialog.enterModelCode')"
              class="mf-mono"></el-input>
          </el-form-item>
          <el-form-item :label="$t('modelConfigDialog.remark')" prop="remark" class="mf-span">
            <el-input v-model="form.remark" type="textarea" :autosize="{ minRows: 2, maxRows: 5 }"
              :placeholder="$t('modelConfigDialog.enterRemark')"></el-input>
          </el-form-item>
        </el-form>
      </section>

      <!-- Connection fields from the selected provider; secrets are masked with a reveal toggle -->
      <section v-if="basicCallInfoFields.length" class="mf-section">
        <div class="mf-section__head">
          <h3 class="mf-section__title">{{ $t("modelConfigDialog.callInfo") }}</h3>
        </div>
        <el-form :model="form.configJson" ref="callInfoForm" label-position="top" class="mf-grid"
          @submit.native.prevent>
          <el-form-item v-for="field in basicCallInfoFields" :key="field.prop" :label="field.label" :prop="field.prop">
            <el-input v-model="form.configJson[field.prop]" :placeholder="field.placeholder" :type="field.type"
              :show-password="field.type === 'password'"
              :autocomplete="field.type === 'password' ? 'new-password' : 'off'"
              :class="{ 'mf-mono': field.type === 'password' || isSensitiveField(field.prop) }"
              @focus="isSensitiveField(field.prop) ? handleInputFocus(field.prop, form.configJson[field.prop]) : undefined"
              @blur="isSensitiveField(field.prop) ? handleInputBlur(field.prop) : undefined"></el-input>
          </el-form-item>
        </el-form>
      </section>

      <!-- Advanced: JSON settings, sort order, documentation -->
      <section class="mf-section mf-advanced" :class="{ 'is-open': showAdvanced }">
        <button type="button" class="mf-disclosure" :aria-expanded="showAdvanced ? 'true' : 'false'"
          @click="showAdvanced = !showAdvanced">
          <i class="el-icon-arrow-right mf-disclosure__icon" aria-hidden="true"></i>
          <span class="mf-section__title">{{ tx("modelConfig.advanced", "Advanced") }}</span>
          <span class="mf-disclosure__hint">{{ tx("modelConfig.advancedHint", "JSON settings, sort order and documentation link") }}</span>
        </button>
        <div v-show="showAdvanced" class="mf-advanced__body">
          <el-form v-if="jsonCallInfoFields.length" :model="form.configJson" label-position="top" class="mf-grid"
            @submit.native.prevent>
            <el-form-item v-for="field in jsonCallInfoFields" :key="field.prop" :label="field.label" :prop="field.prop"
              class="mf-span">
              <el-input v-model="fieldJsonMap[field.prop]" type="textarea" class="mf-code"
                :autosize="{ minRows: 3, maxRows: 14 }" :placeholder="$t('modelConfigDialog.enterJsonExample')"
                @change="(val) => handleJsonChange(field.prop, val)"
                @focus="isSensitiveField(field.prop) ? handleJsonInputFocus(field.prop, fieldJsonMap[field.prop]) : undefined"
                @blur="isSensitiveField(field.prop) ? handleJsonInputBlur(field.prop) : undefined"></el-input>
            </el-form-item>
          </el-form>
          <el-form :model="form" label-position="top" class="mf-grid" @submit.native.prevent>
            <el-form-item :label="$t('modelConfigDialog.sortOrder')" prop="sort">
              <el-input v-model.number="form.sort" type="number" :placeholder="$t('modelConfigDialog.enterSortOrder')"
                class="nx-num"></el-input>
            </el-form-item>
            <el-form-item :label="$t('modelConfigDialog.docLink')" prop="docUrl">
              <el-input v-model="form.docLink" :placeholder="$t('modelConfigDialog.enterDocLink')"></el-input>
            </el-form-item>
          </el-form>
        </div>
      </section>
    </div>
  </CustomDialog>
</template>

<script>
import CustomDialog from './CustomDialog.vue';
import Api from "@/apis/api";

export default {
  name: "ModelEditDialog",
  components: { CustomDialog },
  props: {
    visible: { type: Boolean, default: false },
    modelData: {
      type: Object,
      default: () => ({}),
      validator: (value) => typeof value === "object" && !Array.isArray(value),
    },
    modelType: { type: String, required: true },
  },
  data() {
    return {
      dialogVisible: this.visible,
      providers: [],
      providersLoaded: false,
      saving: false,
      allProvidersData: null,
      pendingProviderType: null,
      pendingModelData: null,
      dynamicCallInfoFields: [],
      fieldJsonMap: {}, // Store string representation of JSON fields
      sensitive_keys: [
        "api_key",
        "personal_access_token",
        "access_token",
        "token",
        "secret",
        "access_key_secret",
        "secret_key",
      ],
      originalValues: {}, // Store original values to restore on blur
      showAdvanced: false,
      form: {
        id: "",
        modelType: "",
        modelCode: "",
        modelName: "",
        isDefault: false,
        isEnabled: false,
        docLink: "",
        remark: "",
        sort: 0,
        configJson: {},
      },
    };
  },
  computed: {
    title() {
      return this.modelData.duplicateMode
        ? this.$t("modelConfigDialog.duplicateModel")
        : this.$t("modelConfigDialog.editModel");
    },
    basicCallInfoFields() {
      return this.dynamicCallInfoFields.filter((f) => f.type !== "json-textarea");
    },
    jsonCallInfoFields() {
      return this.dynamicCallInfoFields.filter((f) => f.type === "json-textarea");
    },
    chunkedCallInfoFields() {
      const chunkSize = 2;
      const result = [];
      for (let i = 0; i < this.dynamicCallInfoFields.length; i += chunkSize) {
        result.push(this.dynamicCallInfoFields.slice(i, i + chunkSize));
      }
      return result;
    },
  },
  watch: {
    modelType() {
      this.resetProviders();
      this.loadProviders();
    },
    visible(val) {
      this.dialogVisible = val;
    },
    dialogVisible(val) {
      this.$emit("update:visible", val);
    },
    "form.configJson.type"(newVal) {
      if (newVal && this.providersLoaded) {
        this.loadProviderFields(newVal);
      }
    },
  },
  methods: {
    // $t with an English fallback for keys still waiting in i18n/_pending
    tx(key, fallback) {
      const value = this.$t ? this.$t(key) : key;
      return value !== key ? value : fallback;
    },
    handleOpen() {
      this.loadProviders();
      if (this.modelData.id) {
        this.loadModelData();
      }
    },
    handleClose() {
      this.saving = false;
      // Handle flicker when closing dialog
      setTimeout(() => {
        this.resetForm();
      }, 200)
    },
    resetForm() {
      this.form = {
        id: "",
        modelType: "",
        modelCode: "",
        modelName: "",
        isDefault: false,
        isEnabled: false,
        docLink: "",
        remark: "",
        sort: 0,
        configJson: {},
      };
      this.fieldJsonMap = {};
      this.showAdvanced = false;
    },
    resetProviders() {
      this.providers = [];
      this.providersLoaded = false;
    },
    loadModelData() {
      if (this.modelData.id) {
        Api.model.getModelConfig(this.modelData.id, ({ data }) => {
          if (data.code === 0 && data.data) {
            let model = data.data;

            if (this.modelData.duplicateMode) {
              model.modelName =
                this.modelData.modelName + this.$t("modelConfigDialog.copySuffix");
              model.modelCode =
                this.modelData.modelCode + this.$t("modelConfigDialog.copySuffix");

              // Handle sensitive fields
              if (model.configJson) {
                Object.keys(model.configJson).forEach((key) => {
                  if (this.isSensitiveField(key) && model.configJson[key]) {
                    const sensitiveName = this.getSensitiveFieldName(key);
                    model.configJson[key] = `Your ${sensitiveName}`;
                  }
                });
              }
            }
            this.pendingProviderType = model.configJson.type;
            this.pendingModelData = model;

            if (this.providersLoaded) {
              this.loadProviderFields(model.configJson.type);
            } else {
              this.loadProviders();
            }
          }
        });
      }
    },
    handleSave() {
      this.saving = true; // Start saving

      // Process all JSON fields
      Object.keys(this.fieldJsonMap).forEach((key) => {
        const parsed = this.validateJson(this.fieldJsonMap[key]);
        if (parsed !== null) {
          this.form.configJson[key] = parsed;
        }
      });

      const formData = {
        id: this.modelData.id,
        modelCode: this.form.modelCode,
        modelName: this.form.modelName,
        isDefault: this.form.isDefault ? 1 : 0,
        isEnabled: this.form.isEnabled ? 1 : 0,
        docLink: this.form.docLink,
        remark: this.form.remark,
        sort: this.form.sort || 0,
        configJson: { ...this.form.configJson },
      };

      this.$emit("save", {
        provideCode: this.form.configJson.type,
        formData,
        done: () => {
          this.saving = false; // Callback after saving
        },
      });

      // Auto close loading state after 3s if parent does not handle done callback
      setTimeout(() => {
        this.saving = false;
      }, 3000);
    },
    loadProviders() {
      if (this.providersLoaded) return;

      Api.model.getModelProviders(this.modelType, (data) => {
        this.providers = data.map((item) => ({
          label: item.name,
          value: String(item.providerCode),
        }));
        this.providersLoaded = true;
        this.allProvidersData = data;

        if (this.pendingProviderType) {
          this.loadProviderFields(this.pendingProviderType);
        }
      });
    },
    loadProviderFields(providerCode) {
      if (this.allProvidersData) {
        const provider = this.allProvidersData.find(
          (p) => p.providerCode === providerCode
        );
        if (provider) {
          this.dynamicCallInfoFields = JSON.parse(provider.fields || "[]").map((f) => ({
            label: f.label,
            prop: f.key,
            type:
              f.type === "dict"
                ? "json-textarea"
                : f.type === "password"
                  ? "password"
                  : "text",
            placeholder: `Please enter ${f.key}`,
          }));

          if (this.pendingModelData && this.pendingProviderType === providerCode) {
            this.processModelData(this.pendingModelData);
            this.pendingModelData = null;
            this.pendingProviderType = null;
          }
        }
      }
    },
    processModelData(model) {
      let configJson = model.configJson || {};
      this.dynamicCallInfoFields.forEach((field) => {
        if (!configJson.hasOwnProperty(field.prop)) {
          configJson[field.prop] = "";
        } else if (field.type === "json-textarea") {
          // 兼容已保存为 JSON 字符串的字典，避免再次序列化后无法编辑。
          if (typeof configJson[field.prop] === "string") {
            try {
              const parsed = JSON.parse(configJson[field.prop]);
              if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
                configJson[field.prop] = parsed;
              }
            } catch {
              // 保留非法值的显示，由现有校验提示用户修正。
            }
          }
          this.$set(
            this.fieldJsonMap,
            field.prop,
            this.formatJson(configJson[field.prop])
          );
          configJson[field.prop] = this.ensureObject(configJson[field.prop]);
        } else if (typeof configJson[field.prop] !== "string") {
          configJson[field.prop] = String(configJson[field.prop]);
        }
      });

      this.form = {
        id: model.id,
        modelType: model.modelType,
        modelCode: model.modelCode,
        modelName: model.modelName,
        isDefault: model.isDefault,
        isEnabled: model.isEnabled,
        docLink: model.docLink,
        remark: model.remark,
        sort: Number(model.sort) || 0,
        configJson: { ...configJson },
      };
    },
    handleJsonChange(field, value) {
      const parsed = this.validateJson(value);
      if (parsed !== null) {
        this.form.configJson[field] = parsed;
      }
    },
    validateJson(value) {
      try {
        const parsed = JSON.parse(value);
        if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
          return parsed;
        }
        this.showAdvanced = true;
        this.$message.error({
          message: 'Must enter dictionary format (e.g. {"key":"value"}), saving will use original data',
          showClose: true,
        });
        return null;
      } catch (e) {
        this.showAdvanced = true;
        this.$message.error({
          message: 'JSON format error (e.g. {"key":"value"}), saving will use original data',
          showClose: true,
        });
        return null;
      }
    },
    formatJson(obj) {
      try {
        return JSON.stringify(obj, null, 2);
      } catch {
        return "";
      }
    },
    ensureObject(value) {
      return typeof value === "object" ? value : {};
    },

    // Check if field is sensitive
    isSensitiveField(fieldName) {
      // Convert field name to lower case for comparison
      const lowerFieldName = fieldName.toLowerCase();
      // Match defined sensitive keys
      return this.sensitive_keys.includes(lowerFieldName);
    },

    // Get display name for sensitive field
    getSensitiveFieldName(fieldName) {
      const keyMap = {
        api_key: "API Key",
        personal_access_token: "Personal Access Token",
        access_token: "Access Token",
        token: "Token",
        secret: "Secret",
        access_key_secret: "Access Key Secret",
        secret_key: "Secret Key",
      };

      for (const [key, value] of Object.entries(keyMap)) {
        if (fieldName.toLowerCase().includes(key)) {
          return value;
        }
      }
      return "Sensitive Information";
    },

    // Handle input focus event
    handleInputFocus(field, value) {
      // Clear display if value contains asterisks
      if (value && value.includes("*")) {
        // Store original value to restore on blur
        this.$set(this.originalValues, field, this.form.configJson[field]);
        this.$set(this.form.configJson, field, "");
      }
    },

    // Handle input blur event
    handleInputBlur(field) {
      // Check if sensitive field
      if (this.isSensitiveField(field)) {
        // Restore masked value if value is empty
        if (!this.form.configJson[field] || this.form.configJson[field].trim() === "") {
          // Restore original value if exists, otherwise set mask hint
          if (this.originalValues[field]) {
            this.$set(this.form.configJson, field, this.originalValues[field]);
          } else {
            const sensitiveName = this.getSensitiveFieldName(field);
            this.$set(this.form.configJson, field, `Your ${sensitiveName}`);
          }
          // Clear temporarily stored original value
          this.$delete(this.originalValues, field);
        }
      }
    },

    // Handle JSON field focus event
    handleJsonInputFocus(field, value) {
      if (value && value.includes("*")) {
        this.$set(this.fieldJsonMap, field, "");
      }
    },

    // Handle JSON field blur event
    handleJsonInputBlur(field) {
      // JSON fields do not need special handling
    },
  },
};
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
