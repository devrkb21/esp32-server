<template>
  <TbSheet :open="open" size="s" :title="title" :close-label="$t('common.close')" :close-on-scrim="false"
    @update:open="$emit('update:open', $event)">
    <form :id="formId" class="dsheet" novalidate @submit.prevent="submit">
      <template v-if="kind === 'type'">
        <TbField :label="$t('system.dict.typeName')" :error="errors.dictName" required :for-id="`${formId}-name`">
          <TbInput :id="`${formId}-name`" v-model="form.dictName" :invalid="!!errors.dictName" :maxlength="100"
            :placeholder="$t('system.dict.typeNamePlaceholder')" @blur="check('dictName')" />
        </TbField>
        <TbField :label="$t('system.dict.typeCode')" :error="errors.dictType" :hint="$t('system.dict.typeCodeHint')" required
          :for-id="`${formId}-code`">
          <TbInput :id="`${formId}-code`" v-model="form.dictType" :invalid="!!errors.dictType" :maxlength="100"
            :placeholder="$t('system.dict.typeCodePlaceholder')" @blur="check('dictType')" />
        </TbField>
      </template>
      <template v-else>
        <TbField :label="$t('system.dict.label')" :error="errors.dictLabel" required :for-id="`${formId}-label`">
          <TbInput :id="`${formId}-label`" v-model="form.dictLabel" :invalid="!!errors.dictLabel" :maxlength="100"
            :placeholder="$t('system.dict.labelPlaceholder')" @blur="check('dictLabel')" />
        </TbField>
        <TbField :label="$t('system.dict.value')" :error="errors.dictValue" required :for-id="`${formId}-value`">
          <TbInput :id="`${formId}-value`" v-model="form.dictValue" :invalid="!!errors.dictValue" :maxlength="255"
            :placeholder="$t('system.dict.valuePlaceholder')" @blur="check('dictValue')" />
        </TbField>
        <TbField :label="$t('system.dict.sort')" :hint="$t('system.dict.sortHint')" :for-id="`${formId}-sort`">
          <TbInput :id="`${formId}-sort`" v-model="form.sort" class="dsheet__sort" type="number" number inputmode="numeric"
            @blur="clampSort" />
        </TbField>
      </template>
    </form>
    <template #footer>
      <TbButton :disabled="saving" @click="$emit('update:open', false)">{{ $t('common.cancel') }}</TbButton>
      <TbButton variant="primary" icon="check" native-type="submit" :form="formId" :loading="saving">
        {{ saving ? $t('common.saving') : $t('common.save') }}</TbButton>
    </template>
  </TbSheet>
</template>

<script>
// Add or edit a dictionary type (name and code, both required) or one of its values (label and
// value required, sort 0 to 999), as the legacy DictTypeDialog.vue and DictDataDialog.vue did.
const REQUIRED = {
  type: { dictName: 'system.dict.needTypeName', dictType: 'system.dict.needTypeCode' },
  data: { dictLabel: 'system.dict.needLabel', dictValue: 'system.dict.needValue' },
};

export default {
  name: 'DictSheet',
  props: {
    open: Boolean,
    kind: { type: String, default: 'type' }, // type | data
    item: { type: Object, default: null },
    saving: Boolean,
  },
  emits: ['update:open', 'submit'],
  data() {
    return { form: {}, errors: {}, formId: `dict-sheet-${Math.random().toString(36).slice(2, 8)}` };
  },
  computed: {
    title() {
      const edit = !!(this.item && this.item.id);
      if (this.kind === 'type') return this.$t(edit ? 'system.dict.editType' : 'system.dict.addType');
      return this.$t(edit ? 'system.dict.editValue' : 'system.dict.addValue');
    },
  },
  watch: {
    open: {
      immediate: true,
      handler(v) {
        if (!v) return;
        const base = this.kind === 'type'
          ? { id: null, dictName: '', dictType: '' }
          : { id: null, dictTypeId: null, dictLabel: '', dictValue: '', sort: 0 };
        this.form = { ...base, ...(this.item || {}) };
        this.errors = {};
      },
    },
  },
  methods: {
    check(field) {
      const v = this.form[field];
      const empty = v === null || v === undefined || String(v).trim() === '';
      this.errors = { ...this.errors, [field]: empty ? this.$t(REQUIRED[this.kind][field]) : '' };
      return !empty;
    },
    clampSort() {
      const n = Math.round(Number(this.form.sort));
      this.form.sort = Number.isFinite(n) ? Math.min(999, Math.max(0, n)) : 0;
    },
    submit() {
      if (this.saving) return;
      const ok = Object.keys(REQUIRED[this.kind]).map((f) => this.check(f)).every(Boolean);
      if (!ok) return;
      if (this.kind === 'data') this.clampSort();
      this.$emit('submit', { ...this.form });
    },
  },
};
</script>

<style>
.dsheet { display: grid; gap: var(--tb-s4); }
.dsheet__sort { max-width: 160px; }
</style>
