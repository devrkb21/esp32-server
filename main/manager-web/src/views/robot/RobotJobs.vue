<template>
  <TbSection :title="$t('robot.sec.jobs')" :description="$t('robot.jobs.desc')">
    <p v-if="!robot.online" class="rb-note" role="status">{{ $t('companion.action.offlineHint') }}</p>

    <form class="rb-story" @submit.prevent="robot.sendStory()">
      <TbField :label="$t('companion.action.story')" for-id="rb-story">
        <div class="rb-story__line">
          <TbInput id="rb-story" v-model="robot.storyTopic" :maxlength="64" clearable :clear-label="$t('robot.jobs.clear')"
            :placeholder="$t('robot.jobs.storyTopic')" />
          <TbButton native-type="submit" icon="story" :loading="robot.busy === 'story'" :disabled="!!robot.busy && robot.busy !== 'story'">{{ $t('companion.action.tellStory') }}</TbButton>
        </div>
      </TbField>
    </form>

    <div class="rb-jobs">
      <div v-for="g in groups" :key="g.key" class="rb-jobs__group" role="group" :aria-labelledby="`rb-jobs-${g.key}`">
        <h3 :id="`rb-jobs-${g.key}`" class="rb-jobs__name">{{ $t(`robot.jobs.group.${g.key}`) }}</h3>
        <div class="rb-jobs__pills">
          <TbButton v-for="j in g.jobs" :key="j.key" :icon="j.icon" :variant="j.type === 'stop' ? 'danger' : 'secondary'"
            :loading="robot.busy === j.key" :disabled="!!robot.busy && robot.busy !== j.key" @click="robot.runJob(j)">
            {{ $t(j.label) }}<span v-if="j.focus" class="rb-jobs__extra tb-num">{{ $t('robot.jobs.minutes', { n: robot.num(focusMin) }) }}</span>
          </TbButton>
        </div>
        <p v-if="g.key === 'demo'" class="rb-note">{{ $t('robot.jobs.demoHint') }}</p>
      </div>
    </div>

    <div class="rb-recent">
      <h3 class="rb-sub">{{ $t('companion.action.recent') }}</h3>
      <p v-if="!recent.length" class="rb-note">{{ $t('companion.action.noCommands') }}</p>
      <ul v-else class="rb-recent__list">
        <li v-for="c in recent" :key="c.id">
          <span class="rb-recent__name">{{ name(c) }}</span>
          <time class="rb-recent__time">{{ robot.ago(c.ts) }}</time>
          <TbSync :state="c.status === 'done' ? 'applied' : 'pending'" :text="$t(c.status === 'done' ? 'companion.action.done' : 'companion.action.pending')" />
        </li>
      </ul>
    </div>
  </TbSection>
</template>

<script>
import { JOB_GROUPS, commandLabel, focusMinutes } from './robotModel';

// Jobs: a story with an optional topic, then the quick jobs as outline pills in groups (calm and
// care, games, the face shows, stop), and the last jobs sent with whether TinyBot did them.
export default {
  name: 'RobotJobs',
  inject: ['robot'],
  data() { return { groups: JOB_GROUPS }; },
  computed: {
    focusMin() { return focusMinutes(this.robot.view); },
    recent() { return this.robot.commands.slice(0, 10); },
  },
  methods: {
    name(c) {
      const key = commandLabel(c);
      const base = key ? this.$t(key) : c.type;
      if (c.type === 'story' && c.arg) return `${base}: ${c.arg}`;
      if (c.type === 'pomodoro' && c.arg) return `${base} (${this.$t('robot.jobs.minutes', { n: this.robot.num(Number(c.arg)) })})`;
      return base;
    },
  },
};
</script>

<style>
.rb-story__line { display: flex; gap: 8px; }
.rb-story__line .tb-input { flex: 1; min-width: 0; }
.rb-jobs { display: grid; gap: var(--tb-s5); grid-template-columns: minmax(0, 1fr); margin-top: var(--tb-s2); }
.rb-jobs__group { display: grid; gap: 10px; align-content: start; }
.rb-jobs__name { font-size: var(--tb-fs-14); font-family: var(--tb-font-text); font-weight: 600; color: var(--tb-ink-2); }
.rb-jobs__pills { display: flex; gap: 8px; flex-wrap: wrap; }
.rb-jobs__pills .tb-btn { min-height: 44px; }
.rb-jobs__extra { margin-left: 6px; font-weight: 400; color: inherit; opacity: .8; }
.rb-recent { display: grid; gap: var(--tb-s2); margin-top: var(--tb-s4); }
.rb-recent__list { list-style: none; margin: 0; padding: 0; }
.rb-recent__list li { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 12px; align-items: baseline; padding: 9px 0; border-bottom: 1px solid var(--tb-rule-soft); font-size: var(--tb-fs-14); }
.rb-recent__name { overflow-wrap: anywhere; }
.rb-recent__time { color: var(--tb-ink-2); font-size: var(--tb-fs-13); white-space: nowrap; }
@media (max-width: 480px) {
  .rb-story__line { flex-direction: column; }
  .rb-recent__list li { grid-template-columns: minmax(0, 1fr) auto; }
  .rb-recent__list .tb-sync { grid-column: 1 / -1; }
}
@media (min-width: 900px) {
  .rb-jobs { grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: var(--tb-s8); }
}
</style>
