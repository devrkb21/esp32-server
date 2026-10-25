<route lang="jsonc">
{
  "layout": "default",
  "style": {
    "navigationStyle": "custom",
    "navigationBarTitleText": "Nobix"
  }
}
</route>

<script lang="ts" setup>
import { onLoad } from '@dcloudio/uni-app'
import { selectRobot } from '@/utils/tbRobot'

// The old companion screen is split into Today, Day, Messages, Look and Robot. Links that still
// open it (with ?deviceId=&agentId=) choose that robot and land on Today.
defineOptions({ name: 'CompanionRedirect' })
onLoad((q: any) => {
  if (q?.deviceId)
    selectRobot({ deviceId: q.deviceId, agentId: q.agentId || '', name: q.name || '' })
  uni.switchTab({ url: '/pages/index/index' })
})
</script>

<template>
  <view class="tb-wrap"><tb-loading /></view>
</template>
