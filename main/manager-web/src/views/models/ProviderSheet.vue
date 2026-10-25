<template>
  <TbSheet :open="open" :title="title" size="l" :close-label="$t('common.close')" class="psheet"
    @update:open="$emit('update:open', $event)">
    <form class="psheet__form" novalidate @submit.prevent="submit">
      <div class="psheet__grid">
        <TbField :label="$t('providers.form.category')" :for-id="`${uid}-type`" required :error="errors.category">
          <TbSelect :id="`${uid}-type`" v-model="form.modelType" :options="typeOptions" :invalid="!!errors.category"
            :placeholder="$t('providers.form.categoryPh')" @change="clear('category')" />
        </TbField>
        <TbField :label="$t('providers.form.code')" :for-id="`${uid}-code`" required :error="errors.code" :hint="$t('providers.form.codeHint')">
          <TbInput :id="`${uid}-code`" v-model="form.providerCode" :invalid="!!errors.code" :placeholder="$t('providers.form.codePh')"
            @update:model-value="clear('code')" />
        </TbField>
        <TbField :label="$t('providers.form.name')" :for-id="`${uid}-name`" required :error="errors.name">
          <TbInput :id="`${uid}-name`" v-model="form.name" :invalid="!!errors.name" :placeholder="$t('providers.form.namePh')"
            @update:model-value="clear('name')" />
        </TbField>
        <TbField :label="$t('providers.form.sort')" :for-id="`${uid}-sort`">
          <TbInput :id="`${uid}-sort`" :model-value="form.sort" type="number" inputmode="numeric" number
            @update:model-value="setSort" />
        </TbField>
      </div>

      <section class="psheet__fields" :aria-labelledby="`${uid}-fields`">
        <header class="psheet__fhead">
          <h3 :id="`${uid}-fields`">{{ $t('providers.form.fields') }} <span class="psheet__n tb-num">{{ num(form.fields.length) }}</span></h3>
          <div class="psheet__facts">
            <TbButton size="s" variant="quiet" :disabled="!form.fields.length" @click="toggleSelectAllFields">
              {{ isAllFieldsSelected ? $t('models.deselectAll') : $t('models.selectAll') }}
            </TbButton>
            <TbButton size="s" variant="danger" icon="trash" :disabled="!selectedFieldCount" @click="batchRemoveFields">
              {{ selectedFieldCount ? $t('providers.form.deleteSelected', { count: num(selectedFieldCount) }) : $t('common.delete') }}
            </TbButton>
            <TbButton size="s" icon="plus" :disabled="hasIncompleteFields" @click="addField">{{ $t('providers.form.addField') }}</TbButton>
          </div>
        </header>
        <p class="psheet__note">{{ $t('providers.form.fieldsNote') }}</p>

        <TbTable :columns="fieldColumns" :rows="form.fields" row-key="_k" dense :row-class="(r) => (r.editing ? 'is-editing' : null)"
          :caption="$t('providers.form.fields')">
          <template #cell-sel="{ row }">
            <TbCheckbox v-model="row.selected" :aria-label="$t('providers.form.selectField', { key: row.key || '' })" @change="updateSelectAllStatus" />
          </template>
          <template #cell-key="{ row }">
            <TbInput v-if="row.editing" v-model="row.key" size="s" :aria-label="$t('providers.form.key')" :placeholder="$t('providers.form.keyPh')" />
            <span v-else class="psheet__key">
              <code>{{ row.key }}</code>
              <TbIcon v-if="looksSensitive(row.key)" name="lock" :size="14" :label="$t('providers.secret')" />
            </span>
          </template>
          <template #cell-label="{ row }">
            <TbInput v-if="row.editing" v-model="row.label" size="s" :aria-label="$t('providers.form.label')" :placeholder="$t('providers.form.labelPh')" />
            <span v-else>{{ row.label }}</span>
          </template>
          <template #cell-type="{ row }">
            <TbSelect v-if="row.editing" v-model="row.type" size="s" :options="fieldTypeOptions" :aria-label="$t('providers.form.type')" />
            <TbTag v-else>{{ typeLabel(row.type) }}</TbTag>
          </template>
          <template #cell-default="{ row }">
            <TbInput v-if="row.editing" v-model="row.default" size="s" :aria-label="$t('providers.form.default')" :placeholder="$t('providers.form.defaultPh')" />
            <span v-else class="psheet__default">{{ row.default }}</span>
          </template>
          <template #cell-actions="{ row, index }">
            <div class="psheet__rowacts">
              <TbButton v-if="!row.editing" size="s" variant="quiet" icon="edit" :aria-label="$t('providers.form.editField', { key: row.key })"
                :title="$t('common.edit')" @click="startEditing(row)" />
              <TbButton v-else size="s" variant="secondary" icon="check" :disabled="!row.key || !row.label || !row.type" @click="stopEditing(row)">
                {{ $t('providers.form.done') }}
              </TbButton>
              <TbButton size="s" variant="quiet" icon="trash" class="is-danger" :aria-label="$t('providers.form.deleteField', { key: row.key })"
                :title="$t('common.delete')" @click="removeField(index)" />
            </div>
          </template>
          <template #empty>
            <TbEmpty :title="$t('providers.form.noFields')" :text="$t('providers.form.noFieldsText')">
              <TbButton size="s" icon="plus" @click="addField">{{ $t('providers.form.addField') }}</TbButton>
            </TbEmpty>
          </template>
        </TbTable>
      </section>
      <button type="submit" hidden></button>
    </form>

    <template #footer>
      <TbButton variant="secondary" @click="$emit('update:open', false)">{{ $t('common.cancel') }}</TbButton>
      <TbButton variant="primary" :loading="saving" @click="submit">{{ form.id ? $t('common.save') : $t('providers.add') }}</TbButton>
    </template>
  </TbSheet>
</template>

<script>
import { digits } from '@/kit/calendar';
import { FIELD_TYPES, cleanFields, incompleteField, looksSensitive, parseFields, providerProblem } from './modelForm';

let seq = 0;
const blank = () => ({ id: null, modelType: '', providerCode: '', name: '', fields: [], sort: 0 });

// Add or edit one provider: its category, code, name, order, and the schema of fields a model of
// this provider asks for (key, label, type, default). Emits `submit` ({ form, done }).
export default {
  name: 'ProviderSheet',
  props: {
    open: Boolean,
    title: { type: String, default: '' },
    provider: { type: Object, default: null },
    modelTypes: { type: Array, default: () => [] }, // [{ value, label }]
  },
  emits: ['update:open', 'submit'],
  data() {
    return { uid: `psheet-${++seq}`, form: blank(), errors: {}, saving: false, isAllFieldsSelected: false, timer: null };
  },
  computed: {
    typeOptions() { return this.modelTypes; },
    fieldTypeOptions() { return FIELD_TYPES.map((t) => ({ value: t, label: this.typeLabel(t) })); },
    fieldColumns() {
      return [
        { key: 'sel', label: this.$t('models.select'), width: '44px' },
        { key: 'key', label: this.$t('providers.form.key') },
        { key: 'label', label: this.$t('providers.form.label') },
        { key: 'type', label: this.$t('providers.form.type'), width: '150px' },
        { key: 'default', label: this.$t('providers.form.default') },
        { key: 'actions', label: this.$t('models.actions'), align: 'right', width: '150px' },
      ];
    },
    hasIncompleteFields() { return incompleteField(this.form.fields); },
    selectedFieldCount() { return this.form.fields.filter((f) => f.selected).length; },
  },
  watch: {
    open: {
      handler(v) { if (v) this.start(); },
      immediate: true,
    },
  },
  beforeUnmount() { clearTimeout(this.timer); },
  methods: {
    looksSensitive,
    num(n) { return digits(n, this.$i18n?.locale); },
    start() {
      const p = this.provider || blank();
      this.form = {
        ...blank(),
        ...p,
        sort: Number(p.sort) || 0,
        fields: parseFields(p.fields).map((f) => ({ ...f, _k: `f-${++seq}`, selected: false, editing: false })),
      };
      this.errors = {};
      this.saving = false;
      this.isAllFieldsSelected = false;
    },
    clear(k) { if (this.errors[k]) { const e = { ...this.errors }; delete e[k]; this.errors = e; } },
    setSort(v) { this.form.sort = v === '' ? 0 : Math.max(0, Math.floor(Number(v)) || 0); },
    typeLabel(t) {
      return FIELD_TYPES.includes(t) || t === 'RAG' ? this.$t(`providers.fieldType.${t}`) : t;
    },
    startEditing(row) { row.editing = true; },
    // A finished field moves to the end of the list (legacy order: fields are appended).
    stopEditing(row) {
      row.editing = false;
      const i = this.form.fields.indexOf(row);
      if (i > -1) {
        this.form.fields.splice(i, 1);
        this.form.fields.push(row);
      }
    },
    updateSelectAllStatus() {
      this.isAllFieldsSelected = this.form.fields.length > 0 && this.form.fields.every((f) => f.selected);
    },
    toggleSelectAllFields() {
      this.isAllFieldsSelected = !this.isAllFieldsSelected;
      this.form.fields.forEach((f) => { f.selected = this.isAllFieldsSelected; });
    },
    addField() {
      if (this.hasIncompleteFields) {
        this.$message.warning(this.$t('providers.form.finishField'));
        return;
      }
      this.form.fields.unshift({ _k: `f-${++seq}`, key: '', label: '', type: 'string', default: '', selected: false, editing: true });
    },
    removeField(index) {
      const f = this.form.fields[index];
      const blankRow = f && !f.key && !f.label && !f.default;
      const drop = () => {
        this.form.fields = this.form.fields.filter((_, i) => i !== index);
        this.updateSelectAllStatus();
      };
      if (blankRow) { drop(); return; }
      this.$confirm(this.$t('providers.form.confirmDeleteField', { key: f?.key || '' }), this.$t('providers.form.deleteFieldTitle'), {
        confirmText: this.$t('common.delete'), cancelText: this.$t('common.cancel'), danger: true,
      }).then(drop).catch(() => {});
    },
    batchRemoveFields() {
      const picked = this.form.fields.filter((f) => f.selected);
      if (!picked.length) {
        this.$message.warning(this.$t('providers.form.selectFieldsFirst'));
        return;
      }
      this.$confirm(this.$t('providers.form.confirmDeleteFields', { count: this.num(picked.length) }), this.$t('providers.form.deleteFieldTitle'), {
        confirmText: this.$t('common.delete'), cancelText: this.$t('common.cancel'), danger: true,
      }).then(() => {
        this.form.fields = this.form.fields.filter((f) => !f.selected);
        this.isAllFieldsSelected = false;
        this.$message.success(this.$t('providers.form.fieldsDeleted', { count: this.num(picked.length) }));
      }).catch(() => {});
    },
    submit() {
      const problem = providerProblem(this.form);
      const errors = {};
      if (!this.form.modelType) errors.category = this.$t('providers.form.categoryRequired');
      if (!String(this.form.providerCode || '').trim()) errors.code = this.$t('providers.form.codeRequired');
      if (!String(this.form.name || '').trim()) errors.name = this.$t('providers.form.nameRequired');
      this.errors = errors;
      if (problem) return;
      if (this.form.fields.some((f) => f.editing)) {
        this.$message.warning(this.$t('providers.form.finishField'));
        return;
      }
      this.saving = true;
      const fields = cleanFields(this.form.fields).map(({ _k, ...rest }) => { void _k; return rest; });
      this.$emit('submit', {
        form: { id: this.form.id, modelType: this.form.modelType, providerCode: this.form.providerCode, name: this.form.name, sort: this.form.sort, fields },
        done: () => { this.saving = false; },
      });
      clearTimeout(this.timer);
      this.timer = setTimeout(() => { this.saving = false; }, 3000);
    },
  },
};
</script>

<style>
.psheet__form { display: grid; gap: var(--tb-s6); }
.psheet__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--tb-s4); }
.psheet__fields { display: grid; gap: var(--tb-s2); }
.psheet__fhead { display: flex; align-items: center; justify-content: space-between; gap: var(--tb-s3); flex-wrap: wrap; }
.psheet__fhead h3 { font-size: var(--tb-fs-16); display: inline-flex; align-items: center; gap: 8px; }
.psheet__n { font: 600 var(--tb-fs-12)/18px var(--tb-font-text); border: 1px solid currentColor; border-radius: 999px; padding: 0 6px; color: var(--tb-ink-2); }
.psheet__facts { display: flex; gap: 6px; flex-wrap: wrap; }
.psheet__note { color: var(--tb-ink-2); font-size: var(--tb-fs-13); }
.psheet__key { display: inline-flex; align-items: center; gap: 6px; color: var(--tb-ink); }
.psheet__key code { font-family: ui-monospace, "Cascadia Mono", Consolas, monospace; font-size: var(--tb-fs-13); overflow-wrap: anywhere; }
.psheet__key .tb-icon { color: var(--tb-warn); flex: none; }
.psheet__default { color: var(--tb-ink-2); overflow-wrap: anywhere; }
.psheet__rowacts { display: inline-flex; gap: 2px; justify-content: flex-end; flex-wrap: wrap; }
.psheet__rowacts .is-danger { color: var(--tb-danger); }
.psheet .tb-table tr.is-editing { background: var(--tb-paper-2); }
.psheet .tb-table td .tb-input, .psheet .tb-table td .tb-select { min-width: 110px; }
@media (max-width: 640px) {
  .tb-sheet .tb-table td > .tb-tag { justify-self: start; }
  .psheet__grid { grid-template-columns: minmax(0, 1fr); }
  .psheet__rowacts { justify-content: flex-start; }
}
</style>
