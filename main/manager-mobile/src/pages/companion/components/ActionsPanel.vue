<script lang="ts" setup>
import type { CommandType, CompanionCommand, GameName } from '@/api/companion'
import { computed, ref } from 'vue'
import { t } from '@/i18n'
import { agoText, useCompanion } from './context'

defineOptions({
  name: 'CompanionActionsPanel',
})

const { dev, command } = useCompanion()

const topic = ref('')
const busy = ref('')

/** `icon` is a wot-design-uni icon name */
const actions: { type: CommandType, arg: string, icon: string, label: string }[] = [
  { type: 'lullaby', arg: '', icon: 'sound', label: 'companion.act.lullaby' },
  { type: 'ring', arg: '', icon: 'notification', label: 'companion.act.ring' },
  { type: 'breathe', arg: '', icon: 'heart', label: 'companion.act.breathe' },
  { type: 'night_light', arg: 'on', icon: 'star-filled', label: 'companion.act.lightOn' },
  { type: 'night_light', arg: 'off', icon: 'star', label: 'companion.act.lightOff' },
  { type: 'pomodoro', arg: '', icon: 'time', label: 'companion.act.focus' },
  { type: 'stop', arg: '', icon: 'pause-circle', label: 'companion.act.stop' },
]

const games: { name: GameName, icon: string }[] = [
  { name: 'catch', icon: 'gift' },
  { name: 'simon', icon: 'sound' },
  { name: 'dice', icon: 'view-module' },
  { name: 'reaction', icon: 'tips' },
]

const recent = computed(() => (dev.value?.commands || []).slice(0, 8))

async function run(type: CommandType, arg: string, okMsg?: string) {
  const key = `${type}:${arg}`
  if (busy.value)
    return
  busy.value = key
  const ok = await command(type, arg, okMsg)
  busy.value = ''
  return ok
}

async function tellStory() {
  const ok = await run('story', topic.value.trim(), t('companion.act.storySent'))
  if (ok)
    topic.value = ''
}

function commandText(c: CompanionCommand) {
  const key = `companion.cmd.${c.type}`
  const name = t(key)
  return `${name === key ? c.type : name}${c.arg ? ` (${c.arg})` : ''}`
}
</script>

<template>
  <view v-if="dev">
    <!-- Quick actions -->
    <view class="cmp-section">
      <view class="actions__grid">
        <view
          v-for="a in actions"
          :key="`${a.type}-${a.arg}`"
          class="actions__tile"
          :class="{ 'is-busy': busy === `${a.type}:${a.arg}` }"
          role="button"
          :aria-label="t(a.label)"
          @click="run(a.type, a.arg)"
        >
          <view class="nx-icon-tile actions__icon">
            <wd-loading v-if="busy === `${a.type}:${a.arg}`" size="18px" />
            <wd-icon v-else :name="a.icon" size="22px" />
          </view>
          <view class="actions__label">
            {{ t(a.label) }}
          </view>
        </view>
      </view>
    </view>

    <!-- Story -->
    <view class="nx-group">
      <view class="nx-group__header">
        {{ t('companion.act.story') }}
      </view>
      <view class="nx-group__body actions__story">
        <wd-input
          v-model="topic"
          :maxlength="64"
          clearable
          no-border
          :placeholder="t('companion.act.storyTopic')"
          custom-class="actions__input"
        />
        <wd-button block :loading="busy.startsWith('story:')" @click="tellStory">
          {{ t('companion.act.storyStart') }}
        </wd-button>
      </view>
    </view>

    <!-- Games -->
    <view class="nx-group">
      <view class="nx-group__header">
        {{ t('companion.act.games') }}
      </view>
      <view class="actions__games">
        <view
          v-for="g in games"
          :key="g.name"
          class="cmp-pill cmp-pill--neutral actions__game"
          :class="{ 'is-busy': busy === `game:${g.name}` }"
          role="button"
          @click="run('game', g.name, t('companion.act.gameStarting', { game: t(`companion.game.${g.name}`) }))"
        >
          <wd-icon :name="g.icon" size="16px" custom-class="actions__game-icon" />
          {{ t(`companion.game.${g.name}`) }}
        </view>
      </view>
    </view>

    <!-- Recent commands -->
    <view v-if="recent.length" class="nx-group">
      <view class="nx-group__header">
        {{ t('companion.act.recent') }}
      </view>
      <view class="nx-group__body">
        <view v-for="c in recent" :key="c.id" class="nx-row">
          <view class="nx-row__main">
            <view class="nx-row__title nx-truncate">
              {{ commandText(c) }}
            </view>
            <view class="nx-caption nx-num">
              {{ agoText(c.ts) }}
            </view>
          </view>
          <view class="nx-badge" :class="c.status === 'done' ? 'nx-badge--success' : 'nx-badge--warning'">
            {{ c.status === 'done' ? t('companion.act.done') : t('companion.act.pending') }}
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.actions {
  &__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--nx-space-2);
  }

  &__tile {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--nx-space-3);
    min-height: 176rpx;
    padding: var(--nx-space-3);
    border-radius: var(--nx-radius-lg);
    background: var(--nx-surface);
    box-shadow: var(--nx-shadow-1);
    box-sizing: border-box;
    transition:
      transform var(--nx-dur-1) var(--nx-ease),
      opacity var(--nx-dur-1) var(--nx-ease);

    &:active {
      transform: scale(0.97);
    }

    &.is-busy {
      opacity: 0.6;
    }
  }

  &__icon {
    width: 72rpx;
    height: 72rpx;
  }

  &__label {
    font-size: var(--nx-text-callout);
    font-weight: 600;
    line-height: 1.3;
    color: var(--nx-text);
    overflow-wrap: anywhere;
  }

  &__story {
    display: flex;
    flex-direction: column;
    gap: var(--nx-space-3);
    padding: var(--nx-space-3) var(--nx-space-4) var(--nx-space-4);
  }

  &__games {
    display: flex;
    flex-wrap: wrap;
    gap: var(--nx-space-2);
  }

  &__game {
    min-height: var(--nx-touch);
    padding: 0 var(--nx-space-4);
    background: var(--nx-surface);
    box-shadow: var(--nx-shadow-1);
    font-size: var(--nx-text-callout);

    &.is-busy {
      opacity: 0.6;
    }
  }
}

:deep(.actions__input) {
  padding: var(--nx-space-2) var(--nx-space-3);
  border-radius: var(--nx-radius);
  background: var(--nx-surface-2);
}

:deep(.actions__game-icon) {
  color: var(--nx-accent);
}

@media (prefers-reduced-motion: reduce) {
  .actions__tile {
    transition: none;
  }
}
</style>
