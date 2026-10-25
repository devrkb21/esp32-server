<script lang="ts" setup>
import type { ProactiveSettings } from '@/api/companion'
import { ref, watch } from 'vue'
import { t } from '@/i18n'
import { isHHMM, proactiveProblem, proactiveSettings } from '@/utils/companionUtils.mjs'
import { toast } from '@/utils/toast'
import { useDay } from '../dayContext'
import DayField from './DayField.vue'
import DayTime from './DayTime.vue'

// Proactive talk (settings.proactive): TinyBot greets in the morning and asks about the day in
// the evening. A draft that follows the server until edited, saved with Save (legacy).
const PARTS = [
  { on: 'morning_on', time: 'morning', label: 'day.talk.morning', timeLabel: 'day.talk.morningAt' },
  { on: 'evening_on', time: 'evening', label: 'day.talk.evening', timeLabel: 'day.talk.eveningAt' },
] as const

const day = useDay()
const draft = ref<ProactiveSettings>(proactiveSettings(undefined) as ProactiveSettings)
const dirty = ref(false)
const focused = ref('')
watch(() => day.view?.settings?.proactive, (p) => {
  if (!dirty.value)
    draft.value = proactiveSettings(p) as ProactiveSettings
}, { immediate: true, deep: true })

function set(patch: Partial<ProactiveSettings>) {
  draft.value = { ...draft.value, ...patch }
  const saved = proactiveSettings(day.view?.settings?.proactive) as ProactiveSettings
  dirty.value = (Object.keys(saved) as (keyof ProactiveSettings)[]).some(k => saved[k] !== draft.value[k])
}
function onTime(key: 'morning' | 'evening', value: string) {
  if (isHHMM(value))
    set({ [key]: value })
}
function undo() {
  dirty.value = false
  draft.value = proactiveSettings(day.view?.settings?.proactive) as ProactiveSettings
}
async function submit() {
  const problem = proactiveProblem(draft.value)
  if (problem) {
    toast.warning(t(`day.talk.${problem}`))
    return
  }
  if (await day.save({ settings: { proactive: { ...draft.value } } }, 'talk'))
    dirty.value = false
}
function focusKey(key: string) {
  if (!key.startsWith('talk-'))
    return false
  focused.value = key.slice(5)
  setTimeout(() => { focused.value = '' }, 1600)
  return true
}
defineExpose({ focusKey })
</script>

<template>
  <tb-section :title="t('day.talk.title')" :description="t('day.talk.intro')" ink="message">
    <template #actions>
      <tb-sync v-bind="day.syncOf('talk')" />
    </template>

    <tb-switch :model-value="draft.enabled" :label="t('day.talk.enabled')" @change="(v: boolean) => set({ enabled: v })" />
    <view class="drows" :class="{ 'is-dim': !draft.enabled }">
      <view v-for="p in PARTS" :key="p.on" class="drow drow--talk" :class="{ 'is-focus': focused === p.time }">
        <view class="drow__body">
          <tb-switch :model-value="draft[p.on]" :disabled="!draft.enabled" :label="t(p.label)" @change="(v: boolean) => set({ [p.on]: v })" />
        </view>
        <DayField class="drow__timefield">
          <DayTime
            :model-value="draft[p.time]" :disabled="!draft.enabled || !draft[p.on]" :aria-label="t(p.timeLabel)"
            @change="(v: string) => onTime(p.time, v)"
          />
        </DayField>
      </view>
    </view>
    <text class="dnote">
      {{ t('day.talk.hint') }}
    </text>

    <view class="dfoot">
      <text v-if="dirty" class="dfoot__unsaved" role="status">
        {{ t('common.unsaved') }}
      </text>
      <tb-button v-if="dirty" variant="quiet" @click="undo">
        {{ t('common.undo') }}
      </tb-button>
      <tb-button :variant="dirty ? 'primary' : 'secondary'" :disabled="!dirty" :loading="!!day.saving.talk" @click="submit">
        {{ t('common.save') }}
      </tb-button>
    </view>
  </tb-section>
</template>

<style lang="scss">
.drow--talk {
  align-items: center;
}
.drow__timefield {
  width: 128px;
  flex: none;
}
</style>
