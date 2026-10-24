<script setup lang="ts">
// Has this reached TinyBot? The rule's form says it, always with its word:
// applied = solid, pending = dashed, off = struck, error = red.
withDefaults(defineProps<{ state?: 'applied' | 'pending' | 'off' | 'error', text?: string }>(), { state: 'applied', text: '' })
</script>

<template>
  <view class="tb-sync" :class="`is-${state}`" role="status">
    <view class="tb-sync__rule" /><text>{{ text }}</text>
  </view>
</template>

<style lang="scss">
.tb-sync { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--tb-ink-2); }
.tb-sync__rule { width: 22px; height: 0; border-top: 2px solid var(--tb-ok); }
.tb-sync.is-pending .tb-sync__rule { border-top-style: dashed; border-color: var(--tb-ink-2); }
.tb-sync.is-off { text-decoration: line-through; }
.tb-sync.is-off .tb-sync__rule { border-color: var(--tb-ink-3); }
.tb-sync.is-error { color: var(--tb-danger); }
.tb-sync.is-error .tb-sync__rule { border-color: var(--tb-danger); }
</style>
