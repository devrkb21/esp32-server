<template>
  <section class="tb-section" :style="ink ? { '--ink': `var(--tb-${ink})` } : null" :aria-labelledby="id">
    <header class="tb-section__head">
      <h2 :id="id" class="tb-section__title"><i v-if="ink" class="tb-section__mark" aria-hidden="true"></i>{{ title }}</h2>
      <p v-if="description" class="tb-section__desc">{{ description }}</p>
      <div v-if="$slots.actions" class="tb-section__actions"><slot name="actions" /></div>
    </header>
    <div class="tb-section__body"><slot /></div>
  </section>
</template>

<script setup>
// A ruled block of a page. `ink` marks the area it belongs to (prayer, alarm, routine, message, look).
defineProps({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  ink: { type: String, default: '' },
});
const id = `tb-sec-${Math.random().toString(36).slice(2, 8)}`;
</script>

<style>
.tb-section { --ink: var(--tb-ink); padding: var(--tb-s5) 0 var(--tb-s6); border-bottom: 1px solid var(--tb-rule); }
.tb-section__head { display: grid; grid-template-columns: 1fr auto; align-items: end; gap: 4px var(--tb-s4); margin-bottom: var(--tb-s4); }
.tb-section__title { display: flex; align-items: center; gap: 8px; font-size: var(--tb-fs-20); color: var(--tb-ink); }
.tb-section__mark { width: 9px; height: 9px; background: var(--ink); }
.tb-section__desc { grid-column: 1; color: var(--tb-ink-2); font-size: var(--tb-fs-14); max-width: 70ch; }
.tb-section__actions { grid-column: 2; grid-row: 1 / span 2; display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
.tb-section__body { display: grid; gap: var(--tb-s4); }
@media (max-width: 640px) {
  .tb-section__head { grid-template-columns: 1fr; }
  .tb-section__actions { grid-column: 1; grid-row: auto; justify-content: flex-start; }
}
</style>
