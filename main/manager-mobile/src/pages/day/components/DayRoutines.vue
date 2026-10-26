<script lang="ts" setup>
import type { Routine, RoutineStep, RoutineStepType } from '@/api/companion'
import { computed, ref } from 'vue'
import { t } from '@/i18n'
import { tbConfirm } from '@/utils/tbConfirm'
import { toast } from '@/utils/toast'
import { useDay } from '../dayContext'
import { daysText } from '../dayModel.mjs'
import {
  COMMAND_PRESETS,
  MAX_PHRASE,
  MAX_ROUTINE_NAME,
  MAX_ROUTINES,
  MAX_SAY,
  MAX_SMART_HOME,
  MAX_STEPS,
  moveStep,
  newRoutine,
  NO_ARG_STEPS,
  routinePayload,
  routineProblem,
  STEP_TYPES,
  triggerText,
} from '../dayVoiceModel.mjs'
import DayField from './DayField.vue'
import DayTime from './DayTime.vue'
import DayWeek from './DayWeek.vue'

// Routines (scenes): the whole list goes to the server on every change; "run now" is the
// `routine` command, which the server runs itself.
const day = useDay()
const routines = computed<Routine[]>(() => day.view?.settings?.routines || [])
const library = computed(() => day.view?.library || [])
const open = ref(false)
const draft = ref<Routine>(newRoutine() as Routine)
const error = ref('')
const isNew = computed(() => !draft.value.id)

const triggerOptions = computed(() => ['voice', 'time', 'tap'].map(v => ({ value: v, label: t(`dayVoice.trigger.${v}`) })))
const stepLabels = computed(() => (STEP_TYPES as string[]).map(s => t(`dayVoice.step.${s}`)))
const commandLabels = computed(() => (COMMAND_PRESETS as string[]).map(c => t(`dayVoice.command.${c}`)))
const itemLabels = computed(() => library.value.map(i => `${t(`dayVoice.library.kind.${i.kind}`)}: ${i.title}`))

function currentList(): Routine[] {
  return routines.value.map(r => routinePayload(r) as Routine)
}
function trigger(r: Routine) {
  const { key, params } = triggerText(r) as { key: string, params: Record<string, any> }
  if (key === 'dayVoice.trigger.atTime')
    return t(key, { time: day.fmt(params.time), days: daysText(params.days, (k: string) => t(k)) })
  return t(key, params)
}
function stepsText(r: Routine) {
  return t('dayVoice.routine.steps', { n: day.num((r.steps || []).length) })
}
function itemTitle(id: string) {
  const it = library.value.find(i => i.id === id)
  return it ? it.title : ''
}

function openRoutine(r?: Routine) {
  if (!r && currentList().length >= MAX_ROUTINES) {
    toast.warning(t('dayVoice.routine.max', { n: day.num(MAX_ROUTINES) }))
    return
  }
  const base = r ? routinePayload(r) : newRoutine()
  draft.value = JSON.parse(JSON.stringify({ ...base, trigger: { time: '07:00', days: 127, phrase: '', ...base.trigger } }))
  error.value = ''
  open.value = true
}

function setStepType(i: number, e: any) {
  const type = STEP_TYPES[Number(e?.detail?.value ?? 0)] as RoutineStepType
  const arg = type === 'command' ? COMMAND_PRESETS[0] : type === 'play' ? (library.value[0]?.id || '') : ''
  draft.value.steps.splice(i, 1, { type, arg })
}
function setCommand(step: RoutineStep, e: any) {
  step.arg = COMMAND_PRESETS[Number(e?.detail?.value ?? 0)]
}
function setItem(step: RoutineStep, e: any) {
  step.arg = library.value[Number(e?.detail?.value ?? 0)]?.id || ''
}
function addStep() {
  if (draft.value.steps.length >= MAX_STEPS)
    return
  draft.value.steps.push({ type: 'weather', arg: '' })
}
function move(i: number, dir: number) {
  draft.value.steps = moveStep(draft.value.steps, i, dir) as RoutineStep[]
}
function removeStep(i: number) {
  draft.value.steps.splice(i, 1)
}

async function toggle(r: Routine, enabled: boolean) {
  const list = currentList().map(x => (x.id === r.id ? { ...x, enabled } : x))
  await day.save({ settings: { routines: list } }, 'routines', enabled ? t('dayVoice.routine.onMsg') : t('dayVoice.routine.offMsg'))
}

async function submit() {
  const problem = routineProblem(draft.value, library.value.map(i => i.id))
  if (problem) {
    error.value = t(problem)
    toast.warning(error.value)
    return
  }
  error.value = ''
  const item = routinePayload(draft.value) as Routine
  const list = currentList()
  const at = item.id ? list.findIndex(x => x.id === item.id) : -1
  if (at >= 0)
    list.splice(at, 1, item)
  else
    list.push(item)
  if (await day.save({ settings: { routines: list } }, 'routines'))
    open.value = false
}

async function remove(r: Routine) {
  const ok = await tbConfirm({ title: t('dayVoice.routine.deleteTitle'), message: t('dayVoice.routine.confirmDelete', { name: r.name }), confirmText: t('common.delete'), danger: true })
  if (!ok)
    return
  if (await day.save({ settings: { routines: currentList().filter(x => x.id !== r.id) } }, 'routines', t('day.deleted')))
    open.value = false
}

function run(r: Routine) {
  if (r.id)
    day.command('routine', r.id, t('dayVoice.routine.running'), `routine-${r.id}`)
}

defineExpose({ add: () => openRoutine() })
</script>

<template>
  <tb-section :title="t('day.tab.routines')" :description="t('dayVoice.routine.desc', { n: day.num(routines.length), max: day.num(MAX_ROUTINES) })" ink="routine">
    <template #actions>
      <tb-sync v-bind="day.syncOf('routines')" />
    </template>

    <tb-empty v-if="!routines.length" face="happy" :title="t('dayVoice.routine.none')" :text="t('dayVoice.routine.emptyText')" />
    <view v-else class="drows">
      <view v-for="r in routines" :key="r.id" class="drow vroutine" :class="{ 'is-off': !r.enabled }">
        <view class="drow__main" role="button" :aria-label="t('dayVoice.routine.edit')" hover-class="is-press" @click="openRoutine(r)">
          <view class="drow__body">
            <text class="drow__title">
              {{ r.name }}
            </text>
            <text class="drow__meta">
              {{ trigger(r) }}
            </text>
            <text class="drow__meta tb-num">
              {{ stepsText(r) }}
            </text>
          </view>
        </view>
        <view class="vroutine__acts">
          <tb-switch
            :model-value="!!r.enabled" :disabled="!!day.saving.routines" :label="t('dayVoice.routine.switch', { name: r.name })"
            class="drow__switch" @change="(v: boolean) => toggle(r, v)"
          />
          <tb-button size="s" variant="secondary" icon="play" :loading="day.busy === `routine-${r.id}`" @click="run(r)">
            {{ t('dayVoice.routine.run') }}
          </tb-button>
        </view>
      </view>
    </view>
    <view class="dfoot">
      <tb-button variant="primary" icon="plus" :disabled="routines.length >= MAX_ROUTINES" @click="openRoutine()">
        {{ t('dayVoice.routine.add') }}
      </tb-button>
    </view>

    <tb-sheet v-model:open="open" :title="isNew ? t('dayVoice.routine.add') : t('dayVoice.routine.edit')">
      <DayField :label="t('dayVoice.routine.name')">
        <tb-input v-model="draft.name" :maxlength="MAX_ROUTINE_NAME" clearable :placeholder="t('dayVoice.routine.namePlaceholder')" :aria-label="t('dayVoice.routine.name')" />
      </DayField>
      <DayField :label="t('dayVoice.routine.trigger')">
        <tb-choice v-model="draft.trigger.type" wrap :options="triggerOptions" :aria-label="t('dayVoice.routine.trigger')" />
      </DayField>
      <DayField v-if="draft.trigger.type === 'voice'" :label="t('dayVoice.routine.phrase')" :hint="t('dayVoice.routine.phraseHint', { phrase: (draft.trigger.phrase || draft.name || '').trim() })">
        <tb-input v-model="draft.trigger.phrase" :maxlength="MAX_PHRASE" clearable :aria-label="t('dayVoice.routine.phrase')" />
      </DayField>
      <block v-if="draft.trigger.type === 'time'">
        <DayField :label="t('dayVoice.routine.time')">
          <DayTime v-model="draft.trigger.time" big :aria-label="t('dayVoice.routine.time')" />
        </DayField>
        <DayField :label="t('day.days.label')">
          <DayWeek v-model="draft.trigger.days" />
        </DayField>
      </block>
      <text v-if="draft.trigger.type === 'tap'" class="dnote">
        {{ t('dayVoice.routine.tapNote') }}
      </text>

      <DayField :label="t('dayVoice.routine.stepsTitle')" :error="error">
        <view class="vsteps">
          <view v-for="(s, i) in draft.steps" :key="i" class="vstep">
            <view class="vstep__head">
              <text class="tb-num vstep__no">
                {{ day.num(i + 1) }}
              </text>
              <picker mode="selector" class="vstep__type" :range="stepLabels" :value="STEP_TYPES.indexOf(s.type)" @change="(e: any) => setStepType(i, e)">
                <view class="dtime" role="button" :aria-label="t('dayVoice.routine.stepNo', { n: day.num(i + 1) })">
                  <text class="vstep__typev">
                    {{ t(`dayVoice.step.${s.type}`) }}
                  </text>
                  <tb-icon name="chevron-down" :size="16" />
                </view>
              </picker>
            </view>
            <view v-if="!NO_ARG_STEPS.includes(s.type)" class="vstep__arg">
              <view v-if="s.type === 'say'" class="dsay">
                <textarea v-model="s.arg" class="dsay__el" :maxlength="MAX_SAY" auto-height :placeholder="t('dayVoice.routine.sayPlaceholder')" placeholder-class="dsay__ph" />
              </view>
              <picker v-else-if="s.type === 'command'" mode="selector" :range="commandLabels" :value="Math.max(0, COMMAND_PRESETS.indexOf(s.arg))" @change="(e: any) => setCommand(s, e)">
                <view class="dtime" role="button" :aria-label="t('dayVoice.routine.pickCommand')">
                  <text class="vstep__typev">
                    {{ COMMAND_PRESETS.includes(s.arg) ? t(`dayVoice.command.${s.arg}`) : t('dayVoice.routine.pickCommand') }}
                  </text>
                  <tb-icon name="chevron-down" :size="16" />
                </view>
              </picker>
              <picker v-else-if="s.type === 'play'" mode="selector" :range="itemLabels" :value="Math.max(0, library.findIndex(x => x.id === s.arg))" @change="(e: any) => setItem(s, e)">
                <view class="dtime" role="button" :aria-label="t('dayVoice.routine.pickItem')">
                  <text class="vstep__typev">
                    {{ itemTitle(s.arg) || t('dayVoice.routine.pickItem') }}
                  </text>
                  <tb-icon name="chevron-down" :size="16" />
                </view>
              </picker>
              <tb-input v-else v-model="s.arg" :maxlength="MAX_SMART_HOME" :placeholder="t('dayVoice.routine.smartHomePlaceholder')" :aria-label="t('dayVoice.routine.smartHome')" />
            </view>
            <view class="vstep__tools">
              <tb-button size="s" variant="quiet" icon="chevron-up" :disabled="i === 0" :aria-label="t('dayVoice.routine.stepUp')" @click="move(i, -1)" />
              <tb-button size="s" variant="quiet" icon="chevron-down" :disabled="i === draft.steps.length - 1" :aria-label="t('dayVoice.routine.stepDown')" @click="move(i, 1)" />
              <tb-button size="s" variant="quiet" icon="trash" :aria-label="t('dayVoice.routine.stepRemove')" @click="removeStep(i)" />
            </view>
          </view>
          <view class="drow drow--add" role="button" hover-class="is-press" :class="{ 'is-off': draft.steps.length >= MAX_STEPS }" @click="addStep">
            <tb-icon name="plus" :size="18" />
            <text>{{ t('dayVoice.routine.addStep') }}</text>
          </view>
        </view>
      </DayField>
      <tb-switch v-model="draft.enabled" :label="t('day.enabled')" />
      <template #footer>
        <tb-button v-if="!isNew" variant="danger" icon="trash" @click="remove(draft)">
          {{ t('common.delete') }}
        </tb-button>
        <tb-button variant="primary" :loading="!!day.saving.routines" @click="submit">
          {{ t('common.save') }}
        </tb-button>
      </template>
    </tb-sheet>
  </tb-section>
</template>

<style lang="scss">
.vroutine {
  align-items: flex-start;
}
.vroutine .drow__main {
  align-items: flex-start;
}
.vroutine__acts {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}
.vsteps {
  display: flex;
  flex-direction: column;
}
.vstep {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 0;
  border-top: 1px solid var(--tb-rule-soft);
}
.vstep__head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.vstep__no {
  flex: none;
  width: 1.6em;
  font-family: var(--tb-font-display);
  font-weight: 800;
  font-size: 20px;
  color: var(--tb-routine);
}
.vstep__type {
  flex: 1;
  min-width: 0;
}
.vstep__typev {
  flex: 1;
  min-width: 0;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.vstep__tools {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
}
</style>
