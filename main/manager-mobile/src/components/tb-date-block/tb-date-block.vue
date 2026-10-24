<script setup lang="ts">
import { computed, ref } from 'vue'
import { banglaDateText, digits, weekdayText } from '@/utils/calendar.mjs'

// The calendar's giant date. Swiping left / right turns the day (emits `turn` with -1 or +1).
const props = withDefaults(defineProps<{ date: Date, lang?: string, extra?: string }>(), { lang: 'bn', extra: '' })
const emit = defineEmits<{ (e: 'turn', dir: number): void }>()
const startX = ref<number | null>(null)
const dayNum = computed(() => digits(props.date.getDate(), props.lang))
const weekday = computed(() => weekdayText(props.date, props.lang))
const isFriday = computed(() => props.date.getDay() === 5)
const subline = computed(() => [banglaDateText(props.date, props.lang, false), props.extra].filter(Boolean).join(' · '))
function onStart(e: any) { startX.value = e.touches?.[0]?.clientX ?? null }
function onEnd(e: any) {
  if (startX.value === null)
    return
  const dx = (e.changedTouches?.[0]?.clientX ?? startX.value) - startX.value
  startX.value = null
  if (Math.abs(dx) > 48)
    emit('turn', dx < 0 ? 1 : -1)
}
</script>

<template>
  <view class="tb-dateblock" :class="{ 'is-friday': isFriday }" @touchstart="onStart" @touchend="onEnd">
    <text class="tb-dateblock__num">{{ dayNum }}</text>
    <text class="tb-dateblock__wd">{{ weekday }}</text>
    <text class="tb-dateblock__sub">{{ subline }}</text>
  </view>
</template>

<style lang="scss">
.tb-dateblock { display: flex; flex-direction: column; }
.tb-dateblock__num { font-family: var(--tb-font-display); font-weight: 800; font-size: clamp(88px, 28vw, 124px); line-height: .92; color: var(--tb-alarm); letter-spacing: -.02em; }
.tb-dateblock.is-friday .tb-dateblock__num { color: var(--tb-prayer); }
.tb-dateblock__wd { font-family: var(--tb-font-display); font-weight: 700; font-size: 20px; margin-top: 4px; }
.tb-dateblock__sub { color: var(--tb-ink-2); font-size: 13px; }
</style>
