<template>
  <TbSheet :open="open" :title="$t('character.context.sheetTitle')" size="m" :close-on-scrim="false" :close-label="$t('common.close')"
    @update:open="$emit('update:open', $event)">
    <p class="ch-ctx__lead">{{ $t('character.context.sheetLead') }}</p>
    <TbEmpty v-if="!rows.length" :title="$t('character.context.emptyTitle')">
      <TbButton variant="primary" icon="plus" @click="addProvider(0)">{{ $t('character.context.addSource') }}</TbButton>
    </TbEmpty>
    <section v-for="(p, pi) in rows" :key="pi" class="ch-ctx" :aria-label="$t('character.context.sourceN', { n: num(pi + 1) })">
      <header class="ch-ctx__head">
        <h3>{{ $t('character.context.sourceN', { n: num(pi + 1) }) }}</h3>
        <TbButton size="s" variant="quiet" icon="trash" class="ch-ctx__del" :aria-label="$t('contextProviderDialog.removeSource')" @click="rows.splice(pi, 1)" />
      </header>
      <TbField :label="$t('contextProviderDialog.apiUrl')" :for-id="`ch-ctx-url-${pi}`">
        <TbInput :id="`ch-ctx-url-${pi}`" v-model="p.url" inputmode="url" :placeholder="$t('contextProviderDialog.apiUrlPlaceholder')" />
      </TbField>
      <div class="ch-ctx__headers">
        <p class="ch-ctx__label">{{ $t('character.context.headers') }}</p>
        <div v-for="(h, hi) in p.headers" :key="hi" class="ch-ctx__row">
          <TbInput v-model="h.key" size="s" :aria-label="$t('character.context.headerName')" :placeholder="$t('contextProviderDialog.headerKeyPlaceholder')" />
          <TbInput v-model="h.value" size="s" :aria-label="$t('character.context.headerValue')" :placeholder="$t('contextProviderDialog.headerValuePlaceholder')" />
          <TbButton size="s" variant="quiet" icon="plus" :aria-label="$t('contextProviderDialog.addHeader')" @click="p.headers.splice(hi + 1, 0, { key: '', value: '' })" />
          <TbButton size="s" variant="quiet" icon="minus" :aria-label="$t('contextProviderDialog.removeHeader')" @click="p.headers.splice(hi, 1)" />
        </div>
        <p v-if="!p.headers.length" class="ch-ctx__none">{{ $t('character.context.noHeaders') }}
          <TbButton size="s" variant="quiet" icon="plus" @click="p.headers.push({ key: '', value: '' })">{{ $t('contextProviderDialog.addHeader') }}</TbButton></p>
      </div>
    </section>
    <TbButton v-if="rows.length" icon="plus" class="ch-ctx__add" @click="addProvider(rows.length)">{{ $t('character.context.addSource') }}</TbButton>
    <template #footer>
      <TbButton @click="$emit('update:open', false)">{{ $t('common.cancel') }}</TbButton>
      <TbButton variant="primary" @click="confirm">{{ $t('character.context.keep') }}</TbButton>
    </template>
  </TbSheet>
</template>

<script>
import { digits } from '@/kit/calendar';
import { providersFromRows, rowsFromProviders } from './characterModel';

// Context sources: web addresses TinyBot reads when it wakes, with their request headers.
// Same rules as the legacy ContextProviderDialog: blank addresses are dropped, header names trimmed.
export default {
  name: 'ContextSheet',
  props: { open: Boolean, providers: { type: Array, default: () => [] } },
  emits: ['update:open', 'confirm'],
  data() { return { rows: [] }; },
  watch: { open: { immediate: true, handler(v) { if (v) this.rows = rowsFromProviders(this.providers); } } },
  methods: {
    num(n) { return digits(n, this.$i18n.locale); },
    addProvider(i) { this.rows.splice(i, 0, { url: '', headers: [{ key: '', value: '' }] }); },
    confirm() {
      this.$emit('confirm', providersFromRows(this.rows));
      this.$emit('update:open', false);
    },
  },
};
</script>

<style>
.ch-ctx__lead { color: var(--tb-ink-2); font-size: var(--tb-fs-14); }
.ch-ctx { display: grid; gap: 12px; padding: 12px 0 16px; border-top: 1px solid var(--tb-rule); }
.ch-ctx__head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.ch-ctx__head h3 { font-size: var(--tb-fs-16); }
.ch-ctx__del { color: var(--tb-danger); }
.ch-ctx__headers { display: grid; gap: 6px; }
.ch-ctx__label { font-weight: 600; font-size: var(--tb-fs-14); }
.ch-ctx__row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr) auto auto; gap: 6px; align-items: center; }
.ch-ctx__none { display: flex; align-items: center; gap: 8px; color: var(--tb-ink-3); font-size: var(--tb-fs-14); }
.ch-ctx__add { justify-self: start; }
@media (max-width: 480px) {
  .ch-ctx__row { grid-template-columns: minmax(0, 1fr) auto auto; }
  .ch-ctx__row > .tb-input:nth-child(2) { grid-column: 1; grid-row: 2; }
}
</style>
