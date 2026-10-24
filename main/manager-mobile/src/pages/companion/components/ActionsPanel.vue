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

const actions: { type: CommandType, arg: string, icon: string, label: string }[] = [
  { type: 'lullaby', arg: '', icon: '🎶', label: 'companion.act.lullaby' },
  { type: 'ring', arg: '', icon: '🔔', label: 'companion.act.ring' },
  { type: 'breathe', arg: '', icon: '🌬️', label: 'companion.act.breathe' },
  { type: 'night_light', arg: 'on', icon: '💡', label: 'companion.act.lightOn' },
  { type: 'night_light', arg: 'off', icon: '🌑', label: 'companion.act.lightOff' },
  { type: 'pomodoro', arg: '', icon: '🍅', label: 'companion.act.focus' },
]

const games: { name: GameName, icon: string }[] = [
  { name: 'catch', icon: '🍎' },
  { name: 'simon', icon: '🎵' },
  { name: 'dice', icon: '🎲' },
  { name: 'reaction', icon: '⚡' },
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
  <view v-if="dev" class="flex flex-col gap-[20rpx]">
    <view class="rounded-[20rpx] bg-white p-[28rpx] shadow-[0_2rpx_12rpx_rgba(0,0,0,0.04)]">
      <text class="mb-[12rpx] block text-[30rpx] text-[#232338] font-semibold">
        📖 {{ t('companion.act.story') }}
      </text>
      <wd-input v-model="topic" :maxlength="64" clearable :placeholder="t('companion.act.storyTopic')" />
      <view class="mt-[20rpx]">
        <wd-button type="primary" block :loading="busy.startsWith('story:')" @click="tellStory">
          {{ t('companion.act.storyStart') }}
        </wd-button>
      </view>
    </view>

    <view class="grid grid-cols-3 gap-[16rpx]">
      <view
        v-for="a in actions"
        :key="`${a.type}-${a.arg}`"
        class="flex flex-col items-center justify-center rounded-[20rpx] bg-white px-[8rpx] py-[24rpx] shadow-[0_2rpx_12rpx_rgba(0,0,0,0.04)] active:bg-[#eef3ff]"
        :class="busy === `${a.type}:${a.arg}` ? 'opacity-50' : ''"
        @click="run(a.type, a.arg)"
      >
        <text class="text-[48rpx]">
          {{ a.icon }}
        </text>
        <text class="mt-[8rpx] text-center text-[24rpx] text-[#232338]">
          {{ t(a.label) }}
        </text>
      </view>
    </view>

    <view class="rounded-[20rpx] bg-white p-[28rpx] shadow-[0_2rpx_12rpx_rgba(0,0,0,0.04)]">
      <text class="mb-[16rpx] block text-[30rpx] text-[#232338] font-semibold">
        🎮 {{ t('companion.act.games') }}
      </text>
      <view class="flex flex-wrap gap-[16rpx]">
        <view
          v-for="g in games"
          :key="g.name"
          class="rounded-[32rpx] bg-[#f0f2f7] px-[24rpx] py-[12rpx] text-[26rpx] text-[#232338] active:bg-[#dfe6f7]"
          @click="run('game', g.name, t('companion.act.gameStarting', { game: t(`companion.game.${g.name}`) }))"
        >
          {{ g.icon }} {{ t(`companion.game.${g.name}`) }}
        </view>
      </view>
    </view>

    <view v-if="recent.length" class="rounded-[20rpx] bg-white p-[28rpx] shadow-[0_2rpx_12rpx_rgba(0,0,0,0.04)]">
      <text class="mb-[12rpx] block text-[30rpx] text-[#232338] font-semibold">
        {{ t('companion.act.recent') }}
      </text>
      <view
        v-for="c in recent"
        :key="c.id"
        class="flex items-center gap-[16rpx] border-b-[1rpx] border-b-[#f0f0f0] border-b-solid py-[16rpx] last:border-b-0"
      >
        <text class="flex-1 text-[26rpx] text-[#232338]">
          {{ commandText(c) }}
        </text>
        <text class="text-[22rpx] text-[#9d9ea3]">
          {{ agoText(c.ts) }}
        </text>
        <text
          class="rounded-[20rpx] px-[14rpx] py-[4rpx] text-[22rpx]"
          :class="c.status === 'done' ? 'bg-[#f6ffed] text-[#389e0d]' : 'bg-[#fff7e6] text-[#d46b08]'"
        >
          {{ c.status === 'done' ? t('companion.act.done') : t('companion.act.pending') }}
        </text>
      </view>
    </view>
  </view>
</template>
