<template>
  <nav class="tb-pager" :aria-label="ariaLabel">
    <span class="tb-pager__total tb-num">{{ totalText }}</span>
    <div class="tb-pager__nav">
      <TbButton size="s" variant="quiet" icon="chevron-left" :disabled="page <= 1" :aria-label="prevLabel" @click="go(page - 1)" />
      <span class="tb-pager__pos tb-num">{{ page }} / {{ pages }}</span>
      <TbButton size="s" variant="quiet" icon="chevron-right" :disabled="page >= pages" :aria-label="nextLabel" @click="go(page + 1)" />
    </div>
    <TbSelect v-if="sizes.length > 1" size="s" class="tb-pager__size" :model-value="pageSize" :options="sizeOptions"
      :aria-label="sizeLabel" @update:model-value="$emit('update:pageSize', $event); $emit('change', { page: 1, pageSize: $event })" />
  </nav>
</template>

<script setup>
import { computed } from 'vue';
import TbButton from './TbButton.vue';
import TbSelect from './TbSelect.vue';

const props = defineProps({
  page: { type: Number, default: 1 },
  pageSize: { type: Number, default: 10 },
  total: { type: Number, default: 0 },
  sizes: { type: Array, default: () => [10, 20, 50] },
  totalText: { type: String, default: '' },
  sizeSuffix: { type: String, default: '/ page' },
  ariaLabel: { type: String, default: 'Pages' },
  prevLabel: { type: String, default: 'Previous page' },
  nextLabel: { type: String, default: 'Next page' },
  sizeLabel: { type: String, default: 'Rows per page' },
});
const emit = defineEmits(['update:page', 'update:pageSize', 'change']);
const pages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)));
const sizeOptions = computed(() => props.sizes.map((s) => ({ value: s, label: `${s} ${props.sizeSuffix}` })));
function go(p) {
  const v = Math.min(pages.value, Math.max(1, p));
  emit('update:page', v);
  emit('change', { page: v, pageSize: props.pageSize });
}
</script>

<style>
.tb-pager { display: flex; align-items: center; gap: var(--tb-s4); padding: var(--tb-s3) 0; flex-wrap: wrap; }
.tb-pager__total { color: var(--tb-ink-2); font-size: var(--tb-fs-13); margin-right: auto; }
.tb-pager__nav { display: inline-flex; align-items: center; gap: 4px; }
.tb-pager__pos { font-weight: 600; min-width: 5ch; text-align: center; font-size: var(--tb-fs-14); }
.tb-pager__size { width: 132px; }
</style>
