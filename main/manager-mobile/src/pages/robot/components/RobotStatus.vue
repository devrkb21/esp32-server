<script lang="ts" setup>
import type { CompanionEvent } from '@/api/companion'
import { computed, ref, watch } from 'vue'
import { getCompanionEvents } from '@/api/companion'
import { t } from '@/i18n'
import { nextPrayer } from '../../companion/companionUtils.mjs'
import { daysTogether, eventInk, faceMood, highScores, MAX_NAME, moodKey, reportedVolume, uptimeParts, volumeFromPhone, wifiQuality } from '../robotModel.mjs'
import { notifyError, useRobot } from './context'

// How it is now: the name plate (face, name, owner, online and last seen, days together; the name
// and owner name are edited in a sheet), a ruled table of what TinyBot reports, and its events.
defineOptions({ name: 'RobotStatus' })

const r = useRobot()
const v = computed(() => r.view.value)
const s = computed<Record<string, any>>(() => v.value?.stats || {})
const owner = computed(() => v.value?.settings?.owner_name || '')
const mood = computed(() => faceMood(v.value))
const together = computed(() => daysTogether(v.value, r.now.value))

const rows = computed(() => {
  const st = s.value
  const dash = '–'
  const has = (x: unknown) => x !== undefined && x !== null && x !== ''
  const mk = moodKey(st.mood)
  const vol = reportedVolume(v.value)
  const wifi = wifiQuality(st.rssi)
  const up = uptimeParts(st.uptime_s)
  const scores = highScores(st.high_scores)
  const w = v.value?.weather
  const p = v.value?.prayer?.enabled ? nextPrayer(v.value?.prayer?.days) : null
  const out = [
    { key: 'mood', label: t('mrobot.status.mood'), value: mk ? t(mk) : (st.mood || dash), note: stateText(st.state) },
    { key: 'wifi', label: t('mrobot.status.wifi'), value: wifi ? t(`mrobot.status.wifi.${wifi}`) : dash, note: has(st.rssi) && st.rssi ? `${r.num(st.rssi)} dBm` : '' },
    { key: 'fw', label: t('mrobot.status.firmware'), value: st.fw || dash, note: '' },
    { key: 'uptime', label: t('mrobot.status.uptime'), value: up ? (up.d ? t('mrobot.status.uptimeDays', { d: r.num(up.d), h: r.num(up.h) }) : t('mrobot.status.uptimeHours', { h: r.num(up.h), m: r.num(up.m) })) : dash, note: '' },
    { key: 'volume', label: t('mrobot.status.volume'), value: vol === null ? dash : `${r.num(vol)}%`, note: volumeFromPhone(v.value) ? t('mrobot.status.volumeManual') : t('mrobot.status.volumeAuto') },
    { key: 'bond', label: t('mrobot.status.bond'), value: has(st.bond_score) ? r.num(st.bond_score) : dash, note: has(st.bond_level) ? t('mrobot.status.bondLevel', { level: r.num(st.bond_level) }) : '' },
    { key: 'streak', label: t('mrobot.status.streak'), value: t('mrobot.status.days', { n: r.num(st.streak || 0) }), note: '' },
    { key: 'focus', label: t('mrobot.status.focusToday'), value: r.num(st.pomodoros_today ?? 0), note: '' },
    { key: 'touch', label: t('mrobot.status.lastTouch'), value: has(st.last_touch_s) && v.value?.stats_updated ? r.ago(v.value.stats_updated - Number(st.last_touch_s)) : dash, note: '' },
    { key: 'scores', label: t('mrobot.status.highScores'), value: scores.length ? scores.map(x => `${gameName(x.game)} ${r.num(x.value)}${x.ms ? ' ms' : ''}`).join(', ') : dash, note: '' },
    { key: 'ip', label: t('mrobot.status.ip'), value: st.ip || dash, note: '' },
    { key: 'id', label: t('mrobot.status.id'), value: v.value?.id || dash, note: '' },
    { key: 'weather', label: t('mrobot.status.weather'), value: w?.ok ? `${r.num(w.temp)}° ${w.text || ''}`.trim() : t('mrobot.status.noWeather'), note: w?.ok ? [w.city, t('mrobot.status.weatherDetail', { hi: r.num(w.hi ?? '–'), lo: r.num(w.lo ?? '–'), rain: r.num(w.rain_prob ?? 0) })].filter(Boolean).join(', ') : '' },
  ]
  if (p)
    out.push({ key: 'prayer', label: t('mrobot.status.nextPrayer'), value: `${t(`today.prayer.${p.key}`)} ${r.time(p.time)}`, note: p.tomorrow ? t('mrobot.status.tomorrow') : '' })
  return out
})

// the firmware's state word (idle, listening...) in plain words; an unknown one is left out
function hasKey(key: string) {
  const v = t(key)
  return !!v && v !== key
}
function stateText(state: unknown) {
  return state && hasKey(`mrobot.state.${state}`) ? t(`mrobot.state.${state}`) : ''
}

function gameName(g: string) {
  return r.tOr(`companion.game.${g}`, g)
}

// ------------------------------------------------------------------ events
// The view carries the latest ones; "show more" loads up to 50 from the events endpoint
const moreEvents = ref<CompanionEvent[] | null>(null)
const loadingMore = ref(false)
const events = computed(() => moreEvents.value || (v.value?.events || []).slice(0, 12))
watch(() => v.value?.events?.[0]?.rx, () => {
  moreEvents.value = null
})

async function showMore() {
  loadingMore.value = true
  try {
    const res = await getCompanionEvents(r.deviceId.value, 50)
    moreEvents.value = res?.events || []
  }
  catch (error) {
    notifyError(error)
  }
  loadingMore.value = false
}

function eventText(e: CompanionEvent) {
  let text = r.tOr(`mrobot.event.${e.type}`, e.type)
  if (e.type === 'pomodoro_done') {
    text += ` ${t('mrobot.event.rounds', { n: r.num(e.value ?? 0) })}`
  }
  else if (e.type === 'game_score') {
    text += `: ${gameName(e.id || '')} ${r.num(e.value ?? '')}`
  }
  else if (e.type === 'streak') {
    text += `: ${t('mrobot.status.days', { n: r.num(e.value ?? 0) })}`
  }
  else if (e.id && e.type.startsWith('alarm')) {
    const alarm = (v.value?.alarms || []).find(a => a.id === e.id)
    if (alarm)
      text += ` ${r.time(alarm.time)}`
  }
  else if (e.id && e.type.startsWith('reminder')) {
    const reminder = (v.value?.reminders || []).find(x => x.id === e.id)
    if (reminder?.label)
      text += `: ${reminder.label}`
  }
  return text
}
function inkOf(e: CompanionEvent) {
  const k = eventInk(e)
  return k ? { '--ink': `var(--tb-${k})` } : undefined
}

// ------------------------------------------------------------------ name and owner name
// drafts that follow the server until edited; saved together, like the legacy screen
const editing = ref(false)
const name = ref('')
const ownerName = ref('')
const dirty = computed(() => name.value !== (v.value?.name || '') || ownerName.value !== owner.value)
function openEdit() {
  name.value = v.value?.name || ''
  ownerName.value = owner.value
  editing.value = true
}
async function saveNames() {
  const ok = await r.save({
    name: name.value.trim().slice(0, MAX_NAME) || 'TinyBot',
    settings: { owner_name: ownerName.value.trim().slice(0, MAX_NAME) },
  }, 'robot')
  if (ok)
    editing.value = false
}
</script>

<template>
  <tb-section :title="t('mrobot.sec.status')" :description="t('mrobot.status.desc')">
    <template #actions>
      <tb-sync v-bind="r.syncOf('robot')" />
    </template>

    <view class="rbs-plate">
      <tb-face class="rbs-plate__face" :mood="mood" :alt="t('mrobot.status.faceAlt', { name: r.botName.value })" />
      <view class="rbs-plate__text">
        <text class="rbs-plate__name">
          {{ r.botName.value }}
        </text>
        <text v-if="owner" class="rbs-plate__owner">
          {{ t('mrobot.status.ownerIs', { name: owner }) }}
        </text>
        <tb-robot-status class="rbs-plate__state" compact :status="r.status.value" />
        <text class="rbs-plate__seen">
          {{ t('mrobot.status.seen', { when: r.ago(v?.last_seen) }) }}
        </text>
      </view>
    </view>
    <view class="rbs-plate__foot">
      <view v-if="together" class="rbs-days">
        <text class="tb-num rbs-days__n">
          {{ r.num(together) }}
        </text>
        <text class="rbs-days__l">
          {{ t('mrobot.status.daysTogether') }}
        </text>
      </view>
      <tb-button size="s" icon="edit" @click="openEdit">
        {{ t('mrobot.status.editName') }}
      </tb-button>
    </view>

    <view class="rbs-table" role="table" :aria-label="t('mrobot.status.tableCaption')">
      <view v-for="row in rows" :key="row.key" class="rbs-table__row" role="row">
        <text class="rbs-table__k" role="rowheader">
          {{ row.label }}
        </text>
        <view class="rbs-table__v" role="cell">
          <text class="rbs-table__value">
            {{ row.value }}
          </text>
          <text v-if="row.note" class="rbs-table__note">
            {{ row.note }}
          </text>
        </view>
      </view>
    </view>

    <view class="rbs-events">
      <view class="rb-sub">
        <text class="rb-sub__title">
          {{ t('mrobot.status.events') }}
        </text>
        <tb-button v-if="!moreEvents && (v?.events || []).length" size="s" variant="quiet" :loading="loadingMore" @click="showMore">
          {{ t('mrobot.status.moreEvents') }}
        </tb-button>
      </view>
      <text v-if="!events.length" class="rb-note rbs-events__none">
        {{ t('mrobot.status.noEvents') }}
      </text>
      <view v-for="(e, i) in events" :key="`${e.type}-${e.ts}-${i}`" class="rbs-events__row" :style="inkOf(e)">
        <view class="rbs-events__mark" />
        <text class="rbs-events__text">
          {{ eventText(e) }}
        </text>
        <text class="rbs-events__time">
          {{ r.ago(e.rx || e.ts) }}
        </text>
      </view>
    </view>

    <tb-sheet v-model:open="editing" :title="t('mrobot.status.editName')">
      <view class="rbs-field">
        <text class="rbs-field__label">
          {{ t('companion.robot.name') }}
        </text>
        <tb-input v-model="name" :maxlength="MAX_NAME" clearable placeholder="TinyBot" :aria-label="t('companion.robot.name')" />
      </view>
      <view class="rbs-field">
        <text class="rbs-field__label">
          {{ t('companion.robot.owner') }}
        </text>
        <tb-input v-model="ownerName" :maxlength="MAX_NAME" clearable :aria-label="t('companion.robot.owner')" />
        <text class="rb-note">
          {{ t('mrobot.status.ownerHint') }}
        </text>
      </view>
      <template #footer>
        <tb-button @click="editing = false">
          {{ t('common.cancel') }}
        </tb-button>
        <tb-button variant="primary" :disabled="!dirty" :loading="!!r.saving.robot" @click="saveNames">
          {{ t('common.save') }}
        </tb-button>
      </template>
    </tb-sheet>
  </tb-section>
</template>

<style lang="scss">
@import './robot.scss';

.rbs-plate {
  display: flex;
  gap: 14px;
  align-items: flex-start;
}
.rbs-plate__face {
  width: 42%;
  max-width: 200px;
  flex: none;
}
.rbs-plate__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}
.rbs-plate__name {
  font-family: var(--tb-font-display);
  font-weight: 800;
  font-size: 24px;
  line-height: 1.15;
  overflow-wrap: anywhere;
}
.rbs-plate__owner {
  font-size: 14px;
  color: var(--tb-ink-2);
  overflow-wrap: anywhere;
}
.rbs-plate__state {
  margin-top: 4px;
}
.rbs-plate__seen {
  font-size: 13px;
  color: var(--tb-ink-2);
}
.rbs-plate__foot {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.rbs-days {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.rbs-days__n {
  font-family: var(--tb-font-display);
  font-weight: 800;
  font-size: 44px;
  line-height: 1;
  letter-spacing: -0.01em;
}
.rbs-days__l {
  font-size: 14px;
  color: var(--tb-ink-2);
}

.rbs-table {
  display: flex;
  flex-direction: column;
  border-top: 3px solid var(--tb-rule);
}
.rbs-table__row {
  display: flex;
  gap: 12px;
  align-items: baseline;
  padding: 9px 0;
  border-bottom: 1px solid var(--tb-rule-soft);
}
.rbs-table__k {
  width: 40%;
  flex: none;
  font-size: 14px;
  font-weight: 600;
  color: var(--tb-ink-2);
}
.rbs-table__v {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.rbs-table__value {
  font-size: 15px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.rbs-table__note {
  font-size: 13px;
  color: var(--tb-ink-2);
}

.rbs-events {
  display: flex;
  flex-direction: column;
  margin-top: 6px;
}
.rbs-events__none {
  padding: 12px 0;
}
.rbs-events__row {
  --ink: var(--tb-ink-3);
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 9px 0;
  border-bottom: 1px solid var(--tb-rule-soft);
  font-size: 14px;
}
.rbs-events__mark {
  width: 8px;
  height: 8px;
  flex: none;
  background: var(--ink);
  transform: translateY(-1px);
}
.rbs-events__text {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
.rbs-events__time {
  flex: none;
  font-size: 13px;
  color: var(--tb-ink-2);
  white-space: nowrap;
}

.rbs-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rbs-field__label {
  font-size: 14px;
  font-weight: 600;
}
</style>
