<script setup lang="ts">
import { dismissToast, toastState } from '@/utils/toast'

const ICON: Record<string, string> = { success: 'check', error: 'warning', warning: 'warning', info: 'info' }
</script>

<template>
  <view class="tb-toasts" aria-live="polite">
    <view v-for="t in toastState.items" :key="t.id" class="tb-toast" :class="`is-${t.kind}`" :role="t.kind === 'error' ? 'alert' : 'status'"
      @click="dismissToast(t.id)">
      <tb-icon :name="ICON[t.kind]" :size="18" class="tb-toast__icon" /><text class="tb-toast__msg">{{ t.message }}</text>
    </view>
  </view>
</template>

<style lang="scss">
.tb-toasts { position: fixed; left: 16px; right: 16px; bottom: calc(96px + env(safe-area-inset-bottom)); z-index: 1100; display: flex; flex-direction: column; gap: 8px; pointer-events: none; }
.tb-toast { pointer-events: auto; display: flex; align-items: center; gap: 10px; padding: 12px 14px; background: var(--tb-ink); color: var(--tb-paper);
  border-radius: var(--tb-radius-m); box-shadow: var(--tb-shadow-sheet); font-size: 14px; animation: tb-toast-in var(--tb-t-sheet) var(--tb-ease); }
.tb-toast.is-success .tb-toast__icon { color: #7FD8A8; }
.tb-toast.is-error .tb-toast__icon { color: #FF8A80; }
.tb-toast.is-warning .tb-toast__icon { color: #F2C46B; }
.tb-toast__msg { flex: 1; }
@keyframes tb-toast-in { from { opacity: 0; transform: translateY(10px); } }
</style>
