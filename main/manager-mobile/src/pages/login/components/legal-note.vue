<script setup lang="ts">
import { computed } from 'vue'
import { t } from '@/i18n'
import { legalParts, legalPath } from '../authKit.mjs'

// "By signing in you accept the terms of use and the privacy policy", both opening Nobix's page.
const props = defineProps<{ sentence: string }>()
const parts = computed(() => legalParts(t(props.sentence)) as { text?: string, link?: string }[])
function open(link: string) {
  uni.navigateTo({ url: legalPath(link) })
}
</script>

<template>
  <view class="legal-note">
    <text>
      <block v-for="(p, i) in parts" :key="i">
        <text v-if="p.link" class="legal-note__link" role="link" @click="open(p.link)">
          {{ t(`mauth.${p.link}`) }}
        </text>
        <text v-else>
          {{ p.text }}
        </text>
      </block>
    </text>
  </view>
</template>

<style lang="scss">
.legal-note {
  font-size: 13px;
  color: var(--tb-ink-2);
  line-height: 1.7;
}
.legal-note__link {
  color: var(--tb-ink);
  font-weight: 600;
  text-decoration: underline;
  text-decoration-color: var(--tb-rule-soft);
  text-underline-offset: 3px;
}
</style>
