<route lang="jsonc">
{
  "layout": "default",
  "style": {
    "navigationStyle": "custom",
    "navigationBarTitleText": "TinyBot"
  }
}
</route>

<script lang="ts" setup>
import { t } from '@/i18n'

// Placeholder: this page is rebuilt by its owner (see .bunshin/owners.json).
defineOptions({ name: 'RobotPage' })
</script>

<template>
  <view class="tb-wrap">
    <tb-page-header :title="t('nav.robot')" back />
    <tb-empty face="awake" :title="t('nav.robot')" />
  </view>
</template>
