<script setup lang="ts">
import { computed } from 'vue'
import { getCurrentLanguage, t } from '@/i18n'
import { productName } from '@/utils/tbProducts.mjs'
import { robot } from '@/utils/tbRobot'

// The calm "not on this device" state of a feature page the chosen robot's product lacks (see
// hooks/useFeatureGate.ts), with the way back to Today.
const name = computed(() => robot.name || productName(robot, getCurrentLanguage()) || t('nav.robotFallback'))
function goToday() {
  uni.switchTab({ url: '/pages/index/index', fail: () => uni.reLaunch({ url: '/pages/index/index' }) })
}
</script>

<template>
  <view class="tb-not-here" role="status">
    <tb-empty :title="t('product.notHere.title')" :text="t('product.notHere.text', { name })">
      <tb-button variant="primary" icon="today" @click="goToday">
        {{ t('product.notHere.today') }}
      </tb-button>
    </tb-empty>
  </view>
</template>

<style lang="scss">
.tb-not-here { padding: 32px 0; }
</style>
