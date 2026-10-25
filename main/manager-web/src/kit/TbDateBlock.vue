<template>
  <div class="tb-dateblock" :class="{ 'is-friday': isFriday, 'is-turning': turning }" :tabindex="turnable ? 0 : null"
    :role="turnable ? 'group' : null" :aria-label="turnable ? fullText : null" @pointerdown="startX = $event.clientX" @pointerup="onSwipe"
    @keydown.left="onKey($event, -1)" @keydown.right="onKey($event, 1)">
    <span class="tb-dateblock__num" aria-hidden="true">{{ dayNum }}</span>
    <div class="tb-dateblock__line">
      <component :is="headingLevel ? `h${headingLevel}` : 'p'" class="tb-dateblock__wd">
        {{ weekday }}<span class="tb-visually-hidden">, {{ fullDate }}</span>
      </component>
      <span v-if="turnable" class="tb-dateblock__turn">
        <TbButton v-if="prevLabel" variant="quiet" size="s" icon="chevron-left" :aria-label="prevLabel" :title="prevLabel"
          @pointerdown.stop @pointerup.stop @click="emit('turn', -1)" />
        <TbButton v-if="nextLabel" variant="quiet" size="s" icon="chevron-right" :aria-label="nextLabel" :title="nextLabel"
          @pointerdown.stop @pointerup.stop @click="emit('turn', 1)" />
      </span>
    </div>
    <p class="tb-dateblock__sub">{{ subline }}</p>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import TbButton from './TbButton.vue';
import { banglaDateText, digits, weekdayText } from './calendar';

// The calendar's giant date. Swipe left / right, the arrow keys while it has focus, or the two
// chevron buttons (shown when prevLabel / nextLabel are given) turn the day: emits `turn` with
// -1 or +1. headingLevel 1 renders the weekday line as the page's <h1>.
const props = defineProps({
  date: { type: Date, required: true },
  lang: { type: String, default: 'bn' },
  extra: { type: String, default: '' }, // e.g. "সূর্যোদয় ৬:০৫"
  prevLabel: { type: String, default: '' },
  nextLabel: { type: String, default: '' },
  headingLevel: { type: Number, default: 0 },
});
const emit = defineEmits(['turn']);
const startX = ref(null);
const turning = ref(false);
const dayNum = computed(() => digits(props.date.getDate(), props.lang));
const weekday = computed(() => weekdayText(props.date, props.lang));
const isFriday = computed(() => props.date.getDay() === 5);
const subline = computed(() => [banglaDateText(props.date, props.lang, false), props.extra].filter(Boolean).join(' · '));
const fullDate = computed(() => props.date.toLocaleDateString(props.lang === 'bn' ? 'bn-BD' : 'en-GB'));
const turnable = computed(() => Boolean(props.prevLabel || props.nextLabel));
function onKey(e, dir) {
  if (!turnable.value || e.target !== e.currentTarget) return;
  e.preventDefault();
  emit('turn', dir);
}
const fullText = computed(() => `${weekday.value}, ${fullDate.value}`);
function onSwipe(e) {
  if (startX.value === null) return;
  const dx = e.clientX - startX.value;
  startX.value = null;
  if (Math.abs(dx) > 48) emit('turn', dx < 0 ? 1 : -1);
}
watch(() => props.date.toDateString(), () => { turning.value = true; setTimeout(() => { turning.value = false; }, 240); });
</script>

<style>
.tb-dateblock { display: grid; align-content: start; touch-action: pan-y; user-select: none; border-radius: var(--tb-radius-s); }
.tb-dateblock:focus-visible { outline: 2px solid var(--tb-focus); outline-offset: 4px; }
.tb-dateblock__num {
  font-family: var(--tb-font-display); font-weight: 800; font-size: var(--tb-fs-date); line-height: .92;
  color: var(--tb-ink); letter-spacing: -.02em; font-variant-numeric: lining-nums;
}
/* the wall calendar's rule: everyday dates in ink, Fridays (the weekly holiday) in red */
.tb-dateblock.is-friday .tb-dateblock__num { color: var(--tb-alarm); }
.tb-dateblock__line { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
.tb-dateblock__wd { margin: 0; font-family: var(--tb-font-display); font-weight: 700; font-size: var(--tb-fs-20); line-height: 1.2; }
.tb-dateblock__turn { display: inline-flex; gap: 2px; margin-left: auto; }
.tb-dateblock__sub { color: var(--tb-ink-2); font-size: var(--tb-fs-13); }
.tb-dateblock.is-turning { animation: tb-day-turn var(--tb-t-day) var(--tb-ease); }
@keyframes tb-day-turn { from { transform: translateY(12px); opacity: 0; } }
</style>
