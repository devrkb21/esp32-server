<route lang="jsonc">
{
  "layout": "tabbar",
  "style": {
    "navigationStyle": "custom",
    "navigationBarTitleText": "TinyBot"
  }
}
</route>

<script lang="ts" setup>
import { t } from '@/i18n'

// Placeholder: this page is rebuilt by its owner (see .bunshin/owners.json).
defineOptions({ name: 'LookPage' })
</script>

<template>
  <view class="tb-wrap">
    <tb-page-header :title="t('nav.look')" />
    <tb-empty face="awake" :title="t('nav.look')" />
  </view>
</template>
