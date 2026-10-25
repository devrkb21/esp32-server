<template>
  <div ref="strip" class="tb-tabs" :class="{ 'is-overflow': overflow }" role="tablist" :aria-label="ariaLabel || null"
    @scroll.passive="measure">
    <button v-for="t in items" :key="t.key" type="button" role="tab" class="tb-tabs__tab"
      :class="{ 'is-on': t.key === modelValue }" :style="t.ink ? { '--ink': `var(--tb-${t.ink})` } : null"
      :aria-selected="t.key === modelValue ? 'true' : 'false'" :tabindex="t.key === modelValue ? 0 : -1"
      @click="pick(t.key)" @keydown="onKey($event, t)">
      <TbIcon v-if="t.icon" :name="t.icon" :size="18" />
      <span>{{ t.label }}</span>
      <span v-if="t.count !== undefined && t.count !== null" class="tb-tabs__count tb-num">{{ t.count }}</span>
    </button>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import TbIcon from './TbIcon.vue';

// Tabs as ruled headings; the active one carries its area ink (`ink`: prayer, alarm, routine,
// message, look) or the plain ink. items: [{ key, label, icon, ink, count }].
const props = defineProps({
  modelValue: { type: String, default: '' },
  items: { type: Array, default: () => [] },
  ariaLabel: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue', 'change']);
function pick(k) { emit('update:modelValue', k); emit('change', k); }
// A strip wider than its box fades out at the right edge until it is scrolled to the end.
const strip = ref(null);
const overflow = ref(false);
function measure() {
  const el = strip.value;
  if (!el) return;
  overflow.value = el.scrollWidth > el.clientWidth + 1 && el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
}
// Bring the active tab into view inside the strip only (scrollIntoView could also move the page).
function showActive() {
  const el = strip.value;
  const on = el?.querySelector('.is-on');
  if (!on) return;
  const left = on.offsetLeft; // the strip is positioned, so this is relative to it
  const right = left + on.offsetWidth;
  if (left < el.scrollLeft) el.scrollLeft = left;
  else if (right > el.scrollLeft + el.clientWidth) el.scrollLeft = right - el.clientWidth;
}
let ro = null;
onMounted(() => {
  showActive();
  measure();
  if (typeof ResizeObserver === 'function') { ro = new ResizeObserver(measure); ro.observe(strip.value); }
  else window.addEventListener('resize', measure);
});
onBeforeUnmount(() => { if (ro) ro.disconnect(); else window.removeEventListener('resize', measure); });
watch(() => props.items.length, () => nextTick(measure));
function onKey(e, t) {
  const i = props.items.indexOf(t);
  let j = -1;
  if (e.key === 'ArrowRight') j = (i + 1) % props.items.length;
  if (e.key === 'ArrowLeft') j = (i - 1 + props.items.length) % props.items.length;
  if (j >= 0) { e.preventDefault(); pick(props.items[j].key); e.currentTarget.parentElement.children[j]?.focus(); }
}
</script>

<style>
.tb-tabs { position: relative; display: flex; gap: 2px; overflow-x: auto; border-bottom: 1px solid var(--tb-rule); scrollbar-width: none; }
.tb-tabs::-webkit-scrollbar { display: none; }
.tb-tabs.is-overflow {
  -webkit-mask-image: linear-gradient(to right, #000 calc(100% - 24px), transparent);
  mask-image: linear-gradient(to right, #000 calc(100% - 24px), transparent);
}
.tb-tabs__tab {
  --ink: var(--tb-ink);
  position: relative; display: inline-flex; align-items: center; gap: 8px; min-height: 46px; padding: 0 14px;
  border: 0; background: none; color: var(--tb-ink-2); font-weight: 600; font-size: var(--tb-fs-15); white-space: nowrap;
  transition: color var(--tb-t-hover) var(--tb-ease);
}
.tb-tabs__tab::after {
  content: ""; position: absolute; left: 10px; right: 10px; bottom: -1px; height: 3px; background: var(--ink);
  transform: scaleX(0); transition: transform var(--tb-t-fast) var(--tb-ease);
}
.tb-tabs__tab:hover { color: var(--tb-ink); }
.tb-tabs__tab.is-on { color: var(--ink); }
.tb-tabs__tab.is-on::after { transform: scaleX(1); }
.tb-tabs__count { font-size: var(--tb-fs-12); border: 1px solid currentColor; border-radius: 999px; padding: 0 6px; line-height: 18px; }
</style>
