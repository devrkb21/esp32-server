<script lang="ts" setup>
import type { QuotaToday } from '@/api/ai/ai'
import { computed, onMounted, ref } from 'vue'
import { getQuota } from '@/api/ai/ai'
import { t } from '@/i18n'
import { digits } from '@/utils/calendar.mjs'
import { quotaView } from './kidsModel.mjs'

// The owner's daily LLM limit (GET /usage/quota): shown only when a limit is set. When it is
// used up the robot says a polite Bangla line instead of answering; this says why.
defineOptions({ name: 'QuotaNote' })

const props = defineProps<{ lang: string }>()
const quota = ref<QuotaToday | null>(null)
const view = computed(() => quotaView(quota.value))
const num = (n: number | string) => digits(n, props.lang)

onMounted(async () => {
  try {
    quota.value = await getQuota()
  }
  catch {
    quota.value = null
  }
})
</script>

<template>
  <view v-if="view" class="ag-quota" :class="{ 'is-over': view.exceeded }" role="status" :aria-label="t('quota.title')">
    <view class="ag-quota__top">
      <text class="tb-num ag-quota__num">
        {{ num(view.used) }}<text class="ag-quota__of">
          /{{ num(view.limit) }}
        </text>
      </text>
      <view class="ag-quota__text">
        <text class="ag-quota__title">
          {{ t('quota.title') }}
        </text>
        <text v-if="view.exceeded">
          {{ t('quota.exceeded') }}{{ view.blocked ? ` ${t('quota.blocked', { n: num(view.blocked) })}` : '' }}
        </text>
        <text v-else>
          {{ t('quota.used', { used: num(view.used), limit: num(view.limit) }) }} {{ t('quota.left', { n: num(view.left) }) }}
        </text>
        <text class="ag-quota__small">
          {{ t('quota.reset') }}
        </text>
      </view>
    </view>
    <view class="ag-quota__bar">
      <view class="ag-quota__fill" :style="{ width: `${view.pct}%` }" />
    </view>
  </view>
</template>

<style lang="scss">
.ag-quota {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 0;
  border-bottom: 1px solid var(--tb-rule);
}
.ag-quota__top {
  display: flex;
  align-items: center;
  gap: 14px;
}
.ag-quota__num {
  font-family: var(--tb-font-display);
  font-weight: 800;
  font-size: 30px;
  line-height: 1.15;
  flex: none;
}
.ag-quota__of {
  font-size: 16px;
  color: var(--tb-ink-3);
  font-weight: 600;
}
.ag-quota__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  font-size: 14px;
  line-height: 1.55;
}
.ag-quota__title {
  font-weight: 700;
}
.ag-quota__small {
  color: var(--tb-ink-3);
  font-size: 12px;
}
.ag-quota__bar {
  height: 3px;
  background: var(--tb-rule-soft);
}
.ag-quota__fill {
  height: 100%;
  background: var(--tb-orange);
  transition: width var(--tb-t-row) var(--tb-ease);
}
.ag-quota.is-over .ag-quota__num {
  color: var(--tb-alarm);
}
.ag-quota.is-over .ag-quota__fill {
  background: var(--tb-alarm);
}
</style>
