<script setup lang="ts">
// The heading of an inner page: display title, one line of what it is for, optional back and actions.
withDefaults(defineProps<{ title: string, description?: string, back?: boolean }>(), { description: '', back: false })
function goBack() {
  if (getCurrentPages().length > 1)
    uni.navigateBack()
  else uni.switchTab({ url: '/pages/index/index' })
}
</script>

<template>
  <view class="tb-pagehead">
    <view v-if="back" class="tb-pagehead__back" role="button" aria-label="Back" @click="goBack">
      <tb-icon name="chevron-left" :size="22" />
    </view>
    <view class="tb-pagehead__text">
      <text class="tb-pagehead__title">{{ title }}</text>
      <text v-if="description" class="tb-pagehead__desc">{{ description }}</text>
    </view>
    <view v-if="$slots.actions" class="tb-pagehead__actions"><slot name="actions" /></view>
  </view>
</template>

<style lang="scss">
.tb-pagehead { display: flex; align-items: flex-end; gap: 10px; padding: calc(env(safe-area-inset-top) + 18px) 0 12px; border-bottom: 3px solid var(--tb-rule); }
.tb-pagehead__back { display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; margin-left: -10px; }
.tb-pagehead__text { flex: 1; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.tb-pagehead__title { font-family: var(--tb-font-display); font-weight: 800; font-size: 26px; line-height: 1.15; }
.tb-pagehead__desc { color: var(--tb-ink-2); font-size: 14px; }
.tb-pagehead__actions { display: flex; gap: 8px; }
</style>
