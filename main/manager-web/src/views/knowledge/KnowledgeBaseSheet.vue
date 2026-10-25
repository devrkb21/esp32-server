<template>
  <TbSheet :open="open" :title="form.id ? $t('kb.form.editTitle') : $t('kb.form.addTitle')" :close-label="$t('common.close')"
    @update:open="$emit('update:open', $event)">
    <form id="kb-form" class="kb-form" novalidate @submit.prevent="submit">
      <TbField :label="$t('kb.form.name')" :hint="$t('kb.form.nameHint')" :error="err('name')" required for-id="kb-f-name">
        <TbInput id="kb-f-name" v-model="form.name" :placeholder="$t('kb.form.namePh')" :maxlength="50" clearable
          :invalid="!!err('name')" :clear-label="$t('kb.clear')" @blur="touch('name')" />
      </TbField>
      <TbField :label="$t('kb.form.desc')" :hint="$t('kb.form.descHint')" :error="err('description')" required for-id="kb-f-desc">
        <TbTextarea id="kb-f-desc" v-model="form.description" :placeholder="$t('kb.form.descPh')" :rows="3" autosize
          :maxlength="300" show-count :invalid="!!err('description')" @blur="touch('description')" />
      </TbField>
      <TbField :label="$t('kb.form.rag')" :error="err('ragModelId')" :hint="ragHint" required for-id="kb-f-rag">
        <TbSelect id="kb-f-rag" v-model="form.ragModelId" :options="ragOptions" :placeholder="$t('kb.form.ragPh')"
          :invalid="!!err('ragModelId')" :disabled="ragLoading && !ragModels.length" @focusin="loadRagModels"
          @change="touch('ragModelId')" />
      </TbField>
    </form>
    <template #footer>
      <TbButton @click="$emit('update:open', false)">{{ $t('common.cancel') }}</TbButton>
      <TbButton variant="primary" native-type="submit" form="kb-form" :loading="saving">
        {{ form.id ? $t('common.save') : $t('kb.form.create') }}
      </TbButton>
    </template>
  </TbSheet>
</template>

<script>
import Api from '@/apis/api';
import { validateKb } from './kbModel';

// Create or edit one knowledge base (the legacy KnowledgeBaseDialog): name, description, RAG model.
// The parent owns the API call; this sheet validates and emits `submit` with a copy of the form.
export default {
  name: 'KnowledgeBaseSheet',
  props: {
    open: Boolean,
    value: { type: Object, default: null },
    saving: Boolean,
  },
  emits: ['update:open', 'submit'],
  data() {
    return {
      form: this.blank(),
      ragModels: [],
      ragLoading: false,
      ragFailed: false,
      touched: {},
      tried: false,
    };
  },
  computed: {
    errors() { return validateKb(this.form); },
    ragOptions() { return this.ragModels.map((m) => ({ value: m.id, label: m.modelName })); },
    ragHint() {
      if (this.ragLoading && !this.ragModels.length) return this.$t('kb.form.ragLoading');
      if (this.ragFailed) return this.$t('kb.form.ragLoadFailed');
      if (!this.ragModels.length) return this.$t('kb.form.ragNone');
      return '';
    },
  },
  watch: {
    open: {
      immediate: true,
      handler(v) {
        if (!v) return;
        this.form = { ...this.blank(), ...(this.value || {}) };
        this.touched = {};
        this.tried = false;
        this.loadRagModels();
        this.pickDefault();
      },
    },
  },
  methods: {
    blank() { return { id: null, datasetId: null, ragModelId: null, name: '', description: '', status: 1 }; },
    err(field) {
      const key = this.errors[field];
      return key && (this.tried || this.touched[field]) ? this.$t(key) : '';
    },
    touch(field) { this.touched = { ...this.touched, [field]: true }; },
    // A new knowledge base starts on the first RAG model (legacy rule).
    pickDefault() {
      if (!this.form.id && !this.form.ragModelId && this.ragModels.length > 0) this.form.ragModelId = this.ragModels[0].id;
    },
    loadRagModels() {
      if (this.ragModels.length > 0 || this.ragLoading) return;
      this.ragLoading = true;
      this.ragFailed = false;
      Api.model.getRAGModels((res) => {
        this.ragLoading = false;
        if (res && res.data && res.data.code === 0) {
          this.ragModels = res.data.data || [];
          this.pickDefault();
        } else {
          this.ragFailed = true;
          this.$message.error(this.$t('kb.form.ragLoadFailed'));
        }
      });
    },
    submit() {
      this.tried = true;
      if (Object.keys(this.errors).length) return;
      this.$emit('submit', { ...this.form });
    },
  },
};
</script>

<style>
.kb-form { display: grid; gap: var(--tb-s5); }
</style>
