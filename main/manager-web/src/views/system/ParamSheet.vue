<template>
  <TbSheet :open="open" size="m" :title="form.id ? $t('system.params.editTitle') : $t('system.params.addTitle')"
    :close-label="$t('common.close')" :close-on-scrim="false" @update:open="$emit('update:open', $event)">
    <form id="param-sheet-form" class="psheet" novalidate @submit.prevent="submit">
      <div class="psheet__pair">
        <TbField :label="$t('system.params.code')" :error="errors.paramCode" required for-id="param-code">
          <TbInput id="param-code" v-model="form.paramCode" :invalid="!!errors.paramCode" :maxlength="200"
            :placeholder="$t('system.params.codePlaceholder')" @blur="check('paramCode')" />
        </TbField>
        <TbField :label="$t('system.params.type')" :error="errors.valueType" required for-id="param-type">
          <TbSelect id="param-type" v-model="form.valueType" :options="typeOptions" :invalid="!!errors.valueType"
            :placeholder="$t('system.params.typePlaceholder')" @change="check('valueType')" />
        </TbField>
      </div>

      <TbField :label="$t('system.params.value')" :error="errors.paramValue" :hint="valueHint" required for-id="param-value">
        <TbTextarea v-if="multiline" id="param-value" v-model="form.paramValue" class="psheet__code" :rows="8"
          :invalid="!!errors.paramValue" :placeholder="$t('system.params.valuePlaceholder')" @blur="check('paramValue')" />
        <TbInput v-else id="param-value" v-model="form.paramValue" :invalid="!!errors.paramValue"
          :placeholder="$t('system.params.valuePlaceholder')" @blur="check('paramValue')" />
      </TbField>

      <TbField :label="$t('system.params.remark')" for-id="param-remark">
        <TbTextarea id="param-remark" v-model="form.remark" :rows="3" :placeholder="$t('system.params.remarkPlaceholder')" />
      </TbField>
    </form>
    <template #footer>
      <TbButton :disabled="saving" @click="$emit('update:open', false)">{{ $t('common.cancel') }}</TbButton>
      <TbButton variant="primary" icon="check" native-type="submit" form="param-sheet-form" :loading="saving">
        {{ saving ? $t('common.saving') : $t('common.save') }}</TbButton>
    </template>
  </TbSheet>
</template>

<script>
import { VALUE_TYPES, emptyParam, toEditValue, toSubmitValue } from './systemModel';

// Add or edit one parameter (legacy ParamDialog.vue): code, type, value and remark; code, type
// and value are required; arrays are edited one item per line and JSON pretty-printed.
export default {
  name: 'ParamSheet',
  props: {
    open: Boolean,
    param: { type: Object, default: null },
    saving: Boolean,
  },
  emits: ['update:open', 'submit'],
  data() {
    return { form: emptyParam(), errors: {} };
  },
  computed: {
    typeOptions() {
      return VALUE_TYPES.map((v) => ({ value: v, label: this.$t(`system.params.types.${v}`) }));
    },
    multiline() { return this.form.valueType === 'json' || this.form.valueType === 'array'; },
    valueHint() {
      if (this.form.valueType === 'array') return this.$t('system.params.arrayHint');
      if (this.form.valueType === 'json') return this.$t('system.params.jsonHint');
      return '';
    },
  },
  watch: {
    open: {
      immediate: true,
      handler(v) {
        if (!v) return;
        const p = { ...emptyParam(), ...(this.param || {}) };
        p.valueType = p.valueType || 'string';
        p.paramValue = toEditValue(p.paramValue, p.valueType);
        p.remark = p.remark || '';
        this.form = p;
        this.errors = {};
      },
    },
  },
  methods: {
    check(field) {
      const v = this.form[field];
      const empty = v === null || v === undefined || String(v).trim() === '';
      const msg = { paramCode: 'system.params.needCode', paramValue: 'system.params.needValue', valueType: 'system.params.needType' }[field];
      this.errors = { ...this.errors, [field]: empty ? this.$t(msg) : '' };
      return !empty;
    },
    submit() {
      if (this.saving) return;
      const ok = ['paramCode', 'valueType', 'paramValue'].map((f) => this.check(f)).every(Boolean);
      if (!ok) return;
      const out = toSubmitValue(this.form.paramValue, this.form.valueType);
      if (out.error) {
        this.errors = { ...this.errors, paramValue: this.$t('system.params.arrayError') };
        return;
      }
      this.$emit('submit', { ...this.form, paramCode: String(this.form.paramCode).trim(), paramValue: out.value });
    },
  },
};
</script>

<style>
.psheet { display: grid; gap: var(--tb-s4); }
.psheet__pair { display: grid; grid-template-columns: minmax(0, 2fr) minmax(150px, 1fr); gap: var(--tb-s4); }
.psheet__code textarea { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: var(--tb-fs-13); line-height: 1.6; }
@media (max-width: 560px) { .psheet__pair { grid-template-columns: 1fr; } }
</style>
