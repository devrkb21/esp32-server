<template>
  <span class="dv-mac">
    <template v-if="parts.ok">
      <span class="dv-mac__text tb-num">{{ parts.head }}<span v-if="shown">{{ parts.middle }}</span><span v-else
          class="dv-mac__hidden" aria-hidden="true">{{ hiddenMiddle }}</span>{{ parts.tail }}</span>
      <span v-if="!shown" class="tb-visually-hidden">{{ hiddenLabel }}</span>
      <button type="button" class="dv-mac__btn" :aria-pressed="shown ? 'true' : 'false'"
        :aria-label="shown ? hideLabel : showLabel" @click="shown = !shown">
        <TbIcon :name="shown ? 'eye-off' : 'eye'" :size="16" />
      </button>
    </template>
    <span v-else class="dv-mac__text tb-num">{{ mac || '–' }}</span>
  </span>
</template>

<script setup>
import { computed, ref } from 'vue';
import { macParts } from './devicesModel';

// A MAC address with its middle bytes hidden until the owner asks to see them.
const props = defineProps({
  mac: { type: String, default: '' },
  showLabel: { type: String, default: 'Show MAC address' },
  hideLabel: { type: String, default: 'Hide MAC address' },
  hiddenLabel: { type: String, default: 'part hidden' },
});
const shown = ref(false);
const parts = computed(() => macParts(props.mac));
const hiddenMiddle = computed(() => parts.value.middle.replace(/[0-9A-F]/gi, '•'));
</script>

<style>
.dv-mac { display: inline-flex; align-items: center; gap: 2px; white-space: nowrap; }
.dv-mac__text { font-size: var(--tb-fs-14); letter-spacing: .01em; }
.dv-mac__hidden { color: var(--tb-ink-3); }
.dv-mac__btn {
  display: grid; place-items: center; width: 32px; height: 32px; flex: none;
  border: 0; border-radius: 8px; background: transparent; color: var(--tb-ink-2);
  transition: background-color var(--tb-t-hover) var(--tb-ease), color var(--tb-t-hover) var(--tb-ease);
}
@media (hover: hover) and (pointer: fine) { .dv-mac__btn:hover { background: var(--tb-paper-2); color: var(--tb-ink); } }
@media (max-width: 640px) { .dv-mac__btn { width: 44px; height: 44px; } }
</style>
