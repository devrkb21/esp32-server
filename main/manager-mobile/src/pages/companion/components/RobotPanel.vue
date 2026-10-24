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
  <view v-if="dev">
    <view class="nx-group">
      <view class="nx-group__header">
        {{ t('companion.robot.title') }}
      </view>
      <view class="nx-group__body">
        <view class="nx-row robot__field">
          <view class="robot__label">
            {{ t('companion.robot.name') }}
          </view>
          <wd-input v-model="name" :maxlength="32" clearable no-border placeholder="TinyBot" custom-class="robot__input" @input="namesDirty = true" />
        </view>
        <view class="nx-row robot__field">
          <view class="robot__label">
            {{ t('companion.robot.owner') }}
          </view>
          <wd-input v-model="owner" :maxlength="32" clearable no-border placeholder="Mim" custom-class="robot__input" @input="namesDirty = true" />
        </view>
      </view>
      <view class="nx-group__footer">
        {{ t('companion.robot.ownerHint') }}
      </view>
      <view class="robot__save">
        <wd-button block :loading="savingNames" :disabled="!namesDirty" @click="saveNames">
          {{ t('companion.save') }}
        </wd-button>
      </view>
    </view>

    <view class="nx-group">
      <view class="nx-group__header">
        {{ t('companion.sound.title') }}
      </view>
      <view class="nx-group__body">
        <view class="nx-row">
          <view class="nx-row__main nx-row__title">
            {{ t('companion.sound.fromPhone') }}
          </view>
          <wd-switch :model-value="fromPhone" size="24px" @change="({ value }) => setFromPhone(!!value)" />
        </view>
        <view class="nx-row robot__volume">
          <view class="robot__volume-head">
            <view class="nx-row__title" :class="{ robot__muted: !fromPhone }">
              {{ t('companion.volume') }}
            </view>
            <view class="nx-row__value nx-num">
              {{ fromPhone ? `${volume}%` : t('companion.sound.auto') }}
            </view>
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
        </view>
        <view class="nx-row">
          <view class="nx-row__main nx-row__title">
            {{ t('companion.sound.sounds') }}
          </view>
          <wd-switch :model-value="!!dev.settings?.sounds" size="24px" @change="({ value }) => setSounds(!!value)" />
        </view>
      </view>
      <view class="nx-group__footer nx-mono nx-break">
        {{ t('companion.robot.id', { id: dev.id }) }}
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.robot {
  &__field {
    flex-direction: column;
    align-items: stretch;
    gap: 4rpx;
  }

  &__label {
    font-size: var(--nx-text-footnote);
    color: var(--nx-text-2);
  }

  &__save {
    margin-top: var(--nx-space-3);
  }

  &__volume {
    flex-direction: column;
    align-items: stretch;
    gap: var(--nx-space-1);
  }

  &__volume-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__muted {
    color: var(--nx-text-3);
  }
}

:deep(.robot__input) {
  padding: 0;
  background: transparent;
}
</style>
