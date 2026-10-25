<script lang="ts" setup>
import type { GestureAction, GestureSettings } from '@/api/companion'
import { computed, ref, watch } from 'vue'
import { t } from '@/i18n'
import { focusMinutes, GESTURE_ACTIONS, GESTURE_KEYS, gestureSettings } from '@/utils/companionUtils.mjs'
import { useRobot } from './context'

// Tap shortcuts (settings.gestures): what two and three taps on TinyBot's head do. The robot
// counts exactly, so four or more taps do nothing; "focus" starts the saved focus minutes.
// A draft saved with the button, like the other sections.
defineOptions({ name: 'RobotGestures' })

const r = useRobot()
const actions = GESTURE_ACTIONS as readonly GestureAction[]
const labels = computed(() => actions.map(a => t(`mrobot.gesture.${a}`)))

const form = ref<GestureSettings>(gestureSettings(undefined))
const baseline = ref<GestureSettings>(gestureSettings(undefined))
const dirty = computed(() => GESTURE_KEYS.some(k => baseline.value[k] !== form.value[k]))
function sync(force = false) {
  if (!force && (dirty.value || r.saving.gestures))
    return
  baseline.value = gestureSettings(r.view.value?.settings?.gestures)
  form.value = { ...baseline.value }
}
watch(() => r.view.value?.settings?.gestures, () => sync(), { immediate: true, deep: true })

const usesFocus = computed(() => GESTURE_KEYS.some(k => form.value[k] === 'focus'))
const focusMin = computed(() => focusMinutes(r.view.value))

function pick(key: keyof GestureSettings, e: any) {
  const i = Number(e?.detail?.value)
  if (Number.isInteger(i) && actions[i])
    form.value = { ...form.value, [key]: actions[i] }
}
async function save() {
  if (await r.save({ settings: { gestures: { ...form.value } } }, 'gestures'))
    sync(true)
}
</script>

<template>
  <tb-section :title="t('mrobot.sec.gestures')" :description="t('mrobot.gestures.intro')">
    <template #actions>
      <tb-sync v-bind="r.syncOf('gestures')" />
    </template>

    <view class="rbg">
      <view v-for="key in GESTURE_KEYS" :key="key" class="rbg__row">
        <view class="rbg__head">
          <view class="rbg__marks" aria-hidden="true">
            <view v-for="n in (key === 'triple_tap' ? 3 : 2)" :key="n" class="rbg__mark" />
          </view>
          <view class="rb-row__text">
            <text class="rbg__name">
              {{ t(`mrobot.gestures.${key}`) }}
            </text>
            <text class="rb-row__small">
              {{ t(`mrobot.gestures.${key}Line`) }}
            </text>
          </view>
        </view>
        <picker mode="selector" :range="labels" :value="actions.indexOf(form[key])" @change="(e: any) => pick(key, e)">
          <view class="rbg__pick" role="button" :aria-label="t(`mrobot.gestures.${key}`)">
            <text class="rbg__value">
              {{ t(`mrobot.gesture.${form[key]}`) }}
            </text>
            <tb-icon name="chevron-down" :size="16" />
          </view>
        </picker>
      </view>
      <text class="rb-note">
        {{ t('mrobot.gestures.hint') }}
      </text>
      <text v-if="usesFocus" class="rb-note">
        {{ t('mrobot.gestures.focusNote', { n: r.num(focusMin) }) }}
      </text>
      <view v-if="dirty" class="rb-foot">
        <text class="rb-foot__unsaved">
          {{ t('common.unsaved') }}
        </text>
        <tb-button variant="quiet" @click="sync(true)">
          {{ t('common.undo') }}
        </tb-button>
        <tb-button variant="primary" :loading="!!r.saving.gestures" @click="save">
          {{ t('common.save') }}
        </tb-button>
      </view>
    </view>
  </tb-section>
</template>

<style lang="scss">
@import './robot.scss';

.rbg {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rbg__row {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 0;
  border-bottom: 1px solid var(--tb-rule-soft);
}
.rbg__head {
  display: flex;
  align-items: center;
  gap: 12px;
}
.rbg__marks {
  display: flex;
  gap: 4px;
  width: 32px;
  flex: none;
}
.rbg__mark {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--tb-ink);
}
.rbg__name {
  font-weight: 600;
}
.rbg__pick {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 44px;
  padding: 0 12px;
  border: 1.5px solid var(--tb-ink);
  border-radius: var(--tb-radius-m);
  background: var(--tb-paper);
}
.rbg__value {
  font-size: 15px;
  font-weight: 600;
  min-width: 0;
}
</style>
