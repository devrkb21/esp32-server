<script lang="ts" setup>
// One ruled row of the character screens: a label, what is set now, and a chevron when the row
// opens a sheet or an inner screen. `preview` puts the value under the label (long text).
withDefaults(defineProps<{
  label: string
  value?: string
  hint?: string
  preview?: boolean
  placeholder?: boolean
  disabled?: boolean
  chevron?: boolean
}>(), { value: '', hint: '', preview: false, placeholder: false, disabled: false, chevron: true })
const emit = defineEmits<{ (e: 'click'): void }>()
</script>

<template>
  <view
    class="ag-row" :class="{ 'is-preview': preview, 'is-disabled': disabled }" role="button"
    :aria-disabled="disabled ? 'true' : 'false'" hover-class="is-press" @click="!disabled && emit('click')"
  >
    <view class="ag-row__main">
      <text class="ag-row__label">
        {{ label }}
      </text>
      <text v-if="preview" class="ag-row__preview" :class="{ 'is-ph': placeholder }">
        {{ value }}
      </text>
      <text v-if="hint" class="ag-row__hint">
        {{ hint }}
      </text>
    </view>
    <text v-if="!preview && value" class="ag-row__value" :class="{ 'is-ph': placeholder }">
      {{ value }}
    </text>
    <slot />
    <tb-icon v-if="chevron && !disabled" class="ag-row__chev" name="chevron-right" :size="18" />
  </view>
</template>

<style lang="scss">
.ag-row {
  display: flex; align-items: center; gap: 12px; min-height: 54px; padding: 10px 0;
  border-bottom: 1px solid var(--tb-rule-soft); transition: background-color var(--tb-t-hover) var(--tb-ease);
}
.ag-row:last-child { border-bottom: 0; }
.ag-row.is-press { background: var(--tb-paper-2); }
.ag-row.is-preview { align-items: flex-start; }
.ag-row.is-preview .ag-row__chev { margin-top: 2px; }
.ag-row__main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.ag-row__label { font-size: 15px; font-weight: 600; line-height: 1.35; overflow-wrap: anywhere; }
.ag-row__hint { font-size: 13px; color: var(--tb-ink-2); line-height: 1.45; }
.ag-row__value {
  flex: 0 1 auto; max-width: 52%; min-width: 0; font-size: 14px; color: var(--tb-ink-2); text-align: right;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.ag-row__preview {
  font-size: 14px; color: var(--tb-ink-2); line-height: 1.5; overflow: hidden;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow-wrap: anywhere;
}
.ag-row .is-ph { color: var(--tb-ink-3); }
.ag-row__chev { flex: none; color: var(--tb-ink-3); }
.ag-row.is-disabled { cursor: default; }
.ag-row.is-disabled .ag-row__label { color: var(--tb-ink-2); }
</style>
