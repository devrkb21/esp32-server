<script setup lang="ts">
// One choice from a list (country code, language), as ruled rows in a bottom sheet.
// options: [{ value, label, note }]; emits pick(value).
withDefaults(defineProps<{ open?: boolean, title?: string, value?: string, options?: { value: string, label: string, note?: string }[] }>(), {
  open: false,
  title: '',
  value: '',
  options: () => [],
})
const emit = defineEmits<{ (e: 'update:open', v: boolean): void, (e: 'pick', value: string): void }>()
</script>

<template>
  <tb-sheet :open="open" :title="title" @update:open="(v: boolean) => emit('update:open', v)">
    <view class="pick-list" role="listbox" :aria-label="title">
      <view
        v-for="o in options" :key="o.value" class="pick-row" :class="{ 'is-on': o.value === value }" role="option"
        :aria-selected="o.value === value ? 'true' : 'false'" hover-class="is-press" @click="emit('pick', o.value)"
      >
        <text class="pick-row__label">
          {{ o.label }}
        </text>
        <text v-if="o.note" class="tb-num pick-row__note">
          {{ o.note }}
        </text>
        <view class="pick-row__check">
          <tb-icon v-if="o.value === value" name="check" :size="18" />
        </view>
      </view>
    </view>
  </tb-sheet>
</template>

<style lang="scss">
.pick-list {
  display: flex;
  flex-direction: column;
  margin-top: -8px;
}
.pick-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 52px;
  border-bottom: 1px solid var(--tb-rule-soft);
}
.pick-row.is-press {
  background: var(--tb-paper-2);
}
.pick-row__label {
  flex: 1;
  min-width: 0;
  font-size: 15px;
}
.pick-row__note {
  font-weight: 600;
  color: var(--tb-ink-2);
}
.pick-row.is-on .pick-row__label,
.pick-row.is-on .pick-row__note {
  color: var(--tb-ink);
  font-weight: 700;
}
.pick-row__check {
  width: 20px;
  flex: none;
  color: var(--tb-action);
}
</style>
