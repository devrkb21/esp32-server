<template>
  <TbSection :title="$t('robot.sec.memory')" :description="$t('companion.memory.intro')">
    <template #actions><TbSync v-bind="sync" /></template>

    <div class="rb-memory">
      <div class="rb-row">
        <span class="rb-row__text"><span>{{ $t('companion.memory.enabled') }}</span>
          <small v-if="!form.enabled">{{ $t('companion.memory.offNote') }}</small></span>
        <span class="rb-row__ctl">
          <TbButton v-if="robot.isDirty('memory')" variant="quiet" size="s" @click="robot.revertSection('memory')">{{ $t('common.undo') }}</TbButton>
          <TbButton v-if="robot.isDirty('memory')" variant="primary" size="s" :loading="!!robot.saving.memory" @click="robot.saveSection('memory')">{{ $t('common.save') }}</TbButton>
          <TbSwitch v-model="form.enabled" :aria-label="$t('companion.memory.enabled')" />
        </span>
      </div>

      <header class="rb-memory__head">
        <h3 class="rb-sub">{{ $t('robot.memory.notes') }}</h3>
        <span v-if="notes.length" class="rb-memory__count tb-num">{{ $t('companion.memory.count', { n: robot.num(notes.length) }) }}</span>
      </header>

      <TbEmpty v-if="!notes.length" face="awake" :title="$t('companion.memory.empty')" :text="$t('companion.memory.emptyText')" />
      <div v-else class="rb-memory__groups" :class="{ 'is-off': !form.enabled }">
        <p v-if="grouped" class="rb-memory__people-hint">{{ $t('memory.peopleHint') }}</p>
        <section v-for="g in groups" :key="g.person || '-'" class="rb-memory__group" :aria-label="g.person || $t('memory.everyone')">
          <header v-if="grouped" class="rb-memory__person">
            <span class="rb-memory__initial" :class="{ 'is-everyone': !g.person }" aria-hidden="true">{{ initial(g.person) }}</span>
            <span class="rb-memory__who"><b>{{ g.person || $t('memory.everyone') }}</b>
              <small>{{ g.person ? $t('memory.byVoice') : $t('memory.everyoneHint') }}</small></span>
            <span class="rb-memory__n tb-num">{{ $t('memory.personCount', { n: robot.num(g.notes.length) }) }}</span>
          </header>
          <ul class="rb-memory__list">
            <li v-for="m in g.notes" :key="m.id" class="rb-memory__item">
              <div class="rb-memory__body">
                <p class="rb-memory__text">{{ m.text }}</p>
                <p class="rb-memory__meta">
                  <TbTag>{{ $t(kindKey(m.kind)) }}</TbTag>
                  <span v-if="day(m)">{{ $t('companion.memory.noted', { date: dateText(day(m)) }) }}</span>
                  <span v-if="m.until">{{ $t('companion.memory.until', { date: dateText(m.until) }) }}</span>
                </p>
              </div>
              <TbButton variant="quiet" size="s" icon="trash" :disabled="!!robot.saving.memories" :aria-label="$t('companion.memory.deleteNote')"
                @click="robot.deleteMemory(m)">{{ $t('companion.memory.delete') }}</TbButton>
            </li>
          </ul>
        </section>
      </div>

      <p class="rb-note">{{ $t('companion.memory.hint') }}</p>
      <footer v-if="notes.length" class="rb-foot rb-memory__foot">
        <TbButton variant="danger" icon="trash" :disabled="!!robot.saving.memories" @click="robot.forgetMemories()">{{ $t('companion.memory.forgetAll') }}</TbButton>
      </footer>
    </div>
  </TbSection>
</template>

<script>
import { memoryDay, memoryKindKey } from '@/utils/companion.mjs';
import { groupByPerson, hasPeople } from './memoryGroups';

// TinyBot's memory: the switch, and the notes it keeps about the family as a ruled list (kind,
// noted day, until when), each with delete; "Forget everything" asks first. Notes the robot
// filed under a person it knew by voice are grouped by that person ("Everyone" for the rest).
export default {
  name: 'RobotMemory',
  inject: ['robot'],
  computed: {
    form() { return this.robot.forms.memory; },
    notes() { return this.robot.memories; },
    grouped() { return hasPeople(this.notes); },
    groups() { return this.grouped ? groupByPerson(this.notes) : [{ person: '', notes: this.notes }]; },
    sync() {
      const a = this.robot.syncOf('memories');
      return a.state === 'applied' ? this.robot.syncOf('memory') : a;
    },
  },
  methods: {
    kindKey: memoryKindKey,
    initial(name) { return name ? Array.from(name.trim())[0] : '·'; },
    day: memoryDay,
    dateText(ymd) {
      const [y, m, d] = String(ymd).split('-').map(Number);
      if (!y || !m || !d) return ymd;
      const loc = this.robot.lang === 'bn' ? 'bn-BD' : String(this.robot.lang || 'en').replace('_', '-');
      try { return new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(y, m - 1, d)); } catch (e) { return ymd; }
    },
  },
};
</script>

<style>
.rb-memory { display: grid; gap: var(--tb-s3); }
.rb-memory__head { display: flex; align-items: flex-end; justify-content: space-between; gap: 10px; margin-top: var(--tb-s3); border-bottom: 1px solid var(--tb-rule); }
.rb-memory__head .rb-sub { border-bottom: 0; }
.rb-memory__count { font-size: var(--tb-fs-13); color: var(--tb-ink-2); padding-bottom: 8px; }
.rb-memory__groups { display: grid; gap: var(--tb-s4); transition: opacity var(--tb-t-fast) var(--tb-ease); }
.rb-memory__groups.is-off { opacity: .6; }
.rb-memory__people-hint { color: var(--tb-ink-2); font-size: var(--tb-fs-13); }
.rb-memory__person { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: var(--tb-s3); padding: 8px 0; border-bottom: 1px solid var(--tb-rule); }
.rb-memory__initial { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--tb-ink);
  font-family: var(--tb-font-display); font-weight: 800; font-size: var(--tb-fs-16); }
.rb-memory__initial.is-everyone { border-style: dashed; color: var(--tb-ink-3); border-color: var(--tb-ink-3); }
.rb-memory__who { display: grid; gap: 0; min-width: 0; }
.rb-memory__who b { overflow-wrap: anywhere; }
.rb-memory__who small { color: var(--tb-ink-3); font-size: var(--tb-fs-12); }
.rb-memory__n { font-size: var(--tb-fs-13); color: var(--tb-ink-2); white-space: nowrap; }
.rb-memory__list { list-style: none; margin: 0; padding: 0; }
.rb-memory__item { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--tb-s3); padding: 10px 0; border-bottom: 1px solid var(--tb-rule-soft); }
.rb-memory__body { display: grid; gap: 6px; min-width: 0; }
.rb-memory__text { font-size: var(--tb-fs-15); overflow-wrap: anywhere; }
.rb-memory__meta { display: flex; align-items: center; gap: 6px 12px; flex-wrap: wrap; font-size: var(--tb-fs-13); color: var(--tb-ink-2); }
.rb-memory__foot { justify-content: flex-start; }
</style>
