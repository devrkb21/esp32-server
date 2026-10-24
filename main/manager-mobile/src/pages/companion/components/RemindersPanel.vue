<script lang="ts" setup>
import type { CompanionReminder, ReminderKind } from '@/api/companion'
import { computed, ref, watch } from 'vue'
import { useMessage } from 'wot-design-uni/components/wd-message-box'
import { t } from '@/i18n'
import { toast } from '@/utils/toast'
import { asciiLabel, clampInt, isHHMM, MAX_SAY, newReminder, removeById, stripReminder, upsertById } from '../companionUtils.mjs'
import { daysText, useCompanion } from './context'
import DayChips from './DayChips.vue'

defineOptions({
  name: 'CompanionRemindersPanel',
})

const MAX_REMINDERS = 20
/** wot-design-uni icon per reminder kind */
const KIND_ICON: Record<ReminderKind, string> = { water: 'cloud', medicine: 'heart', custom: 'pin' }
const KINDS: ReminderKind[] = ['water', 'medicine', 'custom']

const { dev, save } = useCompanion()
const message = useMessage()

const reminders = computed(() => dev.value?.reminders || [])

const editorOpen = ref(false)
const saving = ref(false)
const draft = ref<CompanionReminder>(newReminder('water') as CompanionReminder)
const isNew = computed(() => !draft.value.id)

const modeOptions = computed(() => [
  { value: 'interval', payload: t('companion.reminder.mode.interval') },
  { value: 'time', payload: t('companion.reminder.mode.time') },
])

function kindText(kind: ReminderKind) {
  return t(`companion.reminder.kind.${kind}`)
}

/** Reminders grouped by kind (unknown kinds fall into "other") */
const byKind = computed(() => {
  const groups: Record<ReminderKind, CompanionReminder[]> = { water: [], medicine: [], custom: [] }
  for (const r of reminders.value)
    (groups[r.kind] || groups.custom).push(r)
  return groups
})

function whenText(r: CompanionReminder) {
  if (r.mode === 'interval')
    return `${t('companion.reminder.everyLine', { n: r.every_min ?? 60, from: r.from || '', to: r.to || '' })} · ${daysText(r.days)}`
  return `${r.time || ''} · ${daysText(r.days)}`
}

function currentList(): CompanionReminder[] {
  return reminders.value.map(r => stripReminder(r) as CompanionReminder)
}

function openEditor(reminder?: CompanionReminder, kind: ReminderKind = 'custom') {
  if (!reminder && currentList().length >= MAX_REMINDERS) {
    toast.warning(t('companion.reminder.max', { n: MAX_REMINDERS }))
    return
  }
  // keep every field so switching mode back and forth does not lose values
  const base = reminder ? { ...newReminder(reminder.kind), ...reminder } : newReminder(kind)
  draft.value = {
    every_min: 60,
    from: '09:00',
    to: '21:00',
    time: '21:00',
    ...base,
  } as CompanionReminder
  delete draft.value.say_audio
  editorOpen.value = true
}

// the OLED shows ASCII only: filter the label while typing
watch(() => draft.value.label, (label) => {
  const clean = asciiLabel(label)
  if (clean !== label)
    draft.value.label = clean
})

async function toggleEnabled(r: CompanionReminder, enabled: boolean) {
  const list = currentList().map(x => (x.id === r.id ? { ...x, enabled } : x))
  await save({ reminders: list }, enabled ? t('companion.turnedOn') : t('companion.turnedOff'))
}

async function submit() {
  const r = draft.value
  if (r.mode === 'interval') {
    if (!isHHMM(r.from) || !isHHMM(r.to)) {
      toast.warning(t('companion.timeRequired'))
      return
    }
  }
  else if (!isHHMM(r.time)) {
    toast.warning(t('companion.timeRequired'))
    return
  }
  const item = stripReminder({
    ...r,
    label: asciiLabel(r.label).trim(),
    every_min: clampInt(r.every_min, 5, 720, 60),
    say: (r.say || '').trim().slice(0, MAX_SAY),
  }) as CompanionReminder
  saving.value = true
  const ok = await save({ reminders: upsertById(currentList(), item) })
  saving.value = false
  if (ok)
    editorOpen.value = false
}

function confirmDelete() {
  const id = draft.value.id
  message.confirm({
    title: t('companion.reminder.deleteConfirm'),
    confirmButtonText: t('common.delete'),
    cancelButtonText: t('common.cancel'),
  }).then(async () => {
    const ok = await save({ reminders: removeById(currentList(), id) }, t('companion.deleted'))
    if (ok)
      editorOpen.value = false
  }).catch(() => {
    // cancelled
  })
}
</script>

<template>
  <view v-if="dev">
    <!-- One group per kind: water, medicine, other -->
    <view v-for="k in KINDS" :key="k" class="nx-group">
      <view class="cmp-section-head">
        <view class="nx-icon-tile reminders__kind-icon" :class="`is-${k}`" aria-hidden="true">
          <wd-icon :name="KIND_ICON[k]" size="14px" />
        </view>
        <view class="cmp-section-head__title">
          {{ t(`companion.reminder.kind.${k}`) }}
        </view>
      </view>
      <view class="nx-group__body">
        <view
          v-for="r in byKind[k]"
          :key="r.id"
          class="nx-row reminders__row"
          :class="{ 'is-off': !r.enabled }"
        >
          <view class="nx-row__main" role="button" @click="openEditor(r)">
            <view class="nx-row__title nx-truncate reminders__label" :title="r.label">
              {{ r.label || t(`companion.reminder.kind.${r.kind}`) }}
            </view>
            <view class="nx-row__subtitle nx-truncate nx-num">
              {{ whenText(r) }}
            </view>
          </view>
          <wd-switch :model-value="r.enabled" size="24px" @change="({ value }) => toggleEnabled(r, !!value)" />
        </view>
        <view class="nx-row nx-row--tap cmp-add-row" role="button" @click="openEditor(undefined, k)">
          <wd-icon name="add-circle" size="18px" />
          <view class="nx-row__main">
            {{ t('companion.reminder.new', { kind: t(`companion.reminder.kind.${k}`) }) }}
          </view>
        </view>
      </view>
    </view>

    <!-- Edit sheet -->
    <wd-popup v-model="editorOpen" position="bottom" safe-area-inset-bottom :z-index="100" custom-class="cmp-sheet">
      <view class="cmp-sheet__inner">
        <view class="cmp-sheet__handle" />
        <view class="cmp-sheet__header">
          <view class="cmp-sheet__title">
            {{ t(isNew ? 'companion.reminder.new' : 'companion.reminder.edit', { kind: kindText(draft.kind) }) }}
          </view>
          <view class="cmp-sheet__close" role="button" :aria-label="t('common.cancel')" @click="editorOpen = false">
            <wd-icon name="close" size="18px" />
          </view>
        </view>

        <view class="nx-segmented reminders__mode" role="tablist">
          <view
            v-for="m in modeOptions"
            :key="m.value"
            class="nx-segmented__item"
            :class="{ 'is-active': draft.mode === m.value }"
            role="tab"
            :aria-selected="draft.mode === m.value"
            @click="draft.mode = m.value as CompanionReminder['mode']"
          >
            {{ m.payload }}
          </view>
        </view>

        <view class="nx-group">
          <view class="nx-group__body">
            <template v-if="draft.mode === 'interval'">
              <view class="nx-row cmp-stepper-row">
                <view class="nx-row__main nx-row__title">
                  {{ t('companion.reminder.every') }}
                </view>
                <wd-input-number v-model="draft.every_min" :min="5" :max="720" :step="5" input-width="60" />
              </view>
              <wd-datetime-picker
                v-model="draft.from"
                type="time"
                :label="t('companion.reminder.from')"
                :cancel-button-text="t('common.cancel')"
                :confirm-button-text="t('common.confirm')"
                custom-class="cmp-picker"
              />
              <wd-datetime-picker
                v-model="draft.to"
                type="time"
                :label="t('companion.reminder.to')"
                :cancel-button-text="t('common.cancel')"
                :confirm-button-text="t('common.confirm')"
                custom-class="cmp-picker"
              />
            </template>
            <wd-datetime-picker
              v-else
              v-model="draft.time"
              type="time"
              :label="t('companion.time')"
              :cancel-button-text="t('common.cancel')"
              :confirm-button-text="t('common.confirm')"
              custom-class="cmp-picker"
            />
          </view>
        </view>

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
            <wd-input v-model="draft.label" :maxlength="24" clearable no-border placeholder="Reminder" />
          </view>
          <view class="cmp-field__help">
            {{ t('companion.labelHint') }}
          </view>
        </view>

        <view class="cmp-field">
          <view class="cmp-field__label">
            {{ t('companion.reminder.say') }}
          </view>
          <view class="cmp-field__box">
            <wd-textarea v-model="draft.say" :maxlength="300" show-word-limit />
          </view>
          <view class="cmp-field__help">
            {{ t('companion.sayHint') }}
          </view>
        </view>

        <view class="nx-group">
          <view class="nx-group__body">
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
.reminders {
  &__kind-icon {
    width: 40rpx;
    height: 40rpx;
    border-radius: var(--nx-radius-sm);

    &.is-water {
      background: var(--nx-info-soft);
      color: var(--nx-info);
    }

    &.is-medicine {
      background: var(--nx-success-soft);
      color: var(--nx-success);
    }
  }

  &__row.is-off .reminders__label,
  &__row.is-off .nx-row__subtitle {
    color: var(--nx-text-3);
  }

  &__label {
    font-weight: 500;
  }

  &__mode {
    margin-bottom: var(--nx-space-4);
  }
}
</style>
