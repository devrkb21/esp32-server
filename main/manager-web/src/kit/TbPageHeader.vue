<template>
  <header class="tb-pagehead">
    <div class="tb-pagehead__text">
      <h1 class="tb-pagehead__title">{{ title }}</h1>
      <p v-if="description" class="tb-pagehead__desc">{{ description }}</p>
    </div>
    <div v-if="$slots.actions" class="tb-pagehead__actions"><slot name="actions" /></div>
  </header>
</template>

<script setup>
// The heading of an inner page: display title, one line of what the page is for, actions.
defineProps({ title: { type: String, required: true }, description: { type: String, default: '' } });
</script>

<style>
.tb-pagehead { display: flex; align-items: flex-end; justify-content: space-between; gap: var(--tb-s4); flex-wrap: wrap;
  padding: var(--tb-s6) 0 var(--tb-s4); border-bottom: var(--tb-rule-band) solid var(--tb-rule); }
.tb-pagehead__title { font-size: clamp(var(--tb-fs-24), 4vw, var(--tb-fs-32)); font-weight: 800; letter-spacing: -.01em; }
.tb-pagehead__desc { margin-top: 6px; color: var(--tb-ink-2); max-width: 70ch; }
.tb-pagehead__actions { display: flex; gap: 8px; flex-wrap: wrap; }
</style>
