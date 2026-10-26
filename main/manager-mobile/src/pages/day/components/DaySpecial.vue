<script lang="ts" setup>
import type { RememberDay, RememberKind } from '@/api/companion'
import { computed, ref } from 'vue'
import { t } from '@/i18n'
import { tbConfirm } from '@/utils/tbConfirm'
import { toast } from '@/utils/toast'
import { useDay } from '../dayContext'
import { calendarOf, daysUntil, MAX_DAY_NAME, MAX_REMEMBER, monthDay, REMEMBER_KINDS, rememberProblem, sortRemember } from '../dayVoiceModel.mjs'
import DayField from './DayField.vue'

// Special days: what today is (from the server), the switch, and the family's days to remember
// (sent as the whole list). National days and Eid are not entered here.
const day = useDay()
const cal = computed(() => calendarOf(day.view))
const list = computed<RememberDay[]>(() => sortRemember(cal.value.remember) as RememberDay[])
const special = computed(() => day.view?.today_special || null)
const open = ref(false)
const error = ref('')
const form = ref({ name: '', month: 1, date: 1, kind: 'birthday' as RememberKind })

function locale() {
  return day.lang() === 'bn' ? 'bn-BD' : 'en-GB'
}
const months = computed(() => Array.from({ length: 12 }, (_, i) => {
  try {
    return new Intl.DateTimeFormat(locale(), { month: 'long' }).format(new Date(2024, i, 1))
  }
  catch {
    return String(i + 1)
  }
}))
const dates = computed(() => Array.from({ length: 31 }, (_, i) => day.num(i + 1)))
const kindOptions = computed(() => (REMEMBER_KINDS as string[]).map(k => ({ value: k, label: t(`dayVoice.days.kind.${k}`) })))

function dateText(mmdd: string) {
  const m = Number(mmdd.slice(0, 2))
  const d = Number(mmdd.slice(3))
  try {
    return new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'long' }).format(new Date(2024, m - 1, d))
  }
  catch {
    return mmdd
  }
}
function whenText(mmdd: string) {
  const n = daysUntil(mmdd, new Date())
  return n === 0 ? t('dayVoice.days.isToday') : t('dayVoice.days.inDays', { n: day.num(n) })
}
function specialName() {
  const s = special.value
  if (!s)
    return ''
  return day.lang() === 'bn' ? s.name_bn : s.name_en
}
function strip(d: RememberDay): RememberDay {
  return { id: d.id, date: d.date, name: d.name, kind: d.kind }
}

async function setEnabled(v: boolean) {
  await day.save({ settings: { calendar: { special_days: v } } }, 'days')
}
function openAdd() {
  if (list.value.length >= MAX_REMEMBER) {
    toast.warning(t('dayVoice.days.max', { n: day.num(MAX_REMEMBER) }))
    return
  }
  form.value = { name: '', month: new Date().getMonth() + 1, date: new Date().getDate(), kind: 'birthday' }
  error.value = ''
  open.value = true
}
async function submit() {
  const item = { name: form.value.name.trim(), date: monthDay(form.value.month, form.value.date) || 'xx', kind: form.value.kind }
  const problem = rememberProblem(item)
  if (problem) {
    error.value = t(problem)
    toast.warning(error.value)
    return
  }
  error.value = ''
  const next = [...list.value.map(strip), item as RememberDay]
  if (await day.save({ settings: { calendar: { remember: next } } }, 'days'))
    open.value = false
}
async function remove(d: RememberDay) {
  const ok = await tbConfirm({ title: t('dayVoice.days.deleteTitle'), message: t('dayVoice.days.confirmDelete', { name: d.name }), confirmText: t('common.delete'), danger: true })
  if (ok)
    await day.save({ settings: { calendar: { remember: list.value.filter(x => x.id !== d.id).map(strip) } } }, 'days', t('day.deleted'))
}
defineExpose({ add: openAdd })
</script>

<template>
  <tb-section :title="t('day.tab.days')" :description="t('dayVoice.days.desc')" ink="look">
    <template #actions>
      <tb-sync v-bind="day.syncOf('days')" />
    </template>

    <view class="vtoday" :class="{ 'is-none': !special }">
      <text class="vtoday__k">
        {{ t('dayVoice.days.today') }}
      </text>
      <text class="vtoday__v">
        {{ special ? specialName() : t('dayVoice.days.todayNone') }}
      </text>
    </view>
    <view class="dswitches">
      <tb-switch :model-value="cal.special_days" :disabled="!!day.saving.days" :label="t('dayVoice.days.switch')" ink="look" @change="setEnabled" />
    </view>
    <text class="dnote">
      {{ t('dayVoice.days.national') }}
    </text>

    <view class="dgroup vdays">
      <view class="vdays__head">
        <text class="dsub">
          {{ t('dayVoice.days.remember') }}
        </text>
        <text class="dnote">
          {{ t('dayVoice.days.rememberDesc', { n: day.num(list.length), max: day.num(MAX_REMEMBER) }) }}
        </text>
      </view>
      <tb-empty v-if="!list.length" face="happy" :title="t('dayVoice.days.none')" :text="t('dayVoice.days.emptyText')" />
      <view v-else class="drows">
        <view v-for="d in list" :key="d.id" class="drow">
          <view class="drow__body">
            <text class="drow__title">
              {{ d.name }}
            </text>
            <text class="drow__meta">
              {{ dateText(d.date) }}, {{ t(`dayVoice.days.kind.${d.kind}`) }}, {{ whenText(d.date) }}
            </text>
          </view>
          <tb-button size="s" variant="quiet" icon="trash" :aria-label="t('dayVoice.days.delete', { name: d.name })" @click="remove(d)" />
        </view>
      </view>
      <view class="dfoot">
        <tb-button variant="primary" icon="plus" :disabled="list.length >= MAX_REMEMBER" @click="openAdd">
          {{ t('dayVoice.days.add') }}
        </tb-button>
      </view>
    </view>

    <tb-sheet v-model:open="open" :title="t('dayVoice.days.add')">
      <DayField :label="t('dayVoice.days.name')">
        <tb-input v-model="form.name" :maxlength="MAX_DAY_NAME" clearable :placeholder="t('dayVoice.days.namePlaceholder')" :aria-label="t('dayVoice.days.name')" />
      </DayField>
      <view class="dpair">
        <DayField :label="t('dayVoice.days.month')">
          <picker mode="selector" :range="months" :value="form.month - 1" @change="(e: any) => form.month = Number(e.detail.value) + 1">
            <view class="dtime" role="button" :aria-label="t('dayVoice.days.month')">
              <text>{{ months[form.month - 1] }}</text>
              <tb-icon name="chevron-down" :size="16" />
            </view>
          </picker>
        </DayField>
        <DayField :label="t('dayVoice.days.day')" :error="error">
          <picker mode="selector" :range="dates" :value="form.date - 1" @change="(e: any) => form.date = Number(e.detail.value) + 1">
            <view class="dtime" role="button" :aria-label="t('dayVoice.days.day')">
              <text class="tb-num">
                {{ day.num(form.date) }}
              </text>
              <tb-icon name="chevron-down" :size="16" />
            </view>
          </picker>
        </DayField>
      </view>
      <DayField :label="t('dayVoice.days.kindLabel')">
        <tb-choice v-model="form.kind" wrap :options="kindOptions" :aria-label="t('dayVoice.days.kindLabel')" />
      </DayField>
      <template #footer>
        <tb-button variant="primary" :loading="!!day.saving.days" @click="submit">
          {{ t('common.save') }}
        </tb-button>
      </template>
    </tb-sheet>
  </tb-section>
</template>

<style lang="scss">
.vdays {
  padding-top: 16px;
}
.vdays__head {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-bottom: 6px;
}
.vtoday {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 0 14px;
  border-bottom: 1px solid var(--tb-rule);
}
.vtoday__k {
  font-size: 12px;
  font-weight: 600;
  color: var(--tb-action);
}
.vtoday__v {
  font-family: var(--tb-font-display);
  font-weight: 800;
  font-size: 28px;
  line-height: 1.25;
  color: var(--tb-look);
  overflow-wrap: anywhere;
}
.vtoday.is-none .vtoday__v {
  font-size: 18px;
  font-weight: 700;
  color: var(--tb-ink-2);
}
</style>
