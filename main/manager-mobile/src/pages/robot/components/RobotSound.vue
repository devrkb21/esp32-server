<script lang="ts" setup>
import type { DisplaySettings, RobotPage } from '@/api/companion'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { t } from '@/i18n'
import { toast } from '@/utils/toast'
import {
  DIM_PRESETS,
  DISPLAY_MAX,
  displayProblem,
  displaySettings,
  isLastPageOn,
  isMinutes,
  OFF_PRESETS,
  ROBOT_PAGES,
  robotPages,
} from '../../companion/companionUtils.mjs'
import { presetChoice, reportedVolume, sliderVolume, typedMinutes, volumeFromPhone } from '../robotModel.mjs'
import { useRobot } from './context'

// Sound and screen: the volume (set from the phone, or the robot keeps its own) and the little
// sounds save at once, as before; the screen timeouts are a draft saved with the button; the
// robot's info pages switch one by one (at least one stays on). The voice itself lives on the
// character screen, linked from here.
defineOptions({ name: 'RobotSound' })

const r = useRobot()
const v = computed(() => r.view.value)

// ------------------------------------------------------------------ volume
const fromPhone = computed(() => volumeFromPhone(v.value))
const volume = ref(70)
watch(() => [v.value?.settings?.volume, v.value?.stats?.volume], () => {
  volume.value = sliderVolume(v.value)
}, { immediate: true })
const reported = computed(() => reportedVolume(v.value))
const nowText = computed(() => reported.value === null
  ? t('mrobot.sound.robotNowUnknown')
  : t('mrobot.sound.robotNow', { n: r.num(reported.value) }))
/** The big number: what the app sets, else what the robot reports. */
const shown = computed(() => (fromPhone.value || reported.value === null ? volume.value : reported.value))

function volumeSavedText(n: number) {
  return r.online.value ? t('mrobot.sound.volumeSet', { n: r.num(n) }) : t('mrobot.sound.volumeSetOffline', { n: r.num(n) })
}

// TinyBot reports its new volume right after changing it: show it before the next poll
let later: ReturnType<typeof setTimeout> | undefined
function reloadSoon() {
  clearTimeout(later)
  later = setTimeout(() => r.reload(), 1500)
}
onBeforeUnmount(() => clearTimeout(later))

async function setFromPhone(on: boolean) {
  const ok = await r.save({ settings: { volume: on ? volume.value : null } }, 'sound', on ? volumeSavedText(volume.value) : undefined)
  if (ok && on)
    reloadSoon()
}
function onVolumeMove(e: any) {
  const n = Number(e?.detail?.value)
  if (Number.isFinite(n))
    volume.value = n
}
async function onVolumeEnd(e: any) {
  const n = Number(e?.detail?.value)
  if (!Number.isFinite(n))
    return
  volume.value = n
  if (await r.save({ settings: { volume: n } }, 'sound', volumeSavedText(n)))
    reloadSoon()
}
function step(d: number) {
  if (!fromPhone.value)
    return
  const n = Math.min(100, Math.max(0, volume.value + d))
  if (n !== volume.value)
    onVolumeEnd({ detail: { value: n } })
}

async function setSounds(on: boolean) {
  if (v.value)
    v.value.settings.sounds = on
  await r.save({ settings: { sounds: on } }, 'sound')
}

// ------------------------------------------------------------------ screen timeouts (draft)
const pickers = [
  { key: 'dim_after_min', label: 'companion.display.dimAfter', presets: DIM_PRESETS, max: DISPLAY_MAX.dim_after_min },
  { key: 'off_after_min', label: 'companion.display.offAfter', presets: OFF_PRESETS, max: DISPLAY_MAX.off_after_min },
] as const
type DisplayKey = typeof pickers[number]['key']

const display = ref<DisplaySettings>(displaySettings(undefined))
const custom = ref<Record<DisplayKey, boolean>>({ dim_after_min: false, off_after_min: false })
const customText = ref<Record<DisplayKey, string>>({ dim_after_min: '', off_after_min: '' })
// the draft follows the server until edited (baseline = the server's value it was taken from)
const baseline = ref<DisplaySettings>(displaySettings(undefined))
const displayDirty = computed(() => baseline.value.dim_after_min !== display.value.dim_after_min || baseline.value.off_after_min !== display.value.off_after_min)
function syncDisplay(force = false) {
  if (!force && (displayDirty.value || r.saving.display))
    return
  baseline.value = displaySettings(v.value?.settings?.display)
  display.value = { ...baseline.value }
  if (force)
    custom.value = { dim_after_min: false, off_after_min: false }
}
watch(() => v.value?.settings?.display, () => syncDisplay(), { immediate: true, deep: true })

function options(p: typeof pickers[number]) {
  return [
    ...p.presets.map((n: number) => ({ value: n, label: n === 0 ? t('companion.display.never') : t('mrobot.minutes', { n: r.num(n) }) })),
    { value: 'custom', label: t('mrobot.minutesCustom') },
  ]
}
function choice(key: DisplayKey, presets: readonly number[]) {
  return presetChoice(display.value[key], presets as number[], custom.value[key])
}
function pick(key: DisplayKey, value: number | string) {
  if (value === 'custom') {
    custom.value[key] = true
    customText.value[key] = String(display.value[key])
    return
  }
  custom.value[key] = false
  display.value = { ...display.value, [key]: Number(value) }
}
function onCustom(key: DisplayKey, text: string) {
  customText.value[key] = text
  display.value = { ...display.value, [key]: typedMinutes(text) }
}
function revertDisplay() {
  syncDisplay(true)
}
async function saveDisplay() {
  const problem = displayProblem(display.value)
  if (problem) {
    const max = problem === 'dimRange' ? DISPLAY_MAX.dim_after_min : DISPLAY_MAX.off_after_min
    toast.warning(t(`mrobot.display.${problem}`, { max: r.num(max) }))
    return
  }
  if (await r.save({ settings: { display: { ...display.value } } }, 'display'))
    syncDisplay(true)
}

// ------------------------------------------------------------------ robot pages
const pageKeys = ROBOT_PAGES as RobotPage[]
const pages = computed(() => robotPages(v.value?.settings?.pages) as Record<RobotPage, boolean>)
async function setPage(key: RobotPage, on: boolean) {
  if (!v.value || (!on && isLastPageOn(pages.value, key)))
    return
  v.value.settings.pages = { ...pages.value, [key]: on } // optimistic; replaced by the server response
  await r.save({ settings: { pages: { [key]: on } } }, 'pages')
}

function goVoice() {
  uni.navigateTo({ url: '/pages/agent/index' })
}
</script>

<template>
  <tb-section :title="t('mrobot.sec.sound')" :description="t('mrobot.sound.desc')">
    <!-- volume and the little sounds -->
    <view class="rbn-block">
      <view class="rb-sub">
        <text class="rb-sub__title">
          {{ t('mrobot.sound.title') }}
        </text>
        <tb-sync v-bind="r.syncOf('sound')" />
      </view>
      <view class="rbn-volume" :class="{ 'is-auto': !fromPhone }">
        <text class="tb-num rbn-volume__big" aria-hidden="true">
          {{ r.num(shown) }}<text class="rbn-volume__pct">
            %
          </text>
        </text>
        <text class="rbn-volume__now" aria-live="polite">
          {{ nowText }}
        </text>
      </view>
      <view class="rb-row">
        <view class="rb-row__text">
          <text>{{ t('mrobot.sound.fromPhone') }}</text>
          <text v-if="!fromPhone" class="rb-row__small">
            {{ t('mrobot.sound.autoHint') }}
          </text>
        </view>
        <tb-switch :model-value="fromPhone" :disabled="!!r.saving.sound" @change="setFromPhone" />
      </view>
      <view class="rbn-slider" :class="{ 'is-off': !fromPhone }">
        <view class="rbn-slider__step" role="button" :aria-label="t('mrobot.sound.down')" @click="step(-5)">
          <tb-icon name="minus" :size="18" />
        </view>
        <slider
          class="rbn-slider__el" :value="volume" :min="0" :max="100" :step="5" :disabled="!fromPhone"
          active-color="var(--tb-ink)" background-color="var(--tb-rule-soft)" block-color="var(--tb-ink)" :block-size="22"
          :aria-label="t('mrobot.sound.volume')" @changing="onVolumeMove" @change="onVolumeEnd"
        />
        <view class="rbn-slider__step" role="button" :aria-label="t('mrobot.sound.up')" @click="step(5)">
          <tb-icon name="plus" :size="18" />
        </view>
      </view>
      <view class="rb-row">
        <view class="rb-row__text">
          <text>{{ t('mrobot.sound.sounds') }}</text>
        </view>
        <tb-switch :model-value="!!v?.settings?.sounds" @change="setSounds" />
      </view>
      <view class="rb-row rbn-link" role="link" hover-class="is-press" @click="goVoice">
        <tb-icon name="voice" :size="20" />
        <view class="rb-row__text">
          <text>{{ t('mrobot.sound.voice') }}</text>
          <text class="rb-row__small">
            {{ t('mrobot.sound.voiceHint') }}
          </text>
        </view>
        <tb-icon name="chevron-right" :size="18" />
      </view>
    </view>

    <!-- when the screen dims and turns off -->
    <view class="rbn-block">
      <view class="rb-sub">
        <text class="rb-sub__title">
          {{ t('mrobot.display.title') }}
        </text>
        <tb-sync v-bind="r.syncOf('display')" />
      </view>
      <view v-for="p in pickers" :key="p.key" class="rbn-minutes">
        <text class="rbn-minutes__label">
          {{ t(p.label) }}
        </text>
        <tb-choice wrap :model-value="choice(p.key, p.presets)" :options="options(p)" :aria-label="t(p.label)" @change="(val: any) => pick(p.key, val)" />
        <view v-if="choice(p.key, p.presets) === 'custom'" class="rbn-minutes__custom">
          <text class="rb-note">
            {{ t('mrobot.minutesRange', { max: r.num(p.max) }) }}
          </text>
          <tb-input
            class="rbn-minutes__input" type="number" :model-value="customText[p.key]" :maxlength="3"
            :invalid="!isMinutes(display[p.key], p.max)" :aria-label="t(p.label)" @update:model-value="(val: string) => onCustom(p.key, val)"
          />
          <text v-if="!isMinutes(display[p.key], p.max)" class="rbn-minutes__err">
            {{ t('mrobot.display.wholeMinutes') }}
          </text>
        </view>
      </view>
      <text class="rb-note">
        {{ t('companion.display.hint') }}
      </text>
      <view v-if="displayDirty" class="rb-foot">
        <text class="rb-foot__unsaved">
          {{ t('common.unsaved') }}
        </text>
        <tb-button variant="quiet" @click="revertDisplay">
          {{ t('common.undo') }}
        </tb-button>
        <tb-button variant="primary" :loading="!!r.saving.display" @click="saveDisplay">
          {{ t('common.save') }}
        </tb-button>
      </view>
    </view>

    <!-- the pages TinyBot cycles through when you hold its head -->
    <view class="rbn-block">
      <view class="rb-sub">
        <text class="rb-sub__title">
          {{ t('mrobot.pages.title') }}
        </text>
        <tb-sync v-bind="r.syncOf('pages')" />
      </view>
      <text class="rb-note">
        {{ t('companion.pages.footer') }}
      </text>
      <view v-for="p in pageKeys" :key="p" class="rb-row">
        <view class="rb-row__text">
          <text>{{ t(`companion.pages.${p}`) }}</text>
          <text class="rb-row__small">
            {{ isLastPageOn(pages, p) ? t('companion.pages.lastOn') : t(`companion.pages.${p}Hint`) }}
          </text>
        </view>
        <tb-switch :model-value="pages[p]" :disabled="isLastPageOn(pages, p)" @change="(on: boolean) => setPage(p, on)" />
      </view>
    </view>
  </tb-section>
</template>

<style lang="scss">
@import './robot.scss';

.rbn-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.rbn-block + .rbn-block {
  margin-top: 14px;
}
.rbn-volume {
  display: flex;
  align-items: baseline;
  gap: 14px;
  flex-wrap: wrap;
}
.rbn-volume__big {
  font-family: var(--tb-font-display);
  font-weight: 800;
  font-size: 56px;
  line-height: 1;
  letter-spacing: -0.02em;
}
.rbn-volume__pct {
  font-size: 26px;
  margin-left: 2px;
}
.rbn-volume.is-auto .rbn-volume__big {
  color: var(--tb-ink-2);
}
.rbn-volume__now {
  font-size: 14px;
  color: var(--tb-ink-2);
}
.rbn-slider {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--tb-ink-2);
  transition: opacity var(--tb-t-fast) var(--tb-ease);
}
.rbn-slider.is-off {
  opacity: 0.45;
}
.rbn-slider__el {
  flex: 1;
  margin: 0 6px;
}
.rbn-slider__step {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  flex: none;
}
.rbn-link {
  justify-content: flex-start;
}
.rbn-link > .tb-icon:first-child {
  color: var(--tb-ink-2);
}
.rbn-link.is-press {
  background: var(--tb-paper-2);
}
.rbn-minutes {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 6px 0 10px;
  border-bottom: 1px solid var(--tb-rule-soft);
}
.rbn-minutes__label {
  font-size: 15px;
  font-weight: 600;
}
.rbn-minutes__custom {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.rbn-minutes__input {
  width: 110px;
}
.rbn-minutes__err {
  width: 100%;
  font-size: 13px;
  color: var(--tb-danger);
}
</style>
