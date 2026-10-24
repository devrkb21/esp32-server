<template>
  <div class="tb-field" :class="{ 'has-error': !!error, 'is-inline': inline }">
    <label v-if="label" class="tb-field__label" :for="forId || null">
      {{ label }}<span v-if="required" class="tb-field__req" aria-hidden="true">*</span>
    </label>
    <div class="tb-field__control"><slot /></div>
    <p v-if="error" class="tb-field__error" role="alert">{{ error }}</p>
    <p v-else-if="hint" class="tb-field__hint">{{ hint }}</p>
  </div>
</template>

<script setup>
defineProps({
  label: { type: String, default: '' },
  hint: { type: String, default: '' },
  error: { type: String, default: '' },
  required: Boolean,
  inline: Boolean,
  forId: { type: String, default: '' },
});
</script>

<style>
.tb-field { display: grid; gap: 6px; }
.tb-field.is-inline { grid-template-columns: minmax(140px, 220px) 1fr; align-items: center; column-gap: var(--tb-s4); }
.tb-field.is-inline .tb-field__hint, .tb-field.is-inline .tb-field__error { grid-column: 2; }
.tb-field__label { font-weight: 600; font-size: var(--tb-fs-14); color: var(--tb-ink); }
.tb-field__req { color: var(--tb-alarm); margin-left: 2px; }
.tb-field__hint { font-size: var(--tb-fs-13); color: var(--tb-ink-2); }
.tb-field__error { font-size: var(--tb-fs-13); color: var(--tb-danger); font-weight: 500; }
@media (max-width: 640px) {
  .tb-field.is-inline { grid-template-columns: 1fr; }
  .tb-field.is-inline .tb-field__hint, .tb-field.is-inline .tb-field__error { grid-column: 1; }
}
</style>
