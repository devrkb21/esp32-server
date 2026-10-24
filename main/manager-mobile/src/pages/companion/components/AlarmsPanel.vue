<script lang="ts" setup>
import type { CompanionAlarm } from '@/api/companion'
import { computed, ref, watch } from 'vue'
import { useMessage } from 'wot-design-uni/components/wd-message-box'
import { t } from '@/i18n'
import { toast } from '@/utils/toast'
import { asciiLabel, clampInt, isHHMM, MAX_SAY, newAlarm, removeById, sortByTime, stripAlarm, upsertById } from '../companionUtils.mjs'
import { daysText, useCompanion } from './context'
import DayChips from './DayChips.vue'

defineOptions({
  name: 'CompanionAlarmsPanel',
})

const MAX_ALARMS = 20

const { dev, save } = useCompanion()
const message = useMessage()

const alarms = computed(() => sortByTime(dev.value?.alarms || []))

const editorOpen = ref(false)
const saving = ref(false)
const draft = ref<CompanionAlarm>(newAlarm())
const isNew = computed(() => !draft.value.id)

function currentList(): CompanionAlarm[] {
  return (dev.value?.alarms || []).map(stripAlarm)
}

function openEditor(alarm?: CompanionAlarm) {
  if (!alarm && currentList().length >= MAX_ALARMS) {
    toast.warning(t('companion.alarm.max', { n: MAX_ALARMS }))
    return
  }
  draft.value = alarm ? stripAlarm(alarm) : newAlarm()
  editorOpen.value = true
}

// the OLED shows ASCII only: filter the label while typing
watch(() => draft.value.label, (label) => {
  const clean = asciiLabel(label)
  if (clean !== label)
    draft.value.label = clean
})

async function toggleEnabled(alarm: CompanionAlarm, enabled: boolean) {
  const list = currentList().map(a => (a.id === alarm.id ? { ...a, enabled } : a))
  await save({ alarms: list }, enabled ? t('companion.alarm.on') : t('companion.alarm.off'))
}

async function submit() {
  const a = draft.value
  if (!isHHMM(a.time)) {
    toast.warning(t('companion.timeRequired'))
    return
  }
  const item = stripAlarm({
    ...a,
    label: asciiLabel(a.label).trim(),
    snooze_min: clampInt(a.snooze_min, 0, 60, 5),
    say: (a.say || '').trim().slice(0, MAX_SAY),
  })
  saving.value = true
  const ok = await save({ alarms: upsertById(currentList(), item) })
  saving.value = false
  if (ok)
    editorOpen.value = false
}

function confirmDelete() {
  const id = draft.value.id
  message.confirm({
    title: t('companion.alarm.deleteConfirm'),
    confirmButtonText: t('common.delete'),
    cancelButtonText: t('common.cancel'),
  }).then(async () => {
    const ok = await save({ alarms: removeById(currentList(), id) }, t('companion.deleted'))
    if (ok)
      editorOpen.value = false
  }).catch(() => {
    // cancelled
  })
}
</script>

<template>
  <view v-if="dev">
    <view class="cmp-section-head">
      <view class="cmp-section-head__title">
        {{ t('companion.tab.alarms') }}
      </view>
      <view v-if="alarms.length" class="cmp-pill" role="button" @click="openEditor()">
        <wd-icon name="add" size="14px" />
        {{ t('companion.alarm.add') }}
      </view>
    </view>

    <view v-if="!alarms.length" class="nx-empty alarms__empty">
      <view class="nx-icon-tile nx-icon-tile--lg">
        <wd-icon name="clock" size="28px" />
      </view>
      <view class="nx-empty__title">
        {{ t('companion.alarm.none') }}
      </view>
      <view class="nx-btn nx-btn--primary alarms__empty-btn" @click="openEditor()">
        <wd-icon name="add" size="16px" />
        {{ t('companion.alarm.add') }}
      </view>
    </view>

    <view v-else class="nx-group">
      <view class="nx-group__body">
        <view v-for="a in alarms" :key="a.id" class="nx-row alarms__row" :class="{ 'is-off': !a.enabled }">
          <view class="nx-row__main alarms__main" role="button" @click="openEditor(a)">
            <view class="cmp-time-hero alarms__time">
              {{ a.time }}
            </view>
            <view class="nx-truncate nx-row__subtitle">
              {{ a.label || t('companion.alarm.defaultLabel') }} · {{ daysText(a.days) }}
            </view>
            <view v-if="a.say" class="nx-caption nx-truncate alarms__say" :title="a.say">
              <wd-icon name="sound" size="12px" /> {{ a.say }}
            </view>
          </view>
          <wd-switch :model-value="a.enabled" size="24px" @change="({ value }) => toggleEnabled(a, !!value)" />
        </view>
      </view>
    </view>

    <!-- Edit sheet -->
    <wd-popup v-model="editorOpen" position="bottom" safe-area-inset-bottom :z-index="100" custom-class="cmp-sheet">
      <view class="cmp-sheet__inner">
        <view class="cmp-sheet__handle" />
        <view class="cmp-sheet__header">
          <view class="cmp-sheet__title">
            {{ isNew ? t('companion.alarm.new') : t('companion.alarm.edit') }}
          </view>
          <view class="cmp-sheet__close" role="button" :aria-label="t('common.cancel')" @click="editorOpen = false">
            <wd-icon name="close" size="18px" />
          </view>
        </view>

        <wd-datetime-picker
          v-model="draft.time"
          type="time"
          :label="t('companion.time')"
          :cancel-button-text="t('common.cancel')"
          :confirm-button-text="t('common.confirm')"
        >
          <view class="alarms__picker" role="button" :aria-label="t('companion.time')">
            <view class="cmp-time-hero alarms__picker-time">
              {{ draft.time || '--:--' }}
            </view>
            <view class="nx-caption">
              {{ t('companion.time') }}
            </view>
          </view>
        </wd-datetime-picker>

        <view class="cmp-field">
          <view class="cmp-field__label">
            {{ t('companion.daysLabel') }}
          </view>
          <DayChips v-model="draft.days" />
        </view>

        <view class="cmp-field">
          <view class="cmp-field__label">
            {{ t('companion.label') }}
          </view>
          <view class="cmp-field__box">
            <wd-input v-model="draft.label" :maxlength="24" clearable no-border placeholder="Wake up" />
          </view>
          <view class="cmp-field__help">
            {{ t('companion.labelHint') }}
          </view>
        </view>

        <view class="cmp-field">
          <view class="cmp-field__label">
            {{ t('companion.alarm.say') }}
          </view>
          <view class="cmp-field__box">
            <wd-textarea
              v-model="draft.say"
              :maxlength="300"
              show-word-limit
              :placeholder="t('companion.alarm.sayPlaceholder')"
            />
          </view>
          <view class="cmp-field__help">
            {{ t('companion.sayHint') }}
          </view>
        </view>

        <view class="nx-group">
          <view class="nx-group__body">
            <view class="nx-row cmp-stepper-row">
              <view class="nx-row__main nx-row__title">
                {{ t('companion.alarm.snooze') }}
              </view>
              <wd-input-number v-model="draft.snooze_min" :min="0" :max="60" />
            </view>
            <view class="nx-row">
              <view class="nx-row__main nx-row__title">
                {{ t('companion.enabled') }}
              </view>
              <wd-switch v-model="draft.enabled" size="22px" />
            </view>
          </view>
        </view>

        <view class="cmp-sheet__actions">
          <wd-button block size="large" :loading="saving" @click="submit">
            {{ t('companion.save') }}
          </wd-button>
          <view v-if="!isNew" class="cmp-sheet__delete" role="button" @click="confirmDelete">
            {{ t('common.delete') }}
          </view>
        </view>
      </view>
    </wd-popup>
  </view>
</template>

<style lang="scss" scoped>
.alarms {
  &__empty {
    padding-top: var(--nx-space-5);
  }

  &__empty-btn {
    margin-top: var(--nx-space-3);
  }

  &__row {
    padding-top: var(--nx-space-2);
    padding-bottom: var(--nx-space-3);

    &.is-off .alarms__time,
    &.is-off .nx-row__subtitle {
      color: var(--nx-text-3);
    }
  }

  &__main {
    min-height: var(--nx-touch);
  }

  &__say {
    margin-top: 4rpx;
  }

  &__picker {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4rpx;
    margin-bottom: var(--nx-space-4);
    padding: var(--nx-space-4);
    border-radius: var(--nx-radius-lg);
    background: var(--nx-surface);

    &:active {
      background: var(--nx-surface-2);
    }
  }

  &__picker-time {
    font-size: calc(var(--nx-text-display) * 1.5);
    line-height: 1.1;
  }
}
</style>
