<template>
  <TbSheet :open="open" :title="title" size="l" :close-label="$t('common.close')" class="msheet"
    @update:open="$emit('update:open', $event)">
    <div v-if="loadingModel" class="msheet__wait"><TbLoading :label="$t('common.loading')" show-label /></div>

    <form v-else class="msheet__form" novalidate @submit.prevent="submit">
      <section class="msheet__part" :aria-labelledby="`${uid}-info`">
        <header class="msheet__parthead">
          <h3 :id="`${uid}-info`">{{ $t('models.form.info') }}</h3>
          <TbSwitch v-model="enabled" :label="$t('models.form.enabled')" />
        </header>
        <div class="msheet__grid">
          <TbField :label="$t('models.form.name')" :for-id="`${uid}-name`">
            <TbInput :id="`${uid}-name`" v-model="form.modelName" :placeholder="$t('models.form.namePh')" />
          </TbField>
          <TbField :label="$t('models.form.provider')" :for-id="`${uid}-prov`" :required="mode === 'add'"
            :error="errors.supplier" :hint="providersEmpty ? $t('models.form.noProviders') : ''">
            <TbSelect :id="`${uid}-prov`" v-model="form.supplier" :options="providerSelect" :invalid="!!errors.supplier"
              :placeholder="providersLoading ? $t('common.loading') : $t('models.form.providerPh')" :disabled="providersLoading" />
          </TbField>
          <TbField :label="$t('models.form.code')" :for-id="`${uid}-code`" :class="{ 'is-wide': mode !== 'add' }">
            <TbInput :id="`${uid}-code`" v-model="form.modelCode" :placeholder="$t('models.form.codePh')" />
          </TbField>
          <TbField v-if="mode === 'add'" :label="$t('models.form.id')" :for-id="`${uid}-id`" :error="errors.id"
            :hint="$t('models.form.idHint')">
            <TbInput :id="`${uid}-id`" v-model="form.id" :maxlength="32" :invalid="!!errors.id" :placeholder="$t('models.form.idPh')" />
          </TbField>
          <TbField :label="$t('models.form.remark')" :for-id="`${uid}-remark`" class="is-wide">
            <TbTextarea :id="`${uid}-remark`" v-model="form.remark" :rows="2" autosize :placeholder="$t('models.form.remarkPh')" />
          </TbField>
        </div>
      </section>

      <section v-if="basicFields.length" class="msheet__part" :aria-labelledby="`${uid}-call`">
        <header class="msheet__parthead">
          <h3 :id="`${uid}-call`">{{ $t('models.form.connection') }}</h3>
          <span class="msheet__note">{{ $t('models.form.connectionNote', { provider: providerLabel }) }}</span>
        </header>
        <div class="msheet__grid">
          <TbField v-for="f in basicFields" :key="f.prop" :label="f.label || f.prop" :for-id="`${uid}-f-${f.prop}`"
            :hint="secretField(f) ? $t('models.form.secretHint') : ''">
            <TbInput :id="`${uid}-f-${f.prop}`" :model-value="form.configJson[f.prop]" :type="secretField(f) ? 'password' : 'text'"
              :autocomplete="secretField(f) ? 'new-password' : 'off'" :placeholder="$t('models.form.enterField', { key: f.prop })"
              :class="{ 'msheet__secret': secretField(f) }" :show-label="$t('models.form.reveal')" :hide-label="$t('models.form.conceal')"
              @update:model-value="setConfig(f.prop, $event)" @focus="onSecretFocus(f.prop)" @blur="onSecretBlur(f.prop)" />
          </TbField>
        </div>
      </section>

      <section class="msheet__part">
        <button type="button" class="msheet__disclose" :aria-expanded="showAdvanced ? 'true' : 'false'"
          :aria-controls="`${uid}-adv`" @click="showAdvanced = !showAdvanced">
          <TbIcon :name="showAdvanced ? 'chevron-down' : 'chevron-right'" :size="18" />
          <span class="msheet__disclose-title">{{ $t('models.form.advanced') }}</span>
          <span class="msheet__note">{{ $t('models.form.advancedHint') }}</span>
        </button>
        <div v-show="showAdvanced" :id="`${uid}-adv`" class="msheet__grid msheet__adv">
          <TbField v-for="f in jsonFields" :key="f.prop" :label="f.label || f.prop" :for-id="`${uid}-j-${f.prop}`"
            :hint="$t('models.form.jsonHint')" :error="errors[`json:${f.prop}`]" class="is-wide">
            <TbTextarea v-if="mode === 'add'" :id="`${uid}-j-${f.prop}`" class="msheet__code" :rows="3" autosize
              :model-value="jsonText(form.configJson[f.prop])" :invalid="!!errors[`json:${f.prop}`]"
              placeholder='{"key": "value"}' @update:model-value="setConfig(f.prop, $event)" />
            <TbTextarea v-else :id="`${uid}-j-${f.prop}`" class="msheet__code" :rows="3" autosize
              :model-value="fieldJsonMap[f.prop] || ''" :invalid="!!errors[`json:${f.prop}`]" placeholder='{"key": "value"}'
              @update:model-value="setJsonText(f.prop, $event)" @blur="onJsonBlur(f.prop)" />
          </TbField>
          <TbField :label="$t('models.form.sort')" :for-id="`${uid}-sort`">
            <TbInput :id="`${uid}-sort`" v-model="form.sort" type="number" inputmode="numeric" number :placeholder="$t('models.form.sortPh')" />
          </TbField>
          <TbField :label="$t('models.form.docLink')" :for-id="`${uid}-doc`">
            <TbInput :id="`${uid}-doc`" v-model="form.docLink" type="url" :placeholder="$t('models.form.docLinkPh')" />
          </TbField>
        </div>
      </section>
      <button type="submit" hidden></button>
    </form>

    <template #footer>
      <TbButton variant="secondary" @click="$emit('update:open', false)">{{ $t('common.cancel') }}</TbButton>
      <TbButton variant="primary" :loading="saving" :disabled="loadingModel" @click="submit">
        {{ mode === 'add' ? $t('models.add') : $t('common.save') }}
      </TbButton>
    </template>
  </TbSheet>
</template>

<script>
import Api from '@/apis/api';
import {
  addPayload, duplicateOf, emptyAddForm, formatJson, isSensitiveField, openModelConfig, parseDict,
  parseDictFields, providerOptions, secretPlaceholder, validModelId,
} from './modelForm';

let seq = 0;

// Add, edit or duplicate one model. The connection fields come from the chosen provider's field
// schema. Add emits `confirm` with the new model; edit and duplicate emit `save`
// ({ provideCode, formData, done }), and the page makes the call (as the legacy dialogs did).
export default {
  name: 'ModelSheet',
  props: {
    open: Boolean,
    mode: { type: String, default: 'add' }, // add | edit | duplicate
    modelType: { type: String, required: true },
    model: { type: Object, default: () => ({}) },
  },
  emits: ['update:open', 'confirm', 'save'],
  data() {
    return {
      uid: `msheet-${++seq}`,
      providers: [],
      providersRaw: null,
      providersLoading: false,
      providersEmpty: false,
      fields: [],
      form: emptyAddForm(),
      fieldJsonMap: {},
      originalValues: {},
      errors: {},
      showAdvanced: false,
      saving: false,
      loadingModel: false,
      pendingModel: null,
      saveTimer: null,
    };
  },
  computed: {
    title() {
      if (this.mode === 'duplicate') return this.$t('models.sheet.duplicate');
      if (this.mode === 'edit') return this.$t('models.sheet.edit');
      return this.$t('models.sheet.add', { type: this.$t(`models.type.${this.modelType}`) });
    },
    basicFields() { return this.fields.filter((f) => f.type !== 'json-textarea'); },
    jsonFields() { return this.fields.filter((f) => f.type === 'json-textarea'); },
    providerSelect() { return this.providers.map((p) => ({ value: p.value, label: p.label })); },
    providerLabel() {
      const p = this.providers.find((x) => x.value === this.form.supplier);
      return p ? p.label : this.form.supplier;
    },
    enabled: {
      get() { return Boolean(this.form.isEnabled); },
      set(v) { this.form.isEnabled = this.mode === 'add' ? v : (v ? 1 : 0); },
    },
  },
  watch: {
    open: {
      handler(v) { if (v) this.start(); },
      immediate: true,
    },
    'form.supplier'(code) {
      if (code) delete this.errors.supplier;
      if (!this.providersRaw) return;
      const p = this.providers.find((x) => x.value === code);
      if (this.mode === 'add') {
        this.fields = p ? p.fields : [];
        const next = {};
        for (const f of this.fields) next[f.prop] = this.form.configJson[f.prop] || '';
        this.form.configJson = next;
      } else if (p) {
        this.fields = p.fields;
      }
    },
  },
  beforeUnmount() { clearTimeout(this.saveTimer); },
  methods: {
    start() {
      this.resetForm();
      this.fields = [];
      this.providers = [];
      this.providersRaw = null;
      this.pendingModel = null;
      this.loadProviders();
      if (this.mode !== 'add' && this.model && this.model.id) this.loadModel();
    },
    resetForm() {
      this.form = emptyAddForm();
      if (this.mode !== 'add') Object.assign(this.form, { sort: 0, isEnabled: 0, isDefault: 0 });
      this.fieldJsonMap = {};
      this.originalValues = {};
      this.errors = {};
      this.showAdvanced = false;
      this.saving = false;
    },
    loadProviders() {
      this.providersLoading = true;
      this.providersEmpty = false;
      Api.model.getModelProviders(this.modelType, (list) => {
        this.providersLoading = false;
        this.providersRaw = list || [];
        this.providers = providerOptions(this.providersRaw);
        this.providersEmpty = this.providers.length === 0;
        if (this.pendingModel) this.applyModel(this.pendingModel);
        else if (this.form.supplier) this.fields = this.providers.find((p) => p.value === this.form.supplier)?.fields || [];
      });
    },
    loadModel() {
      this.loadingModel = true;
      Api.model.getModelConfig(this.model.id, ({ data }) => {
        this.loadingModel = false;
        if (data.code !== 0 || !data.data) {
          this.$message.error(data.msg || this.$t('models.loadModelFailed'));
          return;
        }
        let m = { ...data.data, configJson: { ...(data.data.configJson || {}) } };
        if (this.mode === 'duplicate') m = duplicateOf(m, this.model, this.$t('models.form.copySuffix'));
        if (this.providersRaw) this.applyModel(m);
        else this.pendingModel = m;
      });
    },
    applyModel(m) {
      this.pendingModel = null;
      const p = this.providers.find((x) => x.value === String(m.configJson?.type));
      this.fields = p ? p.fields : [];
      this.processModelData(m);
    },
    // A stored model laid onto the current provider fields (the legacy name, kept for its tests).
    processModelData(model) {
      const { configJson, fieldJsonMap } = openModelConfig(model, this.fields);
      this.fieldJsonMap = fieldJsonMap;
      this.form = {
        id: model.id,
        modelType: model.modelType,
        modelCode: model.modelCode,
        modelName: model.modelName,
        supplier: configJson.type ? String(configJson.type) : '',
        isDefault: model.isDefault,
        isEnabled: model.isEnabled,
        docLink: model.docLink,
        remark: model.remark,
        sort: Number(model.sort) || 0,
        configJson,
      };
    },
    secretField(f) { return f.type === 'password' || isSensitiveField(f.prop); },
    setConfig(prop, v) { this.form.configJson = { ...this.form.configJson, [prop]: v }; delete this.errors[`json:${prop}`]; },
    setJsonText(prop, v) { this.fieldJsonMap = { ...this.fieldJsonMap, [prop]: v }; delete this.errors[`json:${prop}`]; },
    jsonText(v) { return v && typeof v === 'object' ? formatJson(v) : (v || ''); },

    // Stored secrets come back masked (with *). Focus clears the mask to type a new one; leaving
    // the field empty puts the stored value (or the placeholder the server knows) back.
    onSecretFocus(prop) {
      if (this.mode === 'add' || !isSensitiveField(prop)) return;
      const v = this.form.configJson[prop];
      if (typeof v === 'string' && v.includes('*')) {
        this.originalValues = { ...this.originalValues, [prop]: v };
        this.setConfig(prop, '');
      }
    },
    onSecretBlur(prop) {
      if (this.mode === 'add' || !isSensitiveField(prop)) return;
      const v = this.form.configJson[prop];
      if (!v || String(v).trim() === '') {
        this.setConfig(prop, this.originalValues[prop] || secretPlaceholder(prop));
        const rest = { ...this.originalValues };
        delete rest[prop];
        this.originalValues = rest;
      }
    },
    onJsonBlur(prop) {
      const v = this.fieldJsonMap[prop];
      if (!v || !v.trim()) return;
      const r = parseDict(v);
      if (r.error) this.errors = { ...this.errors, [`json:${prop}`]: this.$t(`models.form.json.${r.error}`) };
    },
    // Edit: a dictionary that does not parse keeps the stored data (legacy rule) and says so.
    validateJson(value) {
      const r = parseDict(value);
      if (!r.error) return r.value;
      this.showAdvanced = true;
      this.$message.error(this.$t(`models.form.json.${r.error}Kept`));
      return null;
    },

    submit() {
      if (this.mode === 'add') this.confirm();
      else this.handleSave();
    },
    // Add (legacy AddModelDialog.confirm).
    confirm() {
      const errors = {};
      if (this.form.id && !validModelId(this.form.id)) errors.id = this.$t('models.form.idInvalid');
      if (!this.form.supplier) errors.supplier = this.$t('models.form.providerRequired');
      this.errors = errors;
      if (Object.keys(errors).length) return;
      const parsed = parseDictFields(this.fields, this.form.configJson);
      if (parsed.error) {
        this.showAdvanced = true;
        this.errors = { [`json:${parsed.field}`]: this.$t(`models.form.json.${parsed.error}`) };
        this.$message.error(this.$t('models.form.json.blocked'));
        return;
      }
      this.form.configJson = parsed.configJson;
      this.$emit('confirm', addPayload(this.form, parsed.configJson));
      this.$emit('update:open', false);
    },
    // Edit and duplicate (legacy ModelEditDialog.handleSave).
    handleSave() {
      const configJson = { ...this.form.configJson };
      for (const key of Object.keys(this.fieldJsonMap)) {
        const parsed = this.validateJson(this.fieldJsonMap[key]);
        if (parsed !== null) configJson[key] = parsed;
      }
      if (this.form.supplier) configJson.type = this.form.supplier;
      this.form.configJson = configJson;
      this.saving = true;
      const formData = {
        id: this.model.id,
        modelCode: this.form.modelCode,
        modelName: this.form.modelName,
        isDefault: this.form.isDefault ? 1 : 0,
        isEnabled: this.form.isEnabled ? 1 : 0,
        docLink: this.form.docLink,
        remark: this.form.remark,
        sort: this.form.sort || 0,
        configJson: { ...configJson },
      };
      this.$emit('save', { provideCode: configJson.type, formData, done: () => { this.saving = false; } });
      clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => { this.saving = false; }, 3000);
    },
  },
};
</script>

<style>
.msheet__wait { display: grid; place-items: center; min-height: 240px; }
.msheet__form { display: grid; gap: var(--tb-s6); }
.msheet__part { display: grid; gap: var(--tb-s3); }
.msheet__parthead {
  display: flex; align-items: center; justify-content: space-between; gap: var(--tb-s3); flex-wrap: wrap;
  padding-bottom: var(--tb-s2); border-bottom: 1px solid var(--tb-rule);
}
.msheet__parthead h3 { font-size: var(--tb-fs-16); }
.msheet__note { color: var(--tb-ink-2); font-size: var(--tb-fs-13); }
.msheet__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--tb-s4); }
.msheet__grid .is-wide { grid-column: 1 / -1; }
.msheet__adv { padding-top: var(--tb-s2); }
.msheet__disclose {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap; width: 100%; min-height: var(--tb-target); padding: 0;
  border: 0; border-bottom: 1px solid var(--tb-rule); background: none; text-align: left; color: var(--tb-ink);
}
.msheet__disclose-title { font: 700 var(--tb-fs-16)/1.2 var(--tb-font-display); }
.msheet__disclose .msheet__note { flex: 1 1 200px; }
.msheet__code textarea { font-family: ui-monospace, "Cascadia Mono", Consolas, monospace; font-size: var(--tb-fs-14); }
.msheet__secret .tb-input__el { letter-spacing: .02em; }
@media (max-width: 640px) {
  .msheet__grid { grid-template-columns: minmax(0, 1fr); }
}
</style>
