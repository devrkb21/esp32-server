<script setup lang="ts">
// A bottom sheet (dialog) for the phone. v-model:open.
// A closed sheet is hidden (visibility) and renders no body, so its fields are out of the
// paint and focus order. `live` stays true for the 160ms exit so the panel slides out filled.
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { t } from '@/i18n'

const props = withDefaults(defineProps<{ open?: boolean, title?: string, closeOnScrim?: boolean }>(), { open: false, title: '', closeOnScrim: true })
const emit = defineEmits<{ (e: 'update:open', v: boolean): void, (e: 'close'): void }>()

const EXIT_MS = 160
const live = ref(props.open)
const panel = ref<any>(null)
let timer: ReturnType<typeof setTimeout> | null = null
// #ifdef H5
let lastFocus: HTMLElement | null = null
// #endif

function panelEl(): HTMLElement | null {
  const p = panel.value
  if (!p)
    return null
  return (p.$el || p) as HTMLElement
}

watch(() => props.open, (open) => {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  if (open) {
    live.value = true
    // #ifdef H5
    lastFocus = (document.activeElement as HTMLElement) || null
    nextTick(() => {
      const el = panelEl()
      if (el && typeof el.focus === 'function')
        el.focus()
    })
    // #endif
  }
  else {
    timer = setTimeout(() => {
      live.value = false
      timer = null
    }, EXIT_MS)
    // #ifdef H5
    const back = lastFocus
    lastFocus = null
    if (back && typeof back.focus === 'function' && document.contains(back))
      back.focus()
    // #endif
  }
})

onBeforeUnmount(() => {
  if (timer)
    clearTimeout(timer)
})

function close() {
  emit('update:open', false)
  emit('close')
}
</script>

<template>
  <view class="tb-sheet" :class="{ 'is-open': open }" :aria-hidden="open ? 'false' : 'true'">
    <view class="tb-sheet__scrim" @click="closeOnScrim && close()" />
    <view ref="panel" class="tb-sheet__panel" role="dialog" aria-modal="true" tabindex="-1" :aria-label="title">
      <view class="tb-sheet__head">
        <text class="tb-sheet__title">{{ title }}</text>
        <view
          class="tb-sheet__x" role="button" tabindex="0" :aria-label="t('common.close')"
          @click="close" @keydown.enter="close" @keydown.space.prevent="close"
        >
          <tb-icon name="close" :size="20" />
        </view>
      </view>
      <scroll-view v-if="live" scroll-y class="tb-sheet__body"><view class="tb-sheet__inner"><slot /></view></scroll-view>
      <view v-if="live && $slots.footer" class="tb-sheet__foot"><slot name="footer" /></view>
    </view>
  </view>
</template>

<style lang="scss">
.tb-sheet { position: fixed; inset: 0; z-index: 900; pointer-events: none; visibility: hidden; transition: visibility 0s linear 160ms; }
.tb-sheet.is-open { pointer-events: auto; visibility: visible; transition: visibility 0s; }
.tb-sheet__scrim { position: absolute; inset: 0; background: rgba(27, 23, 20, .42); opacity: 0; transition: opacity 160ms var(--tb-ease-in); }
.tb-sheet.is-open .tb-sheet__scrim { opacity: 1; transition: opacity var(--tb-t-sheet) var(--tb-ease); }
.tb-sheet__panel {
  position: absolute; left: 0; right: 0; bottom: 0; max-height: 90vh; display: flex; flex-direction: column;
  background: var(--tb-paper); color: var(--tb-ink); border-top: 3px solid var(--tb-rule); border-radius: 14px 14px 0 0;
  padding-bottom: env(safe-area-inset-bottom); transform: translateY(100%); visibility: hidden; outline: none;
  transition: transform 160ms var(--tb-ease-in), visibility 0s linear 160ms;
}
.tb-sheet.is-open .tb-sheet__panel { transform: translateY(0); visibility: visible; transition: transform var(--tb-t-sheet) var(--tb-ease), visibility 0s; }
.tb-sheet__head { display: flex; align-items: center; justify-content: space-between; padding: 12px 8px 8px 20px; border-bottom: 1px solid var(--tb-rule-soft); }
.tb-sheet__title { font-family: var(--tb-font-display); font-weight: 700; font-size: 19px; }
.tb-sheet__x { display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; color: var(--tb-ink-2); border-radius: 8px; }
.tb-sheet__x:focus-visible { outline: 2px solid var(--tb-focus); outline-offset: 2px; }
.tb-sheet__body { max-height: 70vh; }
.tb-sheet__inner { padding: 16px 20px; display: flex; flex-direction: column; gap: 14px; }
.tb-sheet__foot { display: flex; gap: 10px; padding: 12px 20px 14px; border-top: 1px solid var(--tb-rule-soft); }
.tb-sheet__foot > * { flex: 1; }
@media (prefers-reduced-motion: reduce) {
  .tb-sheet__panel, .tb-sheet.is-open .tb-sheet__panel { transition-duration: 1ms, 0s; }
}
</style>
