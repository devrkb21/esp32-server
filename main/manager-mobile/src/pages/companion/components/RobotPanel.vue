<script lang="ts" setup>
import type { DisplaySettings, ProactiveSettings, RobotPage } from '@/api/companion'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { t } from '@/i18n'
import { toast } from '@/utils/toast'
import {
  companionVolume,
  DIM_PRESETS,
  DISPLAY_MAX,
  displayProblem,
  displaySettings,
  isHHMM,
  isLastPageOn,
  OFF_PRESETS,
  proactiveProblem,
  proactiveSettings,
  ROBOT_PAGES,
  robotPages,
} from '../companionUtils.mjs'
import { useCompanion } from './context'
import FirmwareGroup from './FirmwareGroup.vue'
import MemoryGroup from './MemoryGroup.vue'
import MinutesChips from './MinutesChips.vue'

defineOptions({
  name: 'CompanionRobotPanel',
})

const { dev, save, reload } = useCompanion()

// name and owner name: local drafts that follow the server until edited
const name = ref('')
const owner = ref('')
const namesDirty = ref(false)
const savingNames = ref(false)
watch(() => [dev.value?.name, dev.value?.settings?.owner_name], ([n, o]) => {
  if (!namesDirty.value) {
    name.value = n || ''
    owner.value = o || ''
  }
}, { immediate: true })

async function saveNames() {
  savingNames.value = true
  const ok = await save({
    name: name.value.trim() || 'TinyBot',
    settings: { owner_name: owner.value.trim() },
  })
  savingNames.value = false
  if (ok)
    namesDirty.value = false
}

// volume: null = the robot keeps its own volume
const fromPhone = computed(() => dev.value?.settings?.volume !== null && dev.value?.settings?.volume !== undefined)
const volume = ref(70)
watch(() => [dev.value?.settings?.volume, dev.value?.stats?.volume], ([v, reported]) => {
  volume.value = (v ?? reported ?? 70) as number
}, { immediate: true })

// the robot's real speaker volume as it last reported it
const robotNow = computed(() => companionVolume({ stats: dev.value?.stats }))
const robotNowText = computed(() => robotNow.value === null
  ? t('companion.sound.robotNowUnknown')
  : t('companion.sound.robotNow', { n: robotNow.value }))

function volumeSavedText(v: number) {
  return dev.value?.online === false
    ? t('companion.robot.volumeSetOffline', { n: v })
    : t('companion.robot.volumeSet', { n: v })
}

// TinyBot reports its new volume right after changing it: show it before the next poll
let reloadTimer: ReturnType<typeof setTimeout> | undefined
function reloadSoon() {
  clearTimeout(reloadTimer)
  reloadTimer = setTimeout(() => reload(), 1500)
}
onBeforeUnmount(() => clearTimeout(reloadTimer))

async function setFromPhone(on: boolean) {
  const ok = await save({ settings: { volume: on ? volume.value : null } }, on ? volumeSavedText(volume.value) : undefined)
  if (ok && on)
    reloadSoon()
}

async function onVolumeEnd(value: unknown) {
  const v = typeof value === 'object' && value !== null ? (value as { value: number }).value : Number(value)
  if (!Number.isFinite(v))
    return
  volume.value = v
  if (await save({ settings: { volume: v } }, volumeSavedText(v)))
    reloadSoon()
}

// display timeouts: a draft that follows the server until edited, saved with the button
const display = ref<DisplaySettings>(displaySettings(undefined))
const displayDirty = ref(false)
const savingDisplay = ref(false)
const dimChips = ref<{ reset: () => void } | null>(null)
const offChips = ref<{ reset: () => void } | null>(null)
watch(() => dev.value?.settings?.display, (d) => {
  if (!displayDirty.value)
    display.value = displaySettings(d)
}, { immediate: true, deep: true })

function setDisplay(key: keyof DisplaySettings, value: number) {
  display.value = { ...display.value, [key]: value }
  const saved = displaySettings(dev.value?.settings?.display)
  displayDirty.value = saved.dim_after_min !== display.value.dim_after_min || saved.off_after_min !== display.value.off_after_min
}

function revertDisplay() {
  displayDirty.value = false
  display.value = displaySettings(dev.value?.settings?.display)
  dimChips.value?.reset()
  offChips.value?.reset()
}

async function saveDisplay() {
  const problem = displayProblem(display.value)
  if (problem) {
    const max = problem === 'dimRange' ? DISPLAY_MAX.dim_after_min : DISPLAY_MAX.off_after_min
    toast.warning(t(`companion.display.${problem}`, { max }))
    return
  }
  savingDisplay.value = true
  const ok = await save({ settings: { display: { ...display.value } } })
  savingDisplay.value = false
  if (ok)
    displayDirty.value = false
}

// proactive talk: a draft that follows the server until edited, saved with the button
const proactive = ref<ProactiveSettings>(proactiveSettings(undefined))
const proactiveDirty = ref(false)
const savingProactive = ref(false)
const proactiveRows = [
  { on: 'morning_on', time: 'morning', label: 'companion.proactive.morning', timeLabel: 'companion.proactive.morningAt' },
  { on: 'evening_on', time: 'evening', label: 'companion.proactive.evening', timeLabel: 'companion.proactive.eveningAt' },
] as const
watch(() => dev.value?.settings?.proactive, (p) => {
  if (!proactiveDirty.value)
    proactive.value = proactiveSettings(p)
}, { immediate: true, deep: true })

function setProactive(patch: Partial<ProactiveSettings>) {
  proactive.value = { ...proactive.value, ...patch }
  const saved = proactiveSettings(dev.value?.settings?.proactive)
  proactiveDirty.value = (Object.keys(saved) as (keyof ProactiveSettings)[]).some(k => saved[k] !== proactive.value[k])
}

function onProactiveTime(key: 'morning' | 'evening', value: unknown) {
  if (isHHMM(value))
    setProactive({ [key]: value })
}

function revertProactive() {
  proactiveDirty.value = false
  proactive.value = proactiveSettings(dev.value?.settings?.proactive)
}

async function saveProactive() {
  const problem = proactiveProblem(proactive.value)
  if (problem) {
    toast.warning(t(`companion.proactive.${problem}`))
    return
  }
  savingProactive.value = true
  const ok = await save({ settings: { proactive: { ...proactive.value } } })
  savingProactive.value = false
  if (ok)
    proactiveDirty.value = false
}

async function setSounds(on: boolean) {
  if (dev.value)
    dev.value.settings.sounds = on
  await save({ settings: { sounds: on } })
}

// robot info pages: every key present (missing = shown); at least one stays on
const pageKeys = ROBOT_PAGES as RobotPage[]
const pages = computed(() => robotPages(dev.value?.settings?.pages))

async function setPage(key: RobotPage, on: boolean) {
  if (!dev.value || (!on && isLastPageOn(pages.value, key)))
    return
  dev.value.settings.pages = { ...pages.value, [key]: on } as Record<RobotPage, boolean> // optimistic; replaced by the server response
  await save({ settings: { pages: { [key]: on } } })
}
</script>

<template>
  <view v-if="dev">
    <view class="nx-group">
      <view class="nx-group__header">
        {{ t('companion.robot.title') }}
      </view>
      <view class="nx-group__body">
        <view class="nx-row robot__field">
          <view class="robot__label">
            {{ t('companion.robot.name') }}
          </view>
          <wd-input v-model="name" :maxlength="32" clearable no-border placeholder="TinyBot" custom-class="robot__input" @input="namesDirty = true" />
        </view>
        <view class="nx-row robot__field">
          <view class="robot__label">
            {{ t('companion.robot.owner') }}
          </view>
          <wd-input v-model="owner" :maxlength="32" clearable no-border placeholder="Mim" custom-class="robot__input" @input="namesDirty = true" />
        </view>
      </view>
      <view class="nx-group__footer">
        {{ t('companion.robot.ownerHint') }}
      </view>
      <view class="robot__save">
        <wd-button block :loading="savingNames" :disabled="!namesDirty" @click="saveNames">
          {{ t('companion.save') }}
        </wd-button>
      </view>
    </view>

    <view class="nx-group">
      <view class="nx-group__header">
        {{ t('companion.sound.title') }}
      </view>
      <view class="nx-group__body">
        <view class="nx-row">
          <view class="nx-row__main nx-row__title">
            {{ t('companion.sound.fromPhone') }}
          </view>
          <wd-switch :model-value="fromPhone" size="24px" @change="({ value }) => setFromPhone(!!value)" />
        </view>
        <view class="nx-row robot__volume">
          <view class="robot__volume-head">
            <view class="nx-row__title" :class="{ robot__muted: !fromPhone }">
              {{ t('companion.volume') }}
            </view>
            <view class="nx-row__value nx-num">
              {{ fromPhone ? `${volume}%` : t('companion.sound.auto') }}
            </view>
          </view>
          <view class="nx-num robot__now" aria-live="polite">
            {{ robotNowText }}
          </view>
          <wd-slider
            v-model="volume"
            :min="0"
            :max="100"
            :step="5"
            hide-label
            hide-min-max
            :disabled="!fromPhone"
            @dragend="onVolumeEnd"
          />
        </view>
        <view class="nx-row">
          <view class="nx-row__main nx-row__title">
            {{ t('companion.sound.sounds') }}
          </view>
          <wd-switch :model-value="!!dev.settings?.sounds" size="24px" @change="({ value }) => setSounds(!!value)" />
        </view>
      </view>
      <view class="nx-group__footer nx-mono nx-break">
        {{ t('companion.robot.id', { id: dev.id }) }}
      </view>
    </view>

    <view class="nx-group">
      <view class="nx-group__header">
        {{ t('companion.display.title') }}
      </view>
      <view class="nx-group__body">
        <view class="nx-row robot__minutes">
          <view class="nx-row__title">
            {{ t('companion.display.dimAfter') }}
          </view>
          <MinutesChips
            ref="dimChips"
            :model-value="display.dim_after_min"
            :presets="DIM_PRESETS"
            :max="DISPLAY_MAX.dim_after_min"
            :zero-label="t('companion.display.never')"
            @update:model-value="(v: number) => setDisplay('dim_after_min', v)"
          />
        </view>
        <view class="nx-row robot__minutes">
          <view class="nx-row__title">
            {{ t('companion.display.offAfter') }}
          </view>
          <MinutesChips
            ref="offChips"
            :model-value="display.off_after_min"
            :presets="OFF_PRESETS"
            :max="DISPLAY_MAX.off_after_min"
            :zero-label="t('companion.display.never')"
            @update:model-value="(v: number) => setDisplay('off_after_min', v)"
          />
        </view>
      </view>
      <view class="nx-group__footer">
        {{ t('companion.display.hint') }}
      </view>
      <view class="robot__save robot__save-row">
        <wd-button v-if="displayDirty" type="info" @click="revertDisplay">
          {{ t('companion.revert') }}
        </wd-button>
        <wd-button block :loading="savingDisplay" :disabled="!displayDirty" @click="saveDisplay">
          {{ t('companion.save') }}
        </wd-button>
      </view>
    </view>

    <view class="nx-group">
      <view class="nx-group__header">
        {{ t('companion.proactive.title') }}
      </view>
      <view class="nx-group__body">
        <view class="nx-row">
          <view class="nx-row__main">
            <view class="nx-row__title">
              {{ t('companion.proactive.enabled') }}
            </view>
            <view class="nx-row__subtitle">
              {{ t('companion.proactive.intro') }}
            </view>
          </view>
          <wd-switch :model-value="proactive.enabled" size="24px" @change="({ value }) => setProactive({ enabled: !!value })" />
        </view>
        <template v-for="row in proactiveRows" :key="row.on">
          <view class="nx-row">
            <view class="nx-row__main nx-row__title" :class="{ robot__muted: !proactive.enabled }">
              {{ t(row.label) }}
            </view>
            <wd-switch
              :model-value="proactive[row.on]"
              size="22px"
              :disabled="!proactive.enabled"
              @change="({ value }) => setProactive({ [row.on]: !!value })"
            />
          </view>
          <wd-datetime-picker
            :model-value="proactive[row.time]"
            type="time"
            :label="t(row.timeLabel)"
            :disabled="!proactive.enabled || !proactive[row.on]"
            :cancel-button-text="t('common.cancel')"
            :confirm-button-text="t('common.confirm')"
            custom-class="cmp-picker"
            @confirm="({ value }) => onProactiveTime(row.time, value)"
          />
        </template>
      </view>
      <view class="nx-group__footer">
        {{ t('companion.proactive.hint') }}
      </view>
      <view class="robot__save robot__save-row">
        <wd-button v-if="proactiveDirty" type="info" @click="revertProactive">
          {{ t('companion.revert') }}
        </wd-button>
        <wd-button block :loading="savingProactive" :disabled="!proactiveDirty" @click="saveProactive">
          {{ t('companion.save') }}
        </wd-button>
      </view>
    </view>

    <MemoryGroup />

    <FirmwareGroup />

    <view class="nx-group">
      <view class="nx-group__header">
        {{ t('companion.pages.title') }}
      </view>
      <view class="nx-group__body">
        <view v-for="p in pageKeys" :key="p" class="nx-row">
          <view class="nx-row__main">
            <view class="nx-row__title">
              {{ t(`companion.pages.${p}`) }}
            </view>
            <view class="nx-row__subtitle">
              {{ t(`companion.pages.${p}Hint`) }}
            </view>
            <view v-if="isLastPageOn(pages, p)" class="robot__hint nx-caption">
              {{ t('companion.pages.lastOn') }}
            </view>
          </view>
          <wd-switch
            :model-value="pages[p]"
            size="22px"
            :disabled="isLastPageOn(pages, p)"
            @change="({ value }) => setPage(p, !!value)"
          />
        </view>
      </view>
      <view class="nx-group__footer">
        {{ t('companion.pages.footer') }}
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.robot {
  &__field {
    flex-direction: column;
    align-items: stretch;
    gap: 4rpx;
  }

  &__label {
    font-size: var(--nx-text-footnote);
    color: var(--nx-text-2);
  }

  &__save {
    margin-top: var(--nx-space-3);
  }

  &__volume {
    flex-direction: column;
    align-items: stretch;
    gap: var(--nx-space-1);
  }

  &__volume-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__muted {
    color: var(--nx-text-3);
  }

  &__now {
    font-size: var(--nx-text-footnote);
    color: var(--nx-text-2);
  }

  &__minutes {
    flex-direction: column;
    align-items: stretch;
    gap: var(--nx-space-2);
  }

  &__save-row {
    display: flex;
    gap: var(--nx-space-2);
  }

  &__hint {
    margin-top: 4rpx;
  }
}

:deep(.robot__input) {
  padding: 0;
  background: transparent;
}
</style>
