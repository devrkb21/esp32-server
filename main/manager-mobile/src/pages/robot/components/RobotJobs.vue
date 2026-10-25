<script lang="ts" setup>
import type { CommandType, CompanionCommand } from '@/api/companion'
import { computed, ref } from 'vue'
import { t } from '@/i18n'
import { commandLabel, focusMinutes, GAMES, jobArg, JOBS, MAX_TOPIC, STOP_JOB } from '../robotModel.mjs'
import { useRobot } from './context'

// Jobs: a story with an optional topic, the quick jobs and the games as outline pills, stop, and
// the last commands sent with whether TinyBot did them (as in the legacy Actions panel).
defineOptions({ name: 'RobotJobs' })

const r = useRobot()
const topic = ref('')
const focusMin = computed(() => focusMinutes(r.view.value))
const recent = computed<CompanionCommand[]>(() => (r.view.value?.commands || []).slice(0, 8))

function keyOf(type: string, arg: string) {
  return `${type}:${arg}`
}
function isBusy(type: string, arg: string) {
  return r.busy.value === keyOf(type, arg)
}

function runJob(job: typeof JOBS[number] | typeof STOP_JOB) {
  const arg = jobArg(job, r.view.value)
  const ok = (job as any).focus ? t('mrobot.jobs.focusStarted', { n: r.num(focusMin.value) }) : undefined
  r.command(job.type as CommandType, arg, ok)
}
function runGame(game: string) {
  r.command('game', game, t('mrobot.jobs.gameStarting', { game: t(`companion.game.${game}`) }))
}
async function tellStory() {
  if (await r.command('story', topic.value.trim().slice(0, MAX_TOPIC), t('companion.act.storySent')))
    topic.value = ''
}

function name(c: CompanionCommand) {
  const key = commandLabel(c)
  const base = key ? t(key) : c.type
  if (c.type === 'story' && c.arg)
    return `${base}: ${c.arg}`
  if (c.type === 'pomodoro' && c.arg)
    return `${base} (${t('mrobot.minutes', { n: r.num(Number(c.arg)) })})`
  return base
}
</script>

<template>
  <tb-section :title="t('mrobot.sec.jobs')" :description="t('mrobot.jobs.desc')">
    <text v-if="!r.online.value" class="rb-note" role="status">
      {{ t('mrobot.jobs.offlineHint') }}
    </text>

    <view class="rbj-story">
      <text class="rbj-label">
        {{ t('companion.act.story') }}
      </text>
      <tb-input
        v-model="topic" :maxlength="MAX_TOPIC" clearable confirm-type="send" :placeholder="t('mrobot.jobs.storyTopic')"
        :aria-label="t('companion.act.story')" @confirm="tellStory"
      />
      <tb-button icon="story" block :loading="r.busy.value.startsWith('story:')" :disabled="!!r.busy.value && !r.busy.value.startsWith('story:')" @click="tellStory">
        {{ t('companion.act.storyStart') }}
      </tb-button>
    </view>

    <view class="rbj-group" role="group" :aria-label="t('mrobot.jobs.calm')">
      <text class="rbj-label">
        {{ t('mrobot.jobs.calm') }}
      </text>
      <view class="rbj-pills">
        <tb-button
          v-for="j in JOBS" :key="j.key" :icon="j.icon" :loading="isBusy(j.type, jobArg(j, r.view.value))"
          :disabled="!!r.busy.value && !isBusy(j.type, jobArg(j, r.view.value))" @click="runJob(j)"
        >
          {{ j.focus ? t('mrobot.jobs.focusFor', { n: r.num(focusMin) }) : t(j.label) }}
        </tb-button>
      </view>
    </view>

    <view class="rbj-group" role="group" :aria-label="t('companion.act.games')">
      <text class="rbj-label">
        {{ t('companion.act.games') }}
      </text>
      <view class="rbj-pills">
        <tb-button v-for="g in GAMES" :key="g" icon="game" :loading="isBusy('game', g)" :disabled="!!r.busy.value && !isBusy('game', g)" @click="runGame(g)">
          {{ t(`companion.game.${g}`) }}
        </tb-button>
      </view>
    </view>

    <view class="rbj-group">
      <tb-button variant="danger" :icon="STOP_JOB.icon" :loading="isBusy('stop', '')" :disabled="!!r.busy.value && !isBusy('stop', '')" @click="runJob(STOP_JOB)">
        {{ t(STOP_JOB.label) }}
      </tb-button>
    </view>

    <view class="rbj-recent">
      <view class="rb-sub">
        <text class="rb-sub__title">
          {{ t('mrobot.jobs.recent') }}
        </text>
      </view>
      <text v-if="!recent.length" class="rb-note rbj-recent__none">
        {{ t('mrobot.jobs.noCommands') }}
      </text>
      <view v-for="c in recent" :key="c.id" class="rbj-recent__row">
        <view class="rbj-recent__main">
          <text class="rbj-recent__name">
            {{ name(c) }}
          </text>
          <text class="rbj-recent__time">
            {{ r.ago(c.ts) }}
          </text>
        </view>
        <tb-sync :state="c.status === 'done' ? 'applied' : 'pending'" :text="c.status === 'done' ? t('companion.act.done') : t('companion.act.pending')" />
      </view>
    </view>
  </tb-section>
</template>

<style lang="scss">
@import './robot.scss';

.rbj-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--tb-ink-2);
}
.rbj-story {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.rbj-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.rbj-pills {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.rbj-recent {
  display: flex;
  flex-direction: column;
  margin-top: 6px;
}
.rbj-recent__none {
  padding: 12px 0;
}
.rbj-recent__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 0;
  border-bottom: 1px solid var(--tb-rule-soft);
}
.rbj-recent__main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}
.rbj-recent__name {
  font-size: 15px;
  overflow-wrap: anywhere;
}
.rbj-recent__time {
  font-size: 13px;
  color: var(--tb-ink-2);
}
</style>
