<script lang="ts" setup>
import { t } from '@/i18n'
import { DAY_KEYS, EVERY_DAY, FRI_SAT, hasDay, SUN_TO_THU, toggleDay } from '../companionUtils.mjs'

defineOptions({
  name: 'CompanionDayChips',
})

const props = defineProps<{
  modelValue: number
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void
}>()

const presets = [
  { key: 'everyDay', mask: EVERY_DAY },
  { key: 'sunToThu', mask: SUN_TO_THU },
  { key: 'friSat', mask: FRI_SAT },
]

function flip(bit: number) {
  emit('update:modelValue', toggleDay(props.modelValue, bit))
}
</script>

<template>
  <view class="flex flex-col gap-[16rpx]">
    <view class="flex flex-wrap gap-[12rpx]">
      <view
        v-for="(key, bit) in DAY_KEYS"
        :key="key"
        class="min-w-[76rpx] rounded-[32rpx] px-[18rpx] py-[10rpx] text-center text-[24rpx]"
        :class="hasDay(modelValue, bit) ? 'bg-[#336cff] text-white' : 'bg-[#f0f2f7] text-[#65686f]'"
        @click="flip(bit)"
      >
        {{ t(`companion.day.${key}`) }}
      </view>
    </view>
    <view class="flex flex-wrap gap-[12rpx]">
      <view
        v-for="p in presets"
        :key="p.key"
        class="border-[1rpx] rounded-[32rpx] border-solid px-[18rpx] py-[8rpx] text-[22rpx]"
        :class="modelValue === p.mask ? 'border-[#336cff] text-[#336cff] bg-[#eef3ff]' : 'border-[#e0e3ea] text-[#8c8c8c]'"
        @click="emit('update:modelValue', p.mask)"
      >
        {{ t(`companion.days.${p.key}`) }}
      </view>
    </view>
  </view>
</template>
