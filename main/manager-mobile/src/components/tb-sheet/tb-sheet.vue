<script setup lang="ts">
// A bottom sheet (dialog) for the phone. v-model:open.
withDefaults(defineProps<{ open?: boolean, title?: string, closeOnScrim?: boolean }>(), { open: false, title: '', closeOnScrim: true })
const emit = defineEmits<{ (e: 'update:open', v: boolean): void, (e: 'close'): void }>()
function close() {
  emit('update:open', false)
  emit('close')
}
</script>

<template>
  <view class="tb-sheet" :class="{ 'is-open': open }" :aria-hidden="open ? 'false' : 'true'">
    <view class="tb-sheet__scrim" @click="closeOnScrim && close()" />
    <view class="tb-sheet__panel" role="dialog" aria-modal="true" :aria-label="title">
      <view class="tb-sheet__head">
        <text class="tb-sheet__title">{{ title }}</text>
        <view class="tb-sheet__x" @click="close"><tb-icon name="close" :size="20" /></view>
      </view>
      <scroll-view scroll-y class="tb-sheet__body"><view class="tb-sheet__inner"><slot /></view></scroll-view>
      <view v-if="$slots.footer" class="tb-sheet__foot"><slot name="footer" /></view>
    </view>
  </view>
</template>

<style lang="scss">
.tb-sheet { position: fixed; inset: 0; z-index: 900; pointer-events: none; }
.tb-sheet.is-open { pointer-events: auto; }
.tb-sheet__scrim { position: absolute; inset: 0; background: rgba(27, 23, 20, .42); opacity: 0; transition: opacity var(--tb-t-sheet) var(--tb-ease); }
.tb-sheet.is-open .tb-sheet__scrim { opacity: 1; }
.tb-sheet__panel {
  position: absolute; left: 0; right: 0; bottom: 0; max-height: 90vh; display: flex; flex-direction: column;
  background: var(--tb-paper); color: var(--tb-ink); border-top: 3px solid var(--tb-rule); border-radius: 14px 14px 0 0;
  padding-bottom: env(safe-area-inset-bottom); transform: translateY(100%);
  transition: transform var(--tb-t-sheet) var(--tb-ease);
}
.tb-sheet.is-open .tb-sheet__panel { transform: translateY(0); }
.tb-sheet__head { display: flex; align-items: center; justify-content: space-between; padding: 12px 8px 8px 20px; border-bottom: 1px solid var(--tb-rule-soft); }
.tb-sheet__title { font-family: var(--tb-font-display); font-weight: 700; font-size: 19px; }
.tb-sheet__x { display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; color: var(--tb-ink-2); }
.tb-sheet__body { max-height: 70vh; }
.tb-sheet__inner { padding: 16px 20px; display: flex; flex-direction: column; gap: 14px; }
.tb-sheet__foot { display: flex; gap: 10px; padding: 12px 20px 14px; border-top: 1px solid var(--tb-rule-soft); }
.tb-sheet__foot > * { flex: 1; }
</style>
