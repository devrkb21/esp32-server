<template>
  <div class="tb-dateblock" :class="{ 'is-friday': isFriday, 'is-turning': turning }"
    @pointerdown="startX = $event.clientX" @pointerup="onSwipe">
    <span class="tb-dateblock__num" aria-hidden="true">{{ dayNum }}</span>
    <p class="tb-dateblock__wd">{{ weekday }}</p>
    <p class="tb-dateblock__sub">{{ subline }}</p>
    <span class="tb-visually-hidden">{{ fullText }}</span>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { banglaDateText, digits, weekdayText } from './calendar';

// The calendar's giant date. Swipe left / right turns the day (emits `turn` with -1 or +1).
const props = defineProps({
  date: { type: Date, required: true },
  lang: { type: String, default: 'bn' },
  extra: { type: String, default: '' }, // e.g. "সূর্যোদয় ৬:০৫"
});
const emit = defineEmits(['turn']);
const startX = ref(null);
const turning = ref(false);
const dayNum = computed(() => digits(props.date.getDate(), props.lang));
const weekday = computed(() => weekdayText(props.date, props.lang));
const isFriday = computed(() => props.date.getDay() === 5);
const subline = computed(() => [banglaDateText(props.date, props.lang, false), props.extra].filter(Boolean).join(' · '));
const fullText = computed(() => `${weekday.value}, ${props.date.toLocaleDateString(props.lang === 'bn' ? 'bn-BD' : 'en-GB')}`);
function onSwipe(e) {
  if (startX.value === null) return;
  const dx = e.clientX - startX.value;
  startX.value = null;
  if (Math.abs(dx) > 48) emit('turn', dx < 0 ? 1 : -1);
}
watch(() => props.date.toDateString(), () => { turning.value = true; setTimeout(() => { turning.value = false; }, 240); });
</script>

<style>
.tb-dateblock { display: grid; align-content: start; touch-action: pan-y; user-select: none; }
.tb-dateblock__num {
  font-family: var(--tb-font-display); font-weight: 800; font-size: var(--tb-fs-date); line-height: .92;
  color: var(--tb-alarm); letter-spacing: -.02em; font-variant-numeric: lining-nums;
}
.tb-dateblock.is-friday .tb-dateblock__num { color: var(--tb-prayer); }
.tb-dateblock__wd { font-family: var(--tb-font-display); font-weight: 700; font-size: var(--tb-fs-20); margin-top: 4px; }
.tb-dateblock__sub { color: var(--tb-ink-2); font-size: var(--tb-fs-13); }
.tb-dateblock.is-turning { animation: tb-day-turn var(--tb-t-day) var(--tb-ease); }
@keyframes tb-day-turn { from { transform: translateY(12px); opacity: 0; } }
</style>
