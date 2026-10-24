<script setup lang="ts">
/**
 * Segmented control for 2–4 peer sections (Nobix design system §7 "Segmented control").
 * Scrolls horizontally when the labels do not fit (long translations, 360 px phones).
 */
interface TabItem {
  label: string
  value: string | number
  /** Kept for API compatibility; the segmented control is text-only */
  icon?: string
  activeIcon?: string
}

interface Props {
  tabList: TabItem[]
  modelValue?: string | number
}

interface Emits {
  (e: 'update:modelValue', value: string | number): void
  (e: 'change', item: TabItem, index: number): void
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
})

const emit = defineEmits<Emits>()

const activeValue = computed(() => {
  return props.modelValue || (props.tabList[0]?.value ?? '')
})

function handleTabClick(item: TabItem, index: number) {
  emit('update:modelValue', item.value)
  emit('change', item, index)
}
</script>

<template>
  <view class="nx-tabs">
    <scroll-view scroll-x class="nx-tabs__scroll" :show-scrollbar="false" enable-flex>
      <view class="nx-tabs__track" role="tablist">
        <view
          v-for="(item, index) in tabList"
          :key="item.value"
          class="nx-tabs__item"
          :class="{ 'is-active': activeValue === item.value }"
          role="tab"
          :aria-selected="activeValue === item.value"
          @click="handleTabClick(item, index)"
        >
          <text class="nx-tabs__label">
            {{ item.label }}
          </text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<style scoped>
.nx-tabs {
  padding: var(--nx-space-2) var(--nx-gutter) var(--nx-space-3);
  background: var(--nx-bg);
}

.nx-tabs__scroll {
  width: 100%;
  white-space: nowrap;
}

.nx-tabs__track {
  display: flex;
  gap: 4rpx;
  min-width: 100%;
  width: max-content;
  padding: 6rpx;
  box-sizing: border-box;
  border-radius: var(--nx-radius);
  background: var(--nx-surface-3);
}

.nx-tabs__item {
  flex: 1 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 64rpx;
  padding: 0 var(--nx-space-3);
  border-radius: calc(var(--nx-radius) - 6rpx);
  color: var(--nx-text-2);
  transition:
    background-color var(--nx-dur-2) var(--nx-ease),
    color var(--nx-dur-2) var(--nx-ease),
    transform var(--nx-dur-1) var(--nx-ease);
}

.nx-tabs__item:active {
  transform: scale(0.97);
}

.nx-tabs__item.is-active {
  background: var(--nx-surface);
  color: var(--nx-text);
  box-shadow: var(--nx-shadow-1);
}

.nx-tabs__label {
  font-size: var(--nx-text-footnote);
  font-weight: 500;
  line-height: 1.2;
  white-space: nowrap;
}

.nx-tabs__item.is-active .nx-tabs__label {
  font-weight: 600;
}

@media (prefers-reduced-motion: reduce) {
  .nx-tabs__item {
    transition: none;
  }
}
</style>
