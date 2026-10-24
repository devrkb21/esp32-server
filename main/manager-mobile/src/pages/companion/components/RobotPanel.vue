<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { t } from '@/i18n'
import { useCompanion } from './context'

defineOptions({
  name: 'CompanionRobotPanel',
})

const { dev, save } = useCompanion()

// name and owner name: local drafts that follow the server until edited
const name = ref('')
const owner = ref('')
const namesDirty = ref(false)
const savingNames = ref(false)
watch(() => [dev.value?.name, dev.value?.settings?.owner_name], ([n, o]) => {
  if (!namesDirty.value) {
    name.value = n || ''
    owner.value = o || ''
  }
}, { immediate: true })

async function saveNames() {
  savingNames.value = true
  const ok = await save({
    name: name.value.trim() || 'TinyBot',
    settings: { owner_name: owner.value.trim() },
  })
  savingNames.value = false
  if (ok)
    namesDirty.value = false
}

// volume: null = the robot keeps its own volume
const fromPhone = computed(() => dev.value?.settings?.volume !== null && dev.value?.settings?.volume !== undefined)
const volume = ref(70)
watch(() => [dev.value?.settings?.volume, dev.value?.stats?.volume], ([v, reported]) => {
  volume.value = (v ?? reported ?? 70) as number
}, { immediate: true })

async function setFromPhone(on: boolean) {
  await save({ settings: { volume: on ? volume.value : null } })
}

async function onVolumeEnd(value: unknown) {
  const v = typeof value === 'object' && value !== null ? (value as { value: number }).value : Number(value)
  if (!Number.isFinite(v))
    return
  volume.value = v
  await save({ settings: { volume: v } }, t('companion.robot.volumeSet', { n: v }))
}

async function setSounds(on: boolean) {
  if (dev.value)
    dev.value.settings.sounds = on
  await save({ settings: { sounds: on } })
}
</script>

<template>
  <view v-if="dev" class="flex flex-col gap-[20rpx]">
    <view class="rounded-[20rpx] bg-white p-[28rpx] shadow-[0_2rpx_12rpx_rgba(0,0,0,0.04)]">
      <text class="mb-[12rpx] block text-[30rpx] text-[#232338] font-semibold">
        🤖 {{ t('companion.robot.title') }}
      </text>
      <text class="mb-[8rpx] block text-[26rpx] text-[#65686f]">
        {{ t('companion.robot.name') }}
      </text>
      <wd-input v-model="name" :maxlength="32" clearable placeholder="TinyBot" @input="namesDirty = true" />
      <text class="mb-[8rpx] mt-[24rpx] block text-[26rpx] text-[#65686f]">
        {{ t('companion.robot.owner') }}
      </text>
      <wd-input v-model="owner" :maxlength="32" clearable placeholder="Mim" @input="namesDirty = true" />
      <text class="mt-[6rpx] block text-[22rpx] text-[#9d9ea3]">
        {{ t('companion.robot.ownerHint') }}
      </text>
      <view class="mt-[24rpx]">
        <wd-button type="primary" block :loading="savingNames" :disabled="!namesDirty" @click="saveNames">
          {{ t('companion.save') }}
        </wd-button>
      </view>
    </view>

    <view class="rounded-[20rpx] bg-white p-[28rpx] shadow-[0_2rpx_12rpx_rgba(0,0,0,0.04)]">
      <text class="mb-[12rpx] block text-[30rpx] text-[#232338] font-semibold">
        🔊 {{ t('companion.sound.title') }}
      </text>
      <view class="flex items-center justify-between py-[14rpx]">
        <text class="text-[28rpx] text-[#232338]">
          {{ t('companion.sound.fromPhone') }}
        </text>
        <wd-switch :model-value="fromPhone" size="20" @change="({ value }) => setFromPhone(!!value)" />
      </view>
      <view class="flex items-center justify-between py-[10rpx]">
        <text class="text-[26rpx] text-[#65686f]">
          {{ t('companion.volume') }}
        </text>
        <text class="text-[26rpx] text-[#336cff] font-semibold">
          {{ fromPhone ? `${volume}%` : t('companion.sound.auto') }}
        </text>
      </view>
      <wd-slider
        v-model="volume"
        :min="0"
        :max="100"
        :step="5"
        hide-label
        hide-min-max
        :disabled="!fromPhone"
        @dragend="onVolumeEnd"
      />
      <view class="flex items-center justify-between py-[14rpx]">
        <text class="text-[28rpx] text-[#232338]">
          {{ t('companion.sound.sounds') }}
        </text>
        <wd-switch :model-value="!!dev.settings?.sounds" size="20" @change="({ value }) => setSounds(!!value)" />
      </view>
    </view>

    <text class="text-center text-[22rpx] text-[#9d9ea3]">
      {{ t('companion.robot.id', { id: dev.id }) }}
    </text>
  </view>
</template>
