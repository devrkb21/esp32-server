<template>
  <TbSection :title="$t('robot.sec.status')" :description="$t('robot.status.desc')">
    <template #actions><TbSync v-bind="robot.syncOf('robot')" /></template>

    <div class="rb-status">
      <div class="rb-plate">
        <TbFace class="rb-plate__face" :mood="mood" :alt="$t('robot.status.faceAlt', { name: robot.botName })" />
        <div class="rb-plate__text">
          <p class="rb-plate__name">{{ robot.botName }}</p>
          <p v-if="owner" class="rb-plate__owner">{{ $t('robot.status.ownerIs', { name: owner }) }}</p>
          <p class="rb-plate__state" :class="{ 'is-off': !robot.online }">
            <i aria-hidden="true"></i>{{ robot.online ? $t('common.online') : $t('common.offline') }}
            <span>{{ $t('robot.status.seen', { when: robot.ago(view.last_seen) }) }}</span>
          </p>
          <p v-if="together" class="rb-plate__days">
            <b class="tb-num">{{ robot.num(together) }}</b> {{ $t('robot.status.daysTogether') }}
          </p>
          <TbButton v-if="!editing" size="s" icon="edit" class="rb-plate__edit" @click="editing = true">{{ $t('robot.status.editName') }}</TbButton>
        </div>

        <form v-if="editing" class="rb-plate__form" @submit.prevent="save">
          <TbField :label="$t('companion.robot.name')" for-id="rb-name">
            <TbInput id="rb-name" v-model="form.name" :maxlength="maxName" autocomplete="off" />
          </TbField>
          <TbField :label="$t('companion.robot.ownerName')" for-id="rb-owner" :hint="$t('companion.robot.ownerHint', { name: '{name}' })">
            <TbInput id="rb-owner" v-model="form.owner_name" :maxlength="maxName" autocomplete="off" />
          </TbField>
          <div class="rb-foot">
            <span v-if="robot.isDirty('robot')" class="rb-foot__unsaved">{{ $t('common.unsaved') }}</span>
            <TbButton variant="quiet" @click="cancel">{{ $t('common.cancel') }}</TbButton>
            <TbButton variant="primary" native-type="submit" :disabled="!robot.isDirty('robot')" :loading="!!robot.saving.robot">{{ $t('common.save') }}</TbButton>
          </div>
        </form>
      </div>

      <table class="rb-stats">
        <caption class="tb-visually-hidden">{{ $t('robot.status.tableCaption') }}</caption>
        <tbody>
          <tr v-for="r in rows" :key="r.key">
            <th scope="row">{{ r.label }}</th>
            <td>
              <span class="rb-stats__value">{{ r.value }}</span>
              <small v-if="r.note">{{ r.note }}</small>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="rb-events">
      <header class="rb-events__head">
        <h3 class="rb-sub">{{ $t('companion.status.events') }}</h3>
        <TbButton size="s" variant="quiet" :loading="robot.loadingEvents" @click="robot.loadMoreEvents()">{{ $t('companion.status.moreEvents') }}</TbButton>
      </header>
      <p v-if="!robot.events.length" class="rb-note">{{ $t('companion.status.noEvents') }}</p>
      <ol v-else class="rb-events__list">
        <li v-for="(e, i) in robot.events" :key="i + '-' + (e.rx || e.ts)" :style="ink(e)">
          <i class="rb-events__mark" aria-hidden="true"></i>
          <span class="rb-events__text">{{ eventText(e) }}</span>
          <time class="rb-events__time">{{ robot.ago(e.rx || e.ts) }}</time>
        </li>
      </ol>
    </div>
  </TbSection>
</template>

<script>
import { MAX_NAME, highScores } from '@/utils/companion.mjs';
import { daysTogether, eventInk, faceMood, moodKey, reportedVolume, uptimeParts, wifiQuality } from './robotModel';

// Status: the name plate (face, name, owner, online, days together; the name and owner name are
// edited here), a ruled table of what TinyBot reports, and its recent events.
export default {
  name: 'RobotStatus',
  inject: ['robot'],
  data() { return { editing: false, maxName: MAX_NAME }; },
  computed: {
    view() { return this.robot.view || {}; },
    form() { return this.robot.forms.robot; },
    s() { return this.robot.stats; },
    mood() { return faceMood(this.robot.view); },
    owner() { return (this.view.settings && this.view.settings.owner_name) || ''; },
    together() { return daysTogether(this.robot.view, this.robot.now); },
    rows() {
      const r = this.robot;
      const s = this.s;
      const t = (k, p) => this.$t(k, p);
      const dash = '–';
      const has = (v) => v !== undefined && v !== null && v !== '';
      const mk = moodKey(s.mood);
      const vol = reportedVolume(r.view);
      const manual = this.view.settings && this.view.settings.volume !== null && this.view.settings.volume !== undefined;
      const wifi = wifiQuality(s.rssi);
      const up = uptimeParts(s.uptime_s);
      const scores = highScores(s.high_scores);
      return [
        { key: 'mood', label: t('companion.status.mood'), value: mk ? t(mk) : (s.mood || dash), note: s.state ? t('robot.status.stateIs', { state: s.state }) : '' },
        { key: 'bond', label: t('companion.status.bond'), value: has(s.bond_score) ? r.num(s.bond_score) : dash,
          note: has(s.bond_level) ? t('companion.status.bondLevel', { level: r.num(s.bond_level) }) : '' },
        { key: 'streak', label: t('companion.status.streak'), value: t('companion.event.days', { n: r.num(s.streak || 0) }) },
        { key: 'focus', label: t('companion.status.pomodorosToday'), value: r.num(s.pomodoros_today || 0) },
        { key: 'volume', label: t('companion.status.volume'), value: vol === null ? dash : `${r.num(vol)}%`,
          note: manual ? t('companion.status.volumeManual') : t('companion.status.volumeAuto') },
        { key: 'wifi', label: t('companion.status.wifi'), value: has(s.rssi) && s.rssi ? `${r.num(s.rssi)} dBm` : dash,
          note: wifi ? t(`companion.status.wifi${wifi[0].toUpperCase()}${wifi.slice(1)}`) : '' },
        { key: 'ip', label: t('companion.status.ip'), value: s.ip || dash },
        { key: 'touch', label: t('companion.status.lastTouch'), value: has(s.last_touch_s) ? r.ago(r.now / 1000 - Number(s.last_touch_s || 0)) : dash },
        { key: 'scores', label: t('companion.status.highScores'),
          value: scores.length ? scores.map((x) => `${this.gameName(x.game)} ${r.num(x.value)}${x.ms ? ' ms' : ''}`).join(', ') : dash },
        { key: 'fw', label: t('companion.status.firmware'), value: s.fw || dash },
        { key: 'uptime', label: t('robot.status.uptime'),
          value: up ? (up.d ? t('robot.status.uptimeDays', r.nums(up)) : t('robot.status.uptimeHours', r.nums(up))) : dash },
      ];
    },
  },
  methods: {
    save() { this.robot.saveName(); },
    cancel() { this.robot.revertSection('robot'); this.editing = false; },
    gameName(g) { return this.robot.tOr(`companion.game.${g}`, g); },
    ink(e) { const k = eventInk(e); return k ? { '--ink': `var(--tb-${k})` } : null; },
    eventText(e) {
      const r = this.robot;
      let text = r.tOr(`companion.event.${e.type}`, e.type);
      if (e.type === 'pomodoro_done') text += ' ' + this.$t('companion.event.rounds', { n: r.num(e.value) });
      else if (e.type === 'game_score') text += ': ' + this.gameName(e.id) + ' ' + r.num(e.value);
      else if (e.type === 'streak') text += ': ' + this.$t('companion.event.days', { n: r.num(e.value) });
      else if (e.id && String(e.type).indexOf('alarm') === 0) {
        const alarm = (this.view.alarms || []).find((a) => a.id === e.id);
        if (alarm) text += ' ' + r.fmt(alarm.time);
      } else if (e.id && String(e.type).indexOf('reminder') === 0) {
        const reminder = (this.view.reminders || []).find((x) => x.id === e.id);
        if (reminder && reminder.label) text += ': ' + reminder.label;
      }
      return text;
    },
  },
  watch: {
    // a saved name closes the form
    'robot.saving.robot'(now, was) { if (was && !now && !this.robot.failed.robot) this.editing = false; },
  },
};
</script>

<style>
.rb-status { display: grid; gap: var(--tb-s6); grid-template-columns: minmax(0, 1fr); }
.rb-plate { display: grid; grid-template-columns: minmax(120px, 168px) minmax(0, 1fr); gap: var(--tb-s4); align-content: start; }
.rb-plate__face { align-self: start; }
.rb-plate__text { display: grid; gap: 4px; align-content: start; min-width: 0; }
.rb-plate__name { font-family: var(--tb-font-display); font-weight: 800; font-size: clamp(var(--tb-fs-24), 5vw, var(--tb-fs-32)); line-height: var(--tb-lh-tight); overflow-wrap: anywhere; }
.rb-plate__owner { font-size: var(--tb-fs-14); color: var(--tb-ink-2); overflow-wrap: anywhere; }
.rb-plate__state { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: var(--tb-fs-13); font-weight: 600; }
.rb-plate__state i { width: 8px; height: 8px; border-radius: 50%; background: var(--tb-ok); }
.rb-plate__state.is-off i { background: transparent; border: 1.5px solid var(--tb-ink-3); }
.rb-plate__state span { font-weight: 400; color: var(--tb-ink-2); }
.rb-plate__days { font-size: var(--tb-fs-14); color: var(--tb-ink-2); }
.rb-plate__days b { font-family: var(--tb-font-display); font-weight: 800; color: var(--tb-ink); font-size: var(--tb-fs-20); }
.rb-plate__edit { justify-self: start; margin-top: 6px; }
.rb-plate__form { grid-column: 1 / -1; display: grid; gap: var(--tb-s4); padding: var(--tb-s4) 0 0; border-top: 1px solid var(--tb-rule-soft);
  animation: rb-open var(--tb-t-row) var(--tb-ease); }
@keyframes rb-open { from { opacity: 0; transform: translateY(-4px); } }

.rb-stats { width: 100%; border-top: var(--tb-rule-band) solid var(--tb-rule); }
.rb-stats th, .rb-stats td { text-align: left; vertical-align: baseline; padding: 9px 0; border-bottom: 1px solid var(--tb-rule-soft); }
.rb-stats th { width: 42%; padding-right: var(--tb-s4); font-weight: 600; font-size: var(--tb-fs-14); color: var(--tb-ink-2); }
.rb-stats td { font-size: var(--tb-fs-15); overflow-wrap: anywhere; }
.rb-stats__value { font-weight: 600; }
.rb-stats td small { display: block; color: var(--tb-ink-2); font-size: var(--tb-fs-13); }

.rb-events { display: grid; gap: var(--tb-s2); margin-top: var(--tb-s4); }
.rb-events__head { display: flex; align-items: flex-end; justify-content: space-between; gap: var(--tb-s3); border-bottom: 1px solid var(--tb-rule); }
.rb-events__head .rb-sub { border-bottom: 0; }
.rb-events__list { list-style: none; margin: 0; padding: 0; }
.rb-events__list li { --ink: var(--tb-ink-3); display: grid; grid-template-columns: 9px minmax(0, 1fr) auto; gap: 12px; align-items: baseline;
  padding: 9px 0; border-bottom: 1px solid var(--tb-rule-soft); font-size: var(--tb-fs-14); }
.rb-events__mark { width: 9px; height: 9px; background: var(--ink); align-self: center; }
.rb-events__time { color: var(--tb-ink-2); font-size: var(--tb-fs-13); white-space: nowrap; }

@media (min-width: 900px) {
  .rb-status { grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); gap: var(--tb-s8); }
  .rb-plate { grid-template-columns: 1fr; }
  .rb-plate__face { max-width: 260px; }
}
@media (max-width: 420px) {
  .rb-plate { grid-template-columns: 112px minmax(0, 1fr); gap: var(--tb-s3); }
  .rb-stats th { width: 46%; }
}
</style>
