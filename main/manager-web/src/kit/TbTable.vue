<template>
  <div class="tb-table" :class="{ 'is-dense': dense, 'is-loading': loading, 'is-selectable': selectable }">
    <div v-if="selectable && phoneSelectAll && rows.length" class="tb-table__selall">
      <TbCheckbox :model-value="allChecked" :indeterminate="someChecked" :label="selectAllLabel" @update:model-value="toggleAll" />
    </div>
    <div class="tb-table__scroll">
      <table>
        <caption v-if="caption" class="tb-visually-hidden">{{ caption }}</caption>
        <thead>
          <tr>
            <th v-if="selectable" class="tb-table__sel" scope="col">
              <TbCheckbox :model-value="allChecked" :indeterminate="someChecked" :aria-label="selectAllLabel" @update:model-value="toggleAll" />
            </th>
            <th v-for="c in columns" :key="c.key" scope="col" :style="{ width: c.width || null, textAlign: c.align || null }"
              :aria-sort="c.sortable ? (sort.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none') : null">
              <button v-if="c.sortable" type="button" class="tb-table__sort" @click="toggleSort(c.key)">
                {{ c.label }}
                <TbIcon :name="sort.key === c.key && sort.dir === 'asc' ? 'chevron-up' : 'chevron-down'" :size="14"
                  :class="{ 'is-on': sort.key === c.key }" />
              </button>
              <span v-else>{{ c.label }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in rows" :key="rowKey ? row[rowKey] : i" :class="rowClass ? rowClass(row) : null"
            @click="$emit('row-click', row)">
            <td v-if="selectable" class="tb-table__sel" @click.stop>
              <TbCheckbox :model-value="isChecked(row)" :aria-label="selectRowLabel" @update:model-value="toggleRow(row, $event)" />
            </td>
            <td v-for="c in columns" :key="c.key" :class="{ 'is-full': c.full }" :style="{ textAlign: c.align || null }" :data-label="c.label" :data-key="c.key">
              <slot :name="`cell-${c.key}`" :row="row" :value="row[c.key]" :index="i">{{ format(c, row) }}</slot>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="loading" class="tb-table__state" role="status"><TbLoading :label="loadingText" /></div>
      <div v-else-if="!rows.length" class="tb-table__state"><slot name="empty"><TbEmpty :title="emptyText" /></slot></div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive } from 'vue';
import TbCheckbox from './TbCheckbox.vue';
import TbIcon from './TbIcon.vue';
import TbEmpty from './TbEmpty.vue';
import TbLoading from './TbLoading.vue';

// The almanac table: ruled rows, ink header rule. columns: [{ key, label, width, align,
// sortable, format(value,row), full }]. `full`: on phones the cell spans the row with no label
// (a name with its description). Slots: cell-<key> ({ row, value, index }), empty.
// Selectable tables show their select-all above the rows on phones (the header is hidden there).
const props = defineProps({
  columns: { type: Array, required: true },
  rows: { type: Array, default: () => [] },
  rowKey: { type: String, default: '' },
  rowClass: { type: Function, default: null },
  dense: Boolean,
  loading: Boolean,
  selectable: Boolean,
  selected: { type: Array, default: () => [] },
  caption: { type: String, default: '' },
  emptyText: { type: String, default: '' },
  loadingText: { type: String, default: '' },
  selectAllLabel: { type: String, default: 'Select all' },
  selectRowLabel: { type: String, default: 'Select row' },
  // false when the page draws its own select-all above a phone list
  phoneSelectAll: { type: Boolean, default: true },
});
const emit = defineEmits(['update:selected', 'sort', 'row-click']);
const sort = reactive({ key: '', dir: 'asc' });
const keyOf = (r) => (props.rowKey ? r[props.rowKey] : r);
const isChecked = (r) => props.selected.includes(keyOf(r));
const allChecked = computed(() => props.rows.length > 0 && props.rows.every(isChecked));
const someChecked = computed(() => !allChecked.value && props.rows.some(isChecked));
function toggleAll(v) { emit('update:selected', v ? props.rows.map(keyOf) : []); }
function toggleRow(r, v) {
  const k = keyOf(r);
  emit('update:selected', v ? [...props.selected, k] : props.selected.filter((x) => x !== k));
}
function toggleSort(key) {
  if (sort.key === key) sort.dir = sort.dir === 'asc' ? 'desc' : 'asc';
  else { sort.key = key; sort.dir = 'asc'; }
  emit('sort', { key: sort.key, dir: sort.dir });
}
function format(c, row) { const v = row[c.key]; return c.format ? c.format(v, row) : (v ?? '–'); }
</script>

<style>
.tb-table { position: relative; border-top: var(--tb-rule-band) solid var(--tb-rule); }
.tb-table__scroll { overflow-x: auto; }
.tb-table table { width: 100%; }
.tb-table th {
  text-align: left; font: 600 var(--tb-fs-13)/1.3 var(--tb-font-text); color: var(--tb-ink-2);
  padding: 10px 12px; border-bottom: 1px solid var(--tb-rule); white-space: nowrap;
}
.tb-table td { padding: 12px; border-bottom: 1px solid var(--tb-rule-soft); vertical-align: middle; font-size: var(--tb-fs-15); }
.tb-table.is-dense td { padding: 8px 12px; font-size: var(--tb-fs-14); }
.tb-table.is-dense th { padding: 8px 12px; }
.tb-table tbody tr { transition: background-color var(--tb-t-hover) var(--tb-ease); }
/* Desktop: a row darkens its rule and shows its actions on hover or keyboard focus. */
@media (hover: hover) and (pointer: fine) {
  .tb-table tbody tr:hover { background: var(--tb-paper-2); }
  .tb-table tbody tr:hover td { border-bottom-color: var(--tb-rule); }
  .tb-table td[data-key=actions] > * { opacity: 0; transition: opacity var(--tb-t-hover) var(--tb-ease); }
  .tb-table tbody tr:hover td[data-key=actions] > *,
  .tb-table tbody tr:focus-within td[data-key=actions] > * { opacity: 1; }
}
.tb-table__sel { width: 44px; }
.tb-table__sort { display: inline-flex; align-items: center; gap: 4px; border: 0; background: none; padding: 0; font: inherit; color: inherit; }
.tb-table__sort .tb-icon { opacity: .35; } .tb-table__sort .tb-icon.is-on { opacity: 1; }
.tb-table__state { padding: var(--tb-s8) var(--tb-s4); display: grid; place-items: center; }
.tb-table.is-loading tbody { opacity: .35; }
.tb-table__selall { display: none; }

/* phones: each row becomes a ruled block, label beside value */
@media (max-width: 640px) {
  .tb-table thead { display: none; }
  .tb-table table, .tb-table tbody, .tb-table tr, .tb-table td { display: block; width: 100%; }
  .tb-table tr { border-bottom: 1px solid var(--tb-rule); padding: 8px 0; }
  .tb-table td { border: 0; padding: 4px 4px; display: grid; grid-template-columns: 38% 1fr; gap: 8px; text-align: left !important; }
  .tb-table td::before { content: attr(data-label); color: var(--tb-ink-2); font-size: var(--tb-fs-13); }
  /* the row checkbox sits at the top right of its block, beside the first labelled line */
  .tb-table.is-selectable tbody tr { position: relative; }
  .tb-table td.tb-table__sel { position: absolute; top: 6px; right: 0; width: auto; padding: 0; display: block; }
  .tb-table td.tb-table__sel + td { padding-right: 48px; }
  .tb-table td.is-full { display: block; }
  .tb-table td.is-full::before { content: none; }
  .tb-table__selall { display: block; padding: 6px 4px; border-bottom: 1px solid var(--tb-rule); }
  .tb-table td.tb-table__sel::before { content: none; }
}
</style>
