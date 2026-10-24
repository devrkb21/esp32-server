<script setup lang="ts">
import { computed } from 'vue'
import { t } from '@/i18n'
import { confirmState, settleConfirm } from '@/utils/tbConfirm'

const c = computed(() => confirmState.current)
</script>

<template>
  <tb-sheet :open="confirmState.open" :title="c?.title || ''" @update:open="(v: boolean) => !v && settleConfirm(false)">
    <text v-if="c" class="tb-confirm__msg">{{ c.message }}</text>
    <template #footer>
      <tb-button @click="settleConfirm(false)">{{ c?.cancelText || t('common.cancel') }}</tb-button>
      <tb-button :variant="c?.danger ? 'danger' : 'primary'" @click="settleConfirm(true)">{{ c?.confirmText || t('common.ok') }}</tb-button>
    </template>
  </tb-sheet>
</template>

<style lang="scss">
.tb-confirm__msg { white-space: pre-line; font-size: 15px; }
</style>
