<template>
  <span class="inl" :class="[`inl--${size}`, { 'is-editing': editing }]">
    <template v-if="editing">
      <TbInput ref="input" v-model="draft" size="s" :maxlength="maxlength" :aria-label="label" :disabled="disabled"
        @enter="commit" @blur="onBlur" @keydown.esc.stop.prevent="cancel" />
      <TbButton ref="cancelBtn" size="s" variant="quiet" icon="close" class="inl__cancel" :aria-label="cancelLabel"
        @mousedown.prevent @click="cancel" />
    </template>
    <template v-else>
      <button type="button" class="inl__text" :disabled="disabled" :title="value || null" @click="start">
        <slot>{{ value || '–' }}</slot>
      </button>
      <TbButton size="s" variant="quiet" icon="edit" class="inl__edit" :disabled="disabled" :aria-label="editLabel" @click="start" />
    </template>
  </span>
</template>

<script>
// A name that edits in place: click, type, Enter or leaving the field saves, Escape cancels.
// Emits `save` with the trimmed new text only when it is not empty and differs (legacy rule).
export default {
  name: 'InlineName',
  props: {
    value: { type: String, default: '' },
    label: { type: String, default: '' },
    editLabel: { type: String, default: 'Edit' },
    cancelLabel: { type: String, default: 'Cancel' },
    maxlength: { type: [Number, String], default: null },
    size: { type: String, default: 'm' }, // m | l
    disabled: Boolean,
  },
  emits: ['save'],
  data() { return { editing: false, draft: '' }; },
  methods: {
    start() {
      if (this.disabled) return;
      this.draft = this.value;
      this.editing = true;
      this.$nextTick(() => { this.$refs.input?.focus(); this.$refs.input?.select(); });
    },
    commit() {
      if (!this.editing) return;
      const text = String(this.draft || '').trim();
      this.editing = false;
      if (text && text !== this.value) this.$emit('save', text);
    },
    onBlur() { this.commit(); },
    cancel() { this.editing = false; },
  },
};
</script>

<style>
.inl { display: inline-flex; align-items: center; gap: 2px; min-width: 0; max-width: 100%; }
.inl.is-editing { width: min(100%, 340px); }
.inl.is-editing .tb-input { flex: 1; min-width: 0; }
.inl__text {
  min-width: 0; padding: 0; border: 0; background: none; text-align: left; cursor: text;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600;
  text-decoration: underline transparent; text-underline-offset: 4px;
  transition: text-decoration-color var(--tb-t-hover) var(--tb-ease);
}
@media (hover: hover) and (pointer: fine) { .inl__text:hover:not(:disabled) { text-decoration-color: var(--tb-rule-soft); } }
.inl--l .inl__text { font: 800 clamp(var(--tb-fs-20), 3vw, var(--tb-fs-24))/1.2 var(--tb-font-display); }
.inl__edit, .inl__cancel { flex: none; color: var(--tb-ink-2); }
@media (max-width: 640px) {
  .inl__edit, .inl__cancel { --h: var(--tb-target); }
}
</style>
