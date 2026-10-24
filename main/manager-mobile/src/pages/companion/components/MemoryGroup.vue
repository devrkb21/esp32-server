<script lang="ts" setup>
import type { MemoryNote, MemorySettings } from '@/api/companion'
import { computed, ref, watch } from 'vue'
import { useMessage } from 'wot-design-uni/components/wd-message-box'
import { t } from '@/i18n'
import { memoryDay, memoryKindKey, memoryList, memorySettings } from '../companionUtils.mjs'
import { useCompanion } from './context'

defineOptions({
  name: 'CompanionMemoryGroup',
})

// TinyBot's memory: after each voice chat it notes a few lasting things about the family and uses
// them in later chats. The switch is a draft saved with the button (like Proactive talk); deleting
// a note or forgetting everything saves at once and the page takes the device from the answer.
const { dev, save } = useCompanion()
const message = useMessage()

const notes = computed<MemoryNote[]>(() => memoryList(dev.value?.memories))

const memory = ref<MemorySettings>(memorySettings(undefined))
const memoryDirty = ref(false)
const savingMemory = ref(false)
const busy = ref(false)
watch(() => dev.value?.settings?.memory, (m) => {
  if (!memoryDirty.value)
    memory.value = memorySettings(m)
}, { immediate: true, deep: true })

function setEnabled(on: boolean) {
  memory.value = { enabled: on }
  memoryDirty.value = memorySettings(dev.value?.settings?.memory).enabled !== on
}

function revertMemory() {
  memoryDirty.value = false
  memory.value = memorySettings(dev.value?.settings?.memory)
}

async function saveMemory() {
  savingMemory.value = true
  const ok = await save({ settings: { memory: { enabled: memory.value.enabled } } })
  savingMemory.value = false
  if (ok)
    memoryDirty.value = false
}

async function deleteNote(note: MemoryNote) {
  if (busy.value)
    return
  busy.value = true
  await save({ memories: { delete: [note.id] } }, t('companion.deleted'))
  busy.value = false
}

function confirmForget() {
  const n = notes.value.length
  if (!n || busy.value)
    return
  message.confirm({
    title: t('companion.memory.forgetAll'),
    msg: t('companion.memory.confirmForget', { n }),
    confirmButtonText: t('companion.memory.forgetAll'),
    cancelButtonText: t('common.cancel'),
  }).then(async () => {
    busy.value = true
    await save({ memories: { clear: true } }, t('companion.memory.forgot'))
    busy.value = false
  }).catch(() => {
    // cancelled
  })
}
</script>

<template>
  <view v-if="dev" class="nx-group">
    <view class="nx-group__header mem__header">
      <text>{{ t('companion.memory.title') }}</text>
      <text v-if="notes.length" class="nx-num">
        {{ t('companion.memory.count', { n: notes.length }) }}
      </text>
    </view>
    <view class="nx-group__body">
      <view class="nx-row">
        <view class="nx-row__main">
          <view class="nx-row__title">
            {{ t('companion.memory.enabled') }}
          </view>
          <view class="nx-row__subtitle">
            {{ t('companion.memory.intro') }}
          </view>
          <view v-if="!memory.enabled" class="nx-row__subtitle mem__off">
            {{ t('companion.memory.offNote') }}
          </view>
        </view>
        <wd-switch :model-value="memory.enabled" size="24px" @change="({ value }) => setEnabled(!!value)" />
      </view>

      <view v-if="!notes.length" class="nx-empty mem__empty">
        <view class="nx-icon-tile nx-icon-tile--neutral">
          <wd-icon name="note" size="22px" />
        </view>
        <view class="nx-empty__title">
          {{ t('companion.memory.empty') }}
        </view>
        <view class="nx-empty__text">
          {{ t('companion.memory.emptyText') }}
        </view>
      </view>
      <view
        v-for="note in notes"
        :key="note.id"
        class="nx-row mem__row"
        :class="{ 'is-off': !memory.enabled }"
      >
        <view class="nx-row__main">
          <view class="nx-break mem__text">
            {{ note.text }}
          </view>
          <view class="mem__meta">
            <text class="nx-badge" :class="{ 'nx-badge--accent': note.kind === 'event' }">
              {{ t(memoryKindKey(note.kind)) }}
            </text>
            <text v-if="memoryDay(note)" class="nx-num">
              {{ t('companion.memory.noted', { date: memoryDay(note) }) }}
            </text>
            <text v-if="note.until" class="nx-num">
              · {{ t('companion.memory.until', { date: note.until }) }}
            </text>
          </view>
        </view>
        <view
          class="mem__delete"
          role="button"
          :aria-label="t('companion.memory.deleteNote')"
          :class="{ 'is-busy': busy }"
          @click="deleteNote(note)"
        >
          <wd-icon name="delete" size="18px" />
        </view>
      </view>
    </view>
    <view class="nx-group__footer">
      {{ t('companion.memory.hint') }}
    </view>
    <view class="mem__save">
      <wd-button v-if="memoryDirty" type="info" @click="revertMemory">
        {{ t('companion.revert') }}
      </wd-button>
      <wd-button block :loading="savingMemory" :disabled="!memoryDirty" @click="saveMemory">
        {{ t('companion.save') }}
      </wd-button>
    </view>
    <view v-if="notes.length" class="nx-btn nx-btn--danger nx-btn--block mem__forget" role="button" :class="{ 'is-busy': busy }" @click="confirmForget">
      <wd-icon name="delete" size="16px" />
      {{ t('companion.memory.forgetAll') }}
    </view>
  </view>
</template>

<style lang="scss" scoped>
.mem {
  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--nx-space-2);
  }

  &__off {
    color: var(--nx-warning);
  }

  &__empty {
    padding: var(--nx-space-5) var(--nx-space-4);
  }

  &__row {
    align-items: flex-start;

    &.is-off {
      opacity: 0.6;
    }
  }

  &__text {
    font-size: var(--nx-text-body);
    line-height: 1.5;
    color: var(--nx-text);
    white-space: pre-wrap;
  }

  &__meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--nx-space-2);
    margin-top: var(--nx-space-1);
    font-size: var(--nx-text-caption);
    color: var(--nx-text-3);
  }

  &__delete {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--nx-touch);
    height: var(--nx-touch);
    margin: calc(var(--nx-space-2) * -1) calc(var(--nx-space-3) * -1) 0 0;
    color: var(--nx-danger);

    &:active {
      opacity: 0.6;
    }
  }

  &__save {
    display: flex;
    gap: var(--nx-space-2);
    margin-top: var(--nx-space-3);
  }

  &__forget {
    margin-top: var(--nx-space-2);
  }
}

.is-busy {
  opacity: 0.5;
  pointer-events: none;
}
</style>
