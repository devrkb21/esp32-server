<script lang="ts" setup>
import type { CareSettings, NightSettings } from '@/api/companion'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { t } from '@/i18n'
import { clampInt, isHHMM, isMinutes, NIGHT_LIGHT_MAX, NIGHT_LIGHT_PRESETS } from '@/utils/companionUtils.mjs'
import { useDay } from '../dayContext'
import { LONELY_LIMITS } from '../dayModel.mjs'
import DayField from './DayField.vue'
import DayNumber from './DayNumber.vue'
import DayTime from './DayTime.vue'

// Night mode and care, as the legacy panel: every switch and time is saved at once as a partial
// settings patch; the night light minutes and the lonely time are saved after a short pause.
// "Start night now" / "End tonight" are commands.
const day = useDay()
const night = computed<Partial<NightSettings>>(() => day.view?.settings?.night || {})
const care = computed<Partial<CareSettings>>(() => day.view?.settings?.care || {})
const TOGGLES = ['dim', 'lullaby', 'light'] as const
const focused = ref(false)

async function setNight(patch: Partial<NightSettings>) {
  if (day.view?.settings) {
    // optimistic; replaced by the server's answer
    day.view.settings.night = { ...(day.view.settings.night || {}), ...patch } as NightSettings
  }
  await day.save({ settings: { night: patch } }, 'night')
}
function onTime(key: 'start' | 'end', value: string) {
  if (isHHMM(value) && value !== night.value[key])
    setNight({ [key]: value })
}

// night light: 0 = until the night ends (1 hour when started by hand)
const lightMinutes = ref(0)
const customLight = ref(false)
let lightEditing = false
let lightTimer: ReturnType<typeof setTimeout> | undefined
watch(() => night.value.light_minutes, (v) => {
  if (!lightEditing)
    lightMinutes.value = isMinutes(v, NIGHT_LIGHT_MAX) ? v as number : 0
}, { immediate: true })
const lightChoice = computed(() => (customLight.value || !(NIGHT_LIGHT_PRESETS as number[]).includes(lightMinutes.value) ? 'custom' : lightMinutes.value))
const lightOptions = computed(() => [
  ...(NIGHT_LIGHT_PRESETS as number[]).map(n => ({ value: n, label: n === 0 ? t('day.night.untilMorning') : t('day.minutes', { n: day.num(n) }) })),
  { value: 'custom', label: t('day.night.custom') },
])
function onLightMinutes(value: number) {
  lightMinutes.value = value
  lightEditing = true
  clearTimeout(lightTimer)
  lightTimer = setTimeout(async () => {
    if (isMinutes(value, NIGHT_LIGHT_MAX) && value !== night.value.light_minutes)
      await setNight({ light_minutes: value })
    lightEditing = false
  }, 700)
}
function pickLight(choice: number | string) {
  if (choice === 'custom') {
    customLight.value = true
    return
  }
  customLight.value = false
  onLightMinutes(Number(choice))
}

async function nightNow(arg: 'on' | 'off') {
  await day.command('night', arg, t(arg === 'on' ? 'day.night.startedNow' : 'day.night.endedNow'), `night:${arg}`)
}

// care
async function setCareEnabled(enabled: boolean) {
  if (day.view?.settings)
    day.view.settings.care = { ...(day.view.settings.care || {}), enabled } as CareSettings
  await day.save({ settings: { care: { enabled } } }, 'care')
}
const lonely = ref(180)
let lonelyEditing = false
let lonelyTimer: ReturnType<typeof setTimeout> | undefined
watch(() => care.value.lonely_after_min, (v) => {
  if (v !== undefined && !lonelyEditing)
    lonely.value = v
}, { immediate: true })
function onLonely(v: number) {
  lonely.value = v
  lonelyEditing = true
  clearTimeout(lonelyTimer)
  lonelyTimer = setTimeout(async () => {
    const value = clampInt(lonely.value, LONELY_LIMITS[0], LONELY_LIMITS[1], 180)
    await day.save({ settings: { care: { lonely_after_min: value } } }, 'care')
    lonelyEditing = false
  }, 700)
}
onBeforeUnmount(() => {
  clearTimeout(lightTimer)
  clearTimeout(lonelyTimer)
})

function focusKey(key: string) {
  if (key !== 'night')
    return false
  focused.value = true
  setTimeout(() => { focused.value = false }, 1600)
  return true
}
defineExpose({ focusKey })
</script>

<template>
  <tb-section :title="t('day.night.sectionTitle')" :description="t('day.night.desc')" ink="message">
    <view class="dblock" :class="{ 'is-focus': focused }">
      <view class="dblock__head">
        <text class="dsub">
          {{ t('day.night.title') }}
        </text>
        <tb-sync v-bind="day.syncOf('night')" />
      </view>
      <tb-switch :model-value="!!night.enabled" :label="t('day.night.enabled')" @change="(v: boolean) => setNight({ enabled: v })" />
      <view class="drange">
        <DayField :label="t('day.night.start')">
          <DayTime :model-value="night.start || '21:30'" :aria-label="t('day.night.start')" @change="(v: string) => onTime('start', v)" />
        </DayField>
        <DayField :label="t('day.night.end')">
          <DayTime :model-value="night.end || '06:30'" :aria-label="t('day.night.end')" @change="(v: string) => onTime('end', v)" />
        </DayField>
      </view>
      <view class="dswitches">
        <tb-switch v-for="k in TOGGLES" :key="k" :model-value="!!night[k]" :label="t(`day.night.${k}`)" @change="(v: boolean) => setNight({ [k]: v })" />
      </view>
      <DayField :label="t('day.night.lightFor')" :hint="t('day.night.lightForHint')">
        <tb-choice :model-value="lightChoice" :options="lightOptions" :aria-label="t('day.night.lightFor')" @change="pickLight" />
      </DayField>
      <DayField v-if="lightChoice === 'custom'" :label="t('day.night.lightMinutes', { max: day.num(NIGHT_LIGHT_MAX) })">
        <DayNumber :model-value="lightMinutes" :min="0" :max="NIGHT_LIGHT_MAX" :step="5" :aria-label="t('day.night.lightFor')" @update:model-value="onLightMinutes" />
      </DayField>
      <view class="dfoot dfoot--start">
        <tb-button icon="moon" :loading="day.busy === 'night:on'" :disabled="!!day.busy && day.busy !== 'night:on'" @click="nightNow('on')">
          {{ t('day.night.startNow') }}
        </tb-button>
        <tb-button icon="sun" :loading="day.busy === 'night:off'" :disabled="!!day.busy && day.busy !== 'night:off'" @click="nightNow('off')">
          {{ t('day.night.endNow') }}
        </tb-button>
      </view>
      <text class="dnote">
        {{ t('day.night.nowHint') }}
      </text>
    </view>

    <view class="dblock">
      <view class="dblock__head">
        <text class="dsub">
          {{ t('day.care.title') }}
        </text>
        <tb-sync v-bind="day.syncOf('care')" />
      </view>
      <tb-switch :model-value="!!care.enabled" :label="t('day.care.enabled')" @change="setCareEnabled" />
      <DayField :label="t('day.care.lonelyAfter')" :hint="t('day.care.range', { min: day.num(LONELY_LIMITS[0]), max: day.num(LONELY_LIMITS[1]) })">
        <DayNumber
          :model-value="lonely" :min="LONELY_LIMITS[0]" :max="LONELY_LIMITS[1]" :step="10" :disabled="!care.enabled"
          :aria-label="t('day.care.lonelyAfter')" @update:model-value="onLonely"
        />
      </DayField>
      <text class="dnote">
        {{ t('day.care.hint') }}
      </text>
    </view>
  </tb-section>
</template>
