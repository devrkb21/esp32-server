<script lang="ts" setup>
import type { MemoryNote } from '@/api/companion'
import { computed, ref, watch } from 'vue'
import { t } from '@/i18n'
import { memoryDay, memoryKindKey, memoryList, memorySettings } from '@/utils/companionUtils.mjs'
import { tbConfirm } from '@/utils/tbConfirm'
import { useRobot } from './context'

// What TinyBot remembers: after each voice chat it notes a few lasting things about the family and
// uses them in later chats. The switch is a draft saved with the button (as before); deleting a
// note or forgetting everything saves at once and the screen takes the robot from the answer.
defineOptions({ name: 'RobotMemory' })

const r = useRobot()
const notes = computed<MemoryNote[]>(() => memoryList(r.view.value?.memories))

const enabled = ref(true)
const baseline = ref(true)
const dirty = computed(() => enabled.value !== baseline.value)
function sync(force = false) {
  if (!force && (dirty.value || r.saving.memory))
    return
  baseline.value = memorySettings(r.view.value?.settings?.memory).enabled
  enabled.value = baseline.value
}
watch(() => r.view.value?.settings?.memory, () => sync(), { immediate: true, deep: true })

async function saveMemory() {
  if (await r.save({ settings: { memory: { enabled: enabled.value } } }, 'memory'))
    sync(true)
}

const busy = computed(() => !!r.saving.memories)
const sync2 = computed(() => {
  const a = r.syncOf('memories')
  return a.state === 'applied' ? r.syncOf('memory') : a
})

async function deleteNote(note: MemoryNote) {
  if (busy.value)
    return
  await r.save({ memories: { delete: [note.id] } }, 'memories', t('mrobot.memory.deleted'))
}

async function forgetAll() {
  const n = notes.value.length
  if (!n || busy.value)
    return
  const ok = await tbConfirm({
    title: t('mrobot.memory.forgetTitle'),
    message: t('companion.memory.confirmForget', { n: r.num(n) }),
    confirmText: t('companion.memory.forgetAll'),
    danger: true,
  })
  if (ok)
    await r.save({ memories: { clear: true } }, 'memories', t('companion.memory.forgot'))
}

function dateText(ymd: string) {
  const [y, m, d] = String(ymd).split('-').map(Number)
  if (!y || !m || !d)
    return ymd
  const lang = r.lang.value
  const loc = lang === 'bn' ? 'bn-BD' : String(lang || 'en').replace('_', '-')
  try {
    return new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(y, m - 1, d))
  }
  catch {
    return r.num(ymd)
  }
}
</script>

<template>
  <tb-section :title="t('mrobot.sec.memory')" :description="t('companion.memory.intro')">
    <template #actions>
      <tb-sync v-bind="sync2" />
    </template>

    <view class="rbm-mem">
      <view class="rb-row">
        <view class="rb-row__text">
          <text>{{ t('companion.memory.enabled') }}</text>
          <text v-if="!enabled" class="rb-row__small">
            {{ t('companion.memory.offNote') }}
          </text>
        </view>
        <tb-switch :model-value="enabled" @change="(on: boolean) => (enabled = on)" />
      </view>
      <view v-if="dirty" class="rb-foot">
        <text class="rb-foot__unsaved">
          {{ t('common.unsaved') }}
        </text>
        <tb-button variant="quiet" @click="sync(true)">
          {{ t('common.undo') }}
        </tb-button>
        <tb-button variant="primary" :loading="!!r.saving.memory" @click="saveMemory">
          {{ t('common.save') }}
        </tb-button>
      </view>

      <view class="rb-sub rbm-mem__head">
        <text class="rb-sub__title">
          {{ t('mrobot.memory.notes') }}
        </text>
        <text v-if="notes.length" class="tb-num rbm-mem__count">
          {{ t('mrobot.memory.count', { n: r.num(notes.length) }) }}
        </text>
      </view>

      <tb-empty v-if="!notes.length" :title="t('companion.memory.empty')" :text="t('companion.memory.emptyText')" />
      <view v-else class="rbm-mem__list" :class="{ 'is-off': !enabled }">
        <view v-for="m in notes" :key="m.id" class="rbm-mem__item">
          <view class="rbm-mem__body">
            <text class="rbm-mem__text">
              {{ m.text }}
            </text>
            <view class="rbm-mem__meta">
              <tb-tag :mark="m.kind === 'event'">
                {{ t(memoryKindKey(m.kind)) }}
              </tb-tag>
              <text v-if="memoryDay(m)">
                {{ t('companion.memory.noted', { date: dateText(memoryDay(m)) }) }}
              </text>
              <text v-if="m.until">
                {{ t('companion.memory.until', { date: dateText(m.until) }) }}
              </text>
            </view>
          </view>
          <tb-button variant="quiet" size="s" icon="trash" :disabled="busy" :aria-label="t('companion.memory.deleteNote')" @click="deleteNote(m)" />
        </view>
      </view>

      <text class="rb-note">
        {{ t('companion.memory.hint') }}
      </text>
      <view v-if="notes.length" class="rbm-mem__forget">
        <tb-button variant="danger" icon="trash" :disabled="busy" @click="forgetAll">
          {{ t('companion.memory.forgetAll') }}
        </tb-button>
      </view>
    </view>
  </tb-section>
</template>

<style lang="scss">
@import './robot.scss';

.rbm-mem {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.rbm-mem__head {
  margin-top: 8px;
}
.rbm-mem__count {
  font-size: 13px;
  color: var(--tb-ink-2);
}
.rbm-mem__list {
  display: flex;
  flex-direction: column;
  transition: opacity var(--tb-t-fast) var(--tb-ease);
}
.rbm-mem__list.is-off {
  opacity: 0.6;
}
.rbm-mem__item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 0;
  border-bottom: 1px solid var(--tb-rule-soft);
}
.rbm-mem__body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  flex: 1;
}
.rbm-mem__text {
  font-size: 15px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.rbm-mem__meta {
  display: flex;
  align-items: center;
  gap: 6px 12px;
  flex-wrap: wrap;
  font-size: 13px;
  color: var(--tb-ink-2);
}
.rbm-mem__item .tb-btn--s {
  --h: 44px;
  width: 44px;
  padding: 0;
  color: var(--tb-danger);
}
.rbm-mem__forget {
  padding-top: 4px;
}
</style>
