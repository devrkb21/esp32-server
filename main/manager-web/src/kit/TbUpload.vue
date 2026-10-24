<template>
  <label class="tb-upload" :class="{ 'is-over': over, 'is-disabled': disabled }" @dragover.prevent="over = true"
    @dragleave="over = false" @drop.prevent="onDrop">
    <input ref="el" type="file" class="tb-visually-hidden" :accept="accept || null" :multiple="multiple" :disabled="disabled" @change="onPick" />
    <TbIcon name="upload" :size="22" />
    <span class="tb-upload__text">{{ text }}</span>
    <span v-if="hint" class="tb-upload__hint">{{ hint }}</span>
    <span v-if="names.length" class="tb-upload__files">{{ names.join(', ') }}</span>
  </label>
</template>

<script setup>
import { computed, ref } from 'vue';
import TbIcon from './TbIcon.vue';

// A drop zone and file picker. Emits `files` (File[]); v-model holds the chosen files.
const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  accept: { type: String, default: '' },
  multiple: Boolean,
  disabled: Boolean,
  text: { type: String, default: 'Choose a file or drop it here' },
  hint: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue', 'files']);
const over = ref(false);
const el = ref(null);
const names = computed(() => props.modelValue.map((f) => f.name));
function set(list) { const files = [...list]; emit('update:modelValue', files); emit('files', files); }
function onPick(e) { set(e.target.files || []); }
function onDrop(e) { over.value = false; if (!props.disabled) set(e.dataTransfer.files || []); }
defineExpose({ reset: () => { if (el.value) el.value.value = ''; emit('update:modelValue', []); } });
</script>

<style>
.tb-upload {
  display: grid; justify-items: center; gap: 4px; padding: var(--tb-s6) var(--tb-s4); text-align: center; cursor: pointer;
  border: 1.5px dashed var(--tb-ink-2); border-radius: var(--tb-radius-m); color: var(--tb-ink-2);
  transition: border-color var(--tb-t-hover) var(--tb-ease), background-color var(--tb-t-hover) var(--tb-ease);
}
.tb-upload:hover, .tb-upload.is-over { border-color: var(--tb-ink); background: var(--tb-paper-2); color: var(--tb-ink); }
.tb-upload:focus-within { outline: 2px solid var(--tb-focus); outline-offset: 2px; }
.tb-upload__text { font-weight: 600; color: var(--tb-ink); }
.tb-upload__hint { font-size: var(--tb-fs-13); }
.tb-upload__files { font-size: var(--tb-fs-13); color: var(--tb-ink); word-break: break-all; }
.tb-upload.is-disabled { opacity: .45; cursor: not-allowed; }
</style>
