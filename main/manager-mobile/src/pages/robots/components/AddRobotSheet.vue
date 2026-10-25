<script lang="ts" setup>
// Add a robot to a character: by the 6-digit code TinyBot says (POST /device/bind/{agentId}/{code})
// or by MAC address (POST /device/manual-add). Used by Robots and by the device list.
import type { FirmwareType } from '@/api/device'
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { bindDevice, bindDeviceManual, getFirmwareTypes } from '@/api/device'
import { t } from '@/i18n'
import { toast } from '@/utils/toast'
import { cleanCode, hasErrors, isValidCode, manualErrors } from '../robotsModel.mjs'

const props = withDefaults(defineProps<{
  open?: boolean
  agents?: { id: string, agentName: string }[]
  agentId?: string
  mode?: 'code' | 'mac'
}>(), { open: false, agents: () => [], agentId: '', mode: 'code' })
const emit = defineEmits<{ (e: 'update:open', v: boolean): void, (e: 'added', agentId: string): void }>()

const target = ref('')
const addMode = ref<'code' | 'mac'>('code')
const code = ref('')
const codeError = ref('')
const adding = ref(false)
const manual = reactive({ macAddress: '', board: '', appVersion: '' })
const touched = reactive({ macAddress: false, board: false, appVersion: false })
const boards = ref<FirmwareType[]>([])
let boardsLoaded = false

const agentIndex = computed(() => Math.max(0, props.agents.findIndex(a => a.id === target.value)))
const agentNames = computed(() => props.agents.map(a => a.agentName))
const boardNames = computed(() => boards.value.map(b => b.name))
const boardIndex = computed(() => boards.value.findIndex(b => b.key === manual.board))
const errors = computed(() => {
  const e = manualErrors(manual)
  const text: Record<string, string> = {
    macAddress: ({ required: t('robots.add.macRequired'), invalid: t('robots.add.macInvalid') } as Record<string, string>)[e.macAddress] || '',
    board: e.board ? t('robots.add.boardRequired') : '',
    appVersion: e.appVersion ? t('robots.add.versionRequired') : '',
  }
  return Object.fromEntries(Object.entries(text).map(([k, v]) => [k, (touched as any)[k] ? v : ''])) as Record<string, string>
})
const modes = computed(() => [{ value: 'code', label: t('robots.add.byCode') }, { value: 'mac', label: t('robots.add.byMac') }])

function reset() {
  addMode.value = props.mode
  code.value = ''
  codeError.value = ''
  adding.value = false
  Object.assign(manual, { macAddress: '', board: '', appVersion: '' })
  Object.assign(touched, { macAddress: false, board: false, appVersion: false })
  target.value = props.agentId && props.agents.some(a => a.id === props.agentId) ? props.agentId : (props.agentId || props.agents[0]?.id || '')
  if (addMode.value === 'mac')
    loadBoards()
}
watch(() => props.open, (v) => {
  if (v)
    reset()
})

async function loadBoards() {
  if (boardsLoaded)
    return
  try {
    boards.value = (await getFirmwareTypes()) || []
    boardsLoaded = true
  }
  catch (e: any) {
    toast.error(e?.message || t('robots.add.boardsFailed'))
  }
}

function onMode(v: any) {
  if (v === 'mac')
    loadBoards()
}
function onCode(v: string) {
  // take what was typed, then settle on the clean code so the field shows it
  code.value = v
  codeError.value = ''
  nextTick(() => {
    code.value = cleanCode(v)
  })
}
function onAgent(e: any) {
  const a = props.agents[Number(e?.detail?.value)]
  if (a)
    target.value = a.id
}
function onBoard(e: any) {
  const b = boards.value[Number(e?.detail?.value)]
  if (b)
    manual.board = b.key
  touched.board = true
}
function close() {
  emit('update:open', false)
}

async function submit() {
  if (adding.value)
    return
  const agentId = target.value
  if (!agentId) {
    toast.error(t('robots.add.noCharacter'))
    return
  }
  if (addMode.value === 'code') {
    if (!isValidCode(code.value)) {
      codeError.value = t('robots.add.codeInvalid')
      return
    }
    adding.value = true
    try {
      await bindDevice(agentId, code.value.trim())
      toast.success(t('robots.add.bound'))
      emit('added', agentId)
      close()
    }
    catch (e: any) {
      toast.error(e?.message || t('robots.add.bindFailed'))
    }
    adding.value = false
    return
  }
  Object.assign(touched, { macAddress: true, board: true, appVersion: true })
  if (hasErrors(manualErrors(manual)))
    return
  adding.value = true
  try {
    await bindDeviceManual({ agentId, board: manual.board, appVersion: manual.appVersion.trim(), macAddress: manual.macAddress.trim() })
    toast.success(t('robots.add.added'))
    emit('added', agentId)
    close()
  }
  catch (e: any) {
    toast.error(e?.message || t('robots.add.addFailed'))
  }
  adding.value = false
}
</script>

<template>
  <tb-sheet :open="open" :title="t('robots.add.title')" :close-on-scrim="!adding" @update:open="(v: boolean) => emit('update:open', v)">
    <view v-if="agents.length > 1" class="ars__field">
      <text class="ars__label">
        {{ t('robots.add.character') }}
      </text>
      <picker mode="selector" :range="agentNames" :value="agentIndex" @change="onAgent">
        <view class="ars__pick" role="button">
          <text class="ars__pickv">
            {{ agents[agentIndex]?.agentName || '' }}
          </text>
          <tb-icon name="chevron-down" :size="18" />
        </view>
      </picker>
    </view>

    <view class="ars__field">
      <text class="ars__label">
        {{ t('robots.add.how') }}
      </text>
      <tb-choice v-model="addMode" :options="modes" :aria-label="t('robots.add.how')" @change="onMode" />
    </view>

    <block v-if="addMode === 'code'">
      <text class="ars__help">
        {{ t('robots.add.codeHelp') }}
      </text>
      <view class="ars__field">
        <text class="ars__label">
          {{ t('robots.add.code') }}
        </text>
        <tb-input
          class="ars__code" :model-value="code" type="number" size="l" :maxlength="6" placeholder="000000"
          :invalid="!!codeError" :aria-label="t('robots.add.code')" confirm-type="done" @update:model-value="onCode" @confirm="submit"
        />
        <text v-if="codeError" class="ars__err" role="alert">
          {{ codeError }}
        </text>
        <text v-else class="ars__hint">
          {{ t('robots.add.codeHint') }}
        </text>
      </view>
    </block>

    <block v-else>
      <text class="ars__help">
        {{ t('robots.add.macHelp') }}
      </text>
      <view class="ars__field">
        <text class="ars__label">
          {{ t('robots.add.mac') }}
        </text>
        <tb-input
          v-model="manual.macAddress" placeholder="00:1A:2B:3C:4D:5E" :maxlength="17" :invalid="!!errors.macAddress"
          :aria-label="t('robots.add.mac')" @blur="touched.macAddress = true"
        />
        <text v-if="errors.macAddress" class="ars__err" role="alert">
          {{ errors.macAddress }}
        </text>
      </view>
      <view class="ars__field">
        <text class="ars__label">
          {{ t('robots.add.board') }}
        </text>
        <picker mode="selector" :range="boardNames" :value="Math.max(0, boardIndex)" @change="onBoard">
          <view class="ars__pick" :class="{ 'is-invalid': !!errors.board }" role="button">
            <text class="ars__pickv" :class="{ 'is-ph': boardIndex < 0 }">
              {{ boardIndex >= 0 ? boards[boardIndex].name : t('robots.add.boardPlaceholder') }}
            </text>
            <tb-icon name="chevron-down" :size="18" />
          </view>
        </picker>
        <text v-if="errors.board" class="ars__err" role="alert">
          {{ errors.board }}
        </text>
      </view>
      <view class="ars__field">
        <text class="ars__label">
          {{ t('robots.add.version') }}
        </text>
        <tb-input
          v-model="manual.appVersion" :placeholder="t('robots.add.versionPlaceholder')" :maxlength="32"
          :invalid="!!errors.appVersion" :aria-label="t('robots.add.version')" @blur="touched.appVersion = true" @confirm="submit"
        />
        <text v-if="errors.appVersion" class="ars__err" role="alert">
          {{ errors.appVersion }}
        </text>
      </view>
    </block>

    <template #footer>
      <tb-button :disabled="adding" @click="close">
        {{ t('common.cancel') }}
      </tb-button>
      <tb-button variant="primary" :loading="adding" @click="submit">
        {{ t('robots.add.confirm') }}
      </tb-button>
    </template>
  </tb-sheet>
</template>

<style lang="scss">
.ars__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ars__label {
  font-size: 13px;
  font-weight: 600;
  color: var(--tb-ink-2);
}
.ars__help {
  font-size: 14px;
  color: var(--tb-ink-2);
}
.ars__hint {
  font-size: 13px;
  color: var(--tb-ink-2);
}
.ars__err {
  font-size: 13px;
  color: var(--tb-danger);
}
.ars__code .tb-input__el {
  font-family: var(--tb-font-display);
  font-weight: 800;
  font-size: 24px;
  letter-spacing: 0.3em;
  font-variant-numeric: tabular-nums;
}
.ars__pick {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 46px;
  padding: 0 12px;
  border: 1.5px solid var(--tb-ink);
  border-radius: var(--tb-radius-m);
  background: var(--tb-paper);
  color: var(--tb-ink);
}
.ars__pick.is-invalid {
  border-color: var(--tb-danger);
}
.ars__pickv {
  flex: 1;
  min-width: 0;
  font-size: 16px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ars__pickv.is-ph {
  color: var(--tb-ink-3);
}
</style>
