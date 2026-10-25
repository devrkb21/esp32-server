<template>
  <TbSheet :open="open" :title="title" size="s" :close-label="$t('common.close')" @update:open="close">
    <div class="dv-vol">
      <p class="dv-vol__big" aria-live="polite"><span class="tb-num">{{ num(value) }}</span><small>%</small></p>
      <p class="dv-vol__now">
        <TbLoading v-if="reading" :label="$t('common.loading')" />
        <span>{{ now === null ? $t('devices.volume.nowUnknown') : $t('devices.volume.now', { n: num(now) }) }}</span>
      </p>
      <div class="dv-vol__slider">
        <TbIcon name="minus" :size="18" />
        <TbSlider v-model="value" :min="0" :max="100" :step="5" :show-value="false" :aria-label="$t('devices.volume.title')"
          :value-text="`${num(value)}%`" />
        <TbIcon name="plus" :size="18" />
      </div>
      <p class="dv-vol__hint">{{ $t('devices.volume.hint') }}</p>
    </div>
    <template #footer>
      <TbButton variant="secondary" @click="close">{{ $t('common.cancel') }}</TbButton>
      <TbButton variant="primary" :loading="saving" @click="save">{{ $t('common.save') }}</TbButton>
    </template>
  </TbSheet>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import Api from '@/apis/api';
import { toast } from '@/kit/toast';
import { digits } from '@/kit/calendar';
import { companionVolume, volumeSaveOutcome } from '@/utils/companion.mjs';

// The robot's volume. Opens on its real volume: what it last reported (companion stats), else
// what the app asked for (companion settings), else the last value set here, else 70.
const props = defineProps({
  open: Boolean,
  row: { type: Object, default: null },
});
const emit = defineEmits(['update:open', 'saved']);
const { t, locale } = useI18n({ useScope: 'global' });
const num = (n) => digits(n, locale.value);

const value = ref(70);
const now = ref(null);
const reading = ref(false);
const saving = ref(false);
const title = computed(() => {
  const name = props.row ? (props.row.alias || props.row.macAddress) : '';
  return name ? t('devices.volume.titleOf', { name }) : t('devices.volume.title');
});

watch(() => [props.open, props.row], ([open, row]) => {
  if (!open || !row) return;
  value.value = row.volume !== undefined && row.volume !== null ? row.volume : 70;
  now.value = null;
  reading.value = true;
  saving.value = false;
  Api.companion.getCompanion(row.device_id, (res) => {
    if (props.row !== row) return;
    reading.value = false;
    const view = (res && res.data && res.data.data) || {};
    const v = companionVolume(view);
    if (v !== null) value.value = v;
    now.value = companionVolume({ stats: view.stats });
  }, () => { if (props.row === row) reading.value = false; });
}, { immediate: true });

function close() { emit('update:open', false); }

function savedText(data, volume) {
  const outcome = volumeSaveOutcome(data);
  if (outcome === 'offline') return t('devices.volume.savedOffline', { n: num(volume) });
  if (outcome === 'other') return data.msg;
  return t('devices.volume.setTo', { n: num(volume) });
}

function save() {
  const row = props.row;
  if (!row) return;
  const volume = value.value;
  saving.value = true;
  Api.device.setDeviceVolume(row.device_id, volume, ({ data }) => {
    saving.value = false;
    if (data.code === 0) {
      toast.success(savedText(data, volume));
      emit('saved', { row, volume });
      close();
    } else {
      toast.error(data.msg || t('devices.volume.failed'));
    }
  });
}
</script>

<style>
.dv-vol { display: grid; justify-items: center; gap: var(--tb-s3); padding: var(--tb-s2) 0; }
.dv-vol__big { font-family: var(--tb-font-display); font-weight: 800; font-size: var(--tb-fs-48); line-height: 1; letter-spacing: -.02em; }
.dv-vol__big small { font-size: var(--tb-fs-24); color: var(--tb-ink-2); margin-left: 2px; }
.dv-vol__now { display: inline-flex; align-items: center; gap: 8px; color: var(--tb-ink-2); font-size: var(--tb-fs-14); }
.dv-vol__slider { display: flex; align-items: center; gap: var(--tb-s3); width: 100%; color: var(--tb-ink-2); }
.dv-vol__slider .tb-slider { flex: 1; }
.dv-vol__hint { color: var(--tb-ink-2); font-size: var(--tb-fs-13); text-align: center; max-width: 40ch; }
</style>
