<template>
  <TbSheet :open="confirmState.open" :title="c ? (c.title || defaultTitle) : ''" size="s" :close-label="cancelText"
    @update:open="(v) => !v && settle(false)">
    <p v-if="c" class="tb-confirm__msg">{{ c.message }}</p>
    <TbField v-if="c && c.input" :error="error">
      <TbInput v-model="value" :placeholder="c.inputPlaceholder" autofocus @enter="ok" />
    </TbField>
    <template #footer>
      <TbButton v-if="c && c.showCancel" variant="secondary" @click="settle(false)">{{ (c && c.cancelText) || cancelText }}</TbButton>
      <TbButton :variant="c && c.danger ? 'danger' : 'primary'" @click="ok">{{ (c && c.confirmText) || confirmText }}</TbButton>
    </template>
  </TbSheet>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { confirmState, settle } from './confirm';
import TbSheet from './TbSheet.vue';
import TbButton from './TbButton.vue';
import TbField from './TbField.vue';
import TbInput from './TbInput.vue';

defineProps({
  confirmText: { type: String, default: 'OK' },
  cancelText: { type: String, default: 'Cancel' },
  defaultTitle: { type: String, default: '' },
});
const c = computed(() => confirmState.current);
const value = ref('');
const error = ref('');
watch(c, (v) => { value.value = v ? v.inputValue : ''; error.value = ''; });
function ok() {
  if (c.value && c.value.input && c.value.inputPattern && !c.value.inputPattern.test(value.value)) {
    error.value = c.value.inputErrorMessage || ' ';
    return;
  }
  settle(true, value.value);
}
</script>

<style>
.tb-confirm__msg { white-space: pre-line; }
</style>
