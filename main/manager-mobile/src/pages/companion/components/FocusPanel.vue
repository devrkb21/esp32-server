<script lang="ts" setup>
import type { PomodoroConfig } from '@/api/companion'
import { computed, ref, watch } from 'vue'
import { t } from '@/i18n'
import { clampInt } from '../companionUtils.mjs'
import { useCompanion } from './context'

defineOptions({
  name: 'CompanionFocusPanel',
})

const { dev, save, command } = useCompanion()

const draft = ref<PomodoroConfig>({ work_min: 25, short_break_min: 5, long_break_min: 15, rounds: 4 })
const dirty = ref(false)
const saving = ref(false)
const starting = ref(false)

// follow the server values until the user edits something
watch(() => dev.value?.pomodoro, (p) => {
  if (p && !dirty.value)
    draft.value = { ...p }
}, { immediate: true, deep: true })

const doneToday = computed(() => dev.value?.stats?.pomodoros_today ?? 0)

function clean(): PomodoroConfig {
  const p = draft.value
  return {
    work_min: clampInt(p.work_min, 1, 120, 25),
    short_break_min: clampInt(p.short_break_min, 1, 60, 5),
    long_break_min: clampInt(p.long_break_min, 1, 90, 15),
    rounds: clampInt(p.rounds, 1, 12, 4),
  }
}

async function submit() {
  saving.value = true
  const ok = await save({ pomodoro: clean() })
  saving.value = false
  if (ok)
    dirty.value = false
}

async function startNow() {
  starting.value = true
  await command('pomodoro', String(clean().work_min), t('companion.focus.started'))
  starting.value = false
}
</script>

<template>
  <view v-if="dev">
    <view class="nx-group">
      <view class="nx-group__header">
        {{ t('companion.focus.title') }}
      </view>
      <view class="nx-group__body">
        <view class="nx-row cmp-stepper-row">
          <view class="nx-row__main nx-row__title">
            {{ t('companion.focus.work') }}
          </view>
          <wd-input-number v-model="draft.work_min" :min="1" :max="120" input-width="50" @change="dirty = true" />
        </view>
        <view class="nx-row cmp-stepper-row">
          <view class="nx-row__main nx-row__title">
            {{ t('companion.focus.shortBreak') }}
          </view>
          <wd-input-number v-model="draft.short_break_min" :min="1" :max="60" input-width="50" @change="dirty = true" />
        </view>
        <view class="nx-row cmp-stepper-row">
          <view class="nx-row__main nx-row__title">
            {{ t('companion.focus.longBreak') }}
          </view>
          <wd-input-number v-model="draft.long_break_min" :min="1" :max="90" input-width="50" @change="dirty = true" />
        </view>
        <view class="nx-row cmp-stepper-row">
          <view class="nx-row__main nx-row__title">
            {{ t('companion.focus.rounds') }}
          </view>
          <wd-input-number v-model="draft.rounds" :min="1" :max="12" input-width="50" @change="dirty = true" />
        </view>
      </view>
      <view class="nx-group__footer">
        {{ t('companion.focus.hint', { rounds: draft.rounds, done: doneToday }) }}
      </view>
    </view>

    <view class="focus__actions">
      <wd-button block size="large" :loading="starting" @click="startNow">
        {{ t('companion.focus.startNow') }}
      </wd-button>
      <wd-button block type="info" :loading="saving" @click="submit">
        {{ t('companion.save') }}
      </wd-button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.focus__actions {
  display: flex;
  flex-direction: column;
  gap: var(--nx-space-2);
}
</style>
