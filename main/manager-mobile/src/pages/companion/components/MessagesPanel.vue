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
    return { text: t('companion.msg.yes'), cls: 'nx-badge--success' }
  if (m.answer === 'no')
    return { text: t('companion.msg.no'), cls: 'nx-badge--danger' }
  if (m.answer === 'seen')
    return { text: `${t('companion.msg.seen')} ✓✓`, cls: 'nx-badge--success' }
  if (m.status === 'delivered')
    return { text: `${t('companion.msg.delivered')} ✓`, cls: 'nx-badge--accent' }
  return { text: t('companion.msg.pending'), cls: 'nx-badge--warning' }
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
  <view v-if="dev">
    <!-- Composer -->
    <view class="nx-card msgs__composer">
      <view class="cmp-field">
        <view class="cmp-field__label">
          {{ t('companion.msg.text') }}
        </view>
        <view class="cmp-field__box msgs__box">
          <wd-textarea
            v-model="text"
            :maxlength="300"
            show-word-limit
            auto-height
            :placeholder="t('companion.msg.textPlaceholder')"
          />
        </view>
        <view class="cmp-field__help">
          {{ t('companion.msg.textHint') }}
        </view>
      </view>

      <view class="cmp-field">
        <view class="cmp-field__label">
          {{ t('companion.msg.from') }}
        </view>
        <view class="cmp-field__box msgs__box">
          <wd-input v-model="from" :maxlength="32" clearable no-border placeholder="Ammu" />
        </view>
        <view class="cmp-field__help">
          {{ t('companion.msg.fromHint') }}
        </view>
      </view>

      <view class="msgs__ask">
        <view class="nx-row__title">
          {{ t('companion.msg.ask') }}
        </view>
        <wd-switch v-model="ask" size="22px" />
      </view>

      <wd-button block size="large" :loading="sending" @click="send">
        {{ t('companion.msg.send') }}
      </wd-button>
    </view>

    <!-- Sent messages -->
    <view class="nx-group">
      <view class="nx-group__header">
        {{ t('companion.msg.list') }}
      </view>
      <view v-if="!messages.length" class="nx-group__body">
        <view class="nx-row">
          <view class="nx-row__main nx-row__subtitle msgs__none">
            {{ t('companion.msg.none') }}
          </view>
        </view>
      </view>
      <view v-else class="msgs__list">
        <view v-for="m in messages" :key="m.id" class="msgs__item">
          <view class="msgs__bubble">
            {{ m.text }}
          </view>
          <view class="msgs__meta">
            <text class="nx-caption nx-num nx-truncate">
              {{ m.from ? `${m.from} · ` : '' }}{{ clockText(m.ts) }}{{ m.ask ? ` · ${t('companion.msg.askTag')}` : '' }}
            </text>
            <view class="nx-badge" :class="status(m).cls">
              {{ status(m).text }}
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.msgs {
  &__composer {
    margin-bottom: var(--nx-space-5);
  }

  &__box {
    background: var(--nx-surface-2);
  }

  &__ask {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--nx-space-3);
    min-height: var(--nx-touch);
    margin-bottom: var(--nx-space-3);
  }

  &__none {
    text-align: center;
    color: var(--nx-text-3);
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: var(--nx-space-3);
  }

  &__item {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: var(--nx-space-1);
  }

  &__bubble {
    max-width: 85%;
    padding: var(--nx-space-2) var(--nx-space-3);
    border-radius: var(--nx-radius-lg) var(--nx-radius-lg) var(--nx-radius-sm) var(--nx-radius-lg);
    background: var(--nx-accent-soft);
    color: var(--nx-text);
    font-size: var(--nx-text-body);
    line-height: 1.45;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    box-sizing: border-box;
  }

  &__meta {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--nx-space-2);
    max-width: 100%;
    min-width: 0;
  }
}

:deep(.cmp-field__box.msgs__box .wd-input),
:deep(.cmp-field__box.msgs__box .wd-textarea) {
  background: var(--nx-surface-2);
}
</style>
