<script lang="ts" setup>
import type { CompanionMessage } from '@/api/companion'
import { computed, ref } from 'vue'
import { sendCompanionMessage } from '@/api/companion'
import { t } from '@/i18n'
import { toast } from '@/utils/toast'
import { clockText } from '../companionUtils.mjs'
import { notifyError, useCompanion } from './context'

defineOptions({
  name: 'CompanionMessagesPanel',
})

const FROM_KEY = 'companion_from'

const { dev, deviceId, reload } = useCompanion()

const from = ref<string>(uni.getStorageSync(FROM_KEY) || '')
const text = ref('')
const ask = ref(true)
const sending = ref(false)

const messages = computed(() => dev.value?.messages || [])

function status(m: CompanionMessage): { text: string, cls: string } {
  if (m.answer === 'yes')
    return { text: `${t('companion.msg.yes')} 👍`, cls: 'bg-[#f6ffed] text-[#389e0d]' }
  if (m.answer === 'no')
    return { text: `${t('companion.msg.no')} 👎`, cls: 'bg-[#fff1f0] text-[#cf1322]' }
  if (m.answer === 'seen')
    return { text: `${t('companion.msg.seen')} ✓✓`, cls: 'bg-[#f6ffed] text-[#389e0d]' }
  if (m.status === 'delivered')
    return { text: `${t('companion.msg.delivered')} ✓`, cls: 'bg-[#e6f4ff] text-[#1677ff]' }
  return { text: `${t('companion.msg.pending')} ⏳`, cls: 'bg-[#fff7e6] text-[#d46b08]' }
}

async function send() {
  const body = text.value.trim()
  if (!body) {
    toast.warning(t('companion.msg.empty'))
    return
  }
  const sender = from.value.trim()
  uni.setStorageSync(FROM_KEY, sender)
  sending.value = true
  try {
    await sendCompanionMessage(deviceId.value, { from: sender, text: body, ask: ask.value })
    toast.success(t('companion.msg.sent'))
    text.value = ''
    await reload()
  }
  catch (error) {
    notifyError(error)
  }
  finally {
    sending.value = false
  }
}
</script>

<template>
  <view v-if="dev" class="flex flex-col gap-[20rpx]">
    <view class="rounded-[20rpx] bg-white p-[28rpx] shadow-[0_2rpx_12rpx_rgba(0,0,0,0.04)]">
      <text class="mb-[8rpx] block text-[26rpx] text-[#65686f]">
        {{ t('companion.msg.from') }}
      </text>
      <wd-input v-model="from" :maxlength="32" clearable placeholder="Ammu" />
      <text class="mt-[6rpx] block text-[22rpx] text-[#9d9ea3]">
        {{ t('companion.msg.fromHint') }}
      </text>

      <text class="mb-[8rpx] mt-[24rpx] block text-[26rpx] text-[#65686f]">
        {{ t('companion.msg.text') }}
      </text>
      <wd-textarea
        v-model="text"
        :maxlength="300"
        show-word-limit
        :placeholder="t('companion.msg.textPlaceholder')"
        custom-class="!bg-[#f5f7fb] !rounded-[12rpx]"
      />
      <text class="mt-[6rpx] block text-[22rpx] text-[#9d9ea3]">
        {{ t('companion.msg.textHint') }}
      </text>

      <view class="mt-[24rpx] flex items-center justify-between">
        <text class="text-[26rpx] text-[#65686f]">
          {{ t('companion.msg.ask') }}
        </text>
        <wd-switch v-model="ask" size="20" />
      </view>

      <view class="mt-[28rpx]">
        <wd-button type="primary" block :loading="sending" @click="send">
          {{ t('companion.msg.send') }} ✉
        </wd-button>
      </view>
    </view>

    <view class="rounded-[20rpx] bg-white p-[28rpx] shadow-[0_2rpx_12rpx_rgba(0,0,0,0.04)]">
      <text class="mb-[12rpx] block text-[30rpx] text-[#232338] font-semibold">
        {{ t('companion.msg.list') }}
      </text>
      <view v-if="!messages.length" class="py-[20rpx] text-center text-[24rpx] text-[#9d9ea3]">
        {{ t('companion.msg.none') }}
      </view>
      <view
        v-for="m in messages"
        :key="m.id"
        class="flex items-start gap-[16rpx] border-b-[1rpx] border-b-[#f0f0f0] border-b-solid py-[18rpx] last:border-b-0"
      >
        <view class="min-w-0 flex-1">
          <text class="block break-all text-[28rpx] text-[#232338]">
            {{ m.text }}
          </text>
          <text class="block text-[22rpx] text-[#8c8c8c]">
            {{ m.from ? `${m.from} · ` : '' }}{{ clockText(m.ts) }}{{ m.ask ? ` · ${t('companion.msg.askTag')}` : '' }}
          </text>
        </view>
        <text class="whitespace-nowrap rounded-[20rpx] px-[14rpx] py-[4rpx] text-[22rpx]" :class="status(m).cls">
          {{ status(m).text }}
        </text>
      </view>
    </view>
  </view>
</template>
