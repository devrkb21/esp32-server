<script lang="ts" setup>
import type { KidsSettings } from '@/api/ai/ai'
import { computed, ref, watch } from 'vue'
import { getKids, saveKids } from '@/api/ai/ai'
import { t } from '@/i18n'
import { digits } from '@/utils/calendar.mjs'
import { toast } from '@/utils/toast'
import {
  addTopic,
  hasTopic,
  kidsSignature,
  MAX_AGE,
  MAX_TOPIC_LEN,
  MAX_TOPICS,
  MIN_AGE,
  normalizeKids,
  removeTopic,
  SUGGESTED,
} from './kidsModel.mjs'

// Kids mode of the character (section "শিশু মোড"): on/off, the child's age (3-12) and topics
// TinyBot never talks about. Saved on its own (PUT /agent/{id}/kids), apart from the screen's
// save bar; the robot follows it from its next chat.
defineOptions({ name: 'KidsSection' })

const props = defineProps<{ agentId: string, lang: string }>()

const form = ref<KidsSettings>(normalizeKids(null))
const saved = ref<KidsSettings>(normalizeKids(null))
const draft = ref('')
const loaded = ref(false)
const failed = ref(false)
const saving = ref(false)
let seq = 0

const num = (n: number | string) => digits(n, props.lang)
const dirty = computed(() => loaded.value && kidsSignature(form.value) !== kidsSignature(saved.value))
const full = computed(() => form.value.blockedTopics.length >= MAX_TOPICS)
const suggestions = computed(() => SUGGESTED.map((k: string) => t(`kids.t.${k}`)).filter((s: string) => !hasTopic(form.value.blockedTopics, s)))
const sync = computed(() => {
  if (dirty.value)
    return { state: 'pending' as const, text: t('kids.syncPending') }
  return saved.value.enabled ? { state: 'applied' as const, text: t('kids.syncOn') } : { state: 'off' as const, text: t('kids.syncOff') }
})

async function load() {
  if (!props.agentId)
    return
  const mine = ++seq
  failed.value = false
  try {
    const data = await getKids(props.agentId)
    if (mine !== seq)
      return
    saved.value = normalizeKids(data)
    form.value = normalizeKids(data)
    loaded.value = true
  }
  catch {
    if (mine === seq)
      failed.value = true
  }
}
watch(() => props.agentId, () => load(), { immediate: true })

function add(topic: string) {
  form.value.blockedTopics = addTopic(form.value.blockedTopics, topic)
  if (topic === draft.value)
    draft.value = ''
}
function remove(topic: string) {
  form.value.blockedTopics = removeTopic(form.value.blockedTopics, topic)
}
function setAge(step: number) {
  form.value.age = Math.min(MAX_AGE, Math.max(MIN_AGE, form.value.age + step))
}
function undo() {
  form.value = normalizeKids(saved.value)
  draft.value = ''
}
async function save() {
  if (saving.value)
    return
  saving.value = true
  try {
    const body = normalizeKids(form.value)
    const data = await saveKids(props.agentId, body)
    saved.value = normalizeKids(data || body)
    form.value = normalizeKids(saved.value)
    toast.success(t('kids.saved'))
  }
  catch {
    toast.error(t('kids.saveFailed'))
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <tb-section :title="t('kids.title')" :description="t('kids.desc')">
    <template #actions>
      <tb-sync v-if="loaded" v-bind="sync" />
    </template>

    <view v-if="!loaded && !failed" class="ag-kids__state">
      <tb-loading :label="t('kids.loading')" />
    </view>
    <tb-empty v-else-if="failed && !loaded" :title="t('kids.loadFailed')" :text="t('common.loadFailed')">
      <tb-button icon="refresh" @click="load">
        {{ t('common.retry') }}
      </tb-button>
    </tb-empty>

    <view v-else class="ag-kids" :class="{ 'is-off': !form.enabled }">
      <view class="ag-kids__row">
        <view class="ag-kids__text">
          <text class="ag-kids__label">
            {{ t('kids.enabled') }}
          </text>
          <text class="ag-kids__hint">
            {{ t('kids.enabledHint') }}
          </text>
        </view>
        <tb-switch :model-value="form.enabled" label="" @change="(on: boolean) => (form.enabled = on)" />
      </view>

      <view class="ag-kids__age">
        <text class="ag-kids__label">
          {{ t('kids.age') }}
        </text>
        <view class="ag-kids__stepper">
          <tb-button size="s" icon="minus" :disabled="!form.enabled || form.age <= MIN_AGE" :aria-label="t('kids.younger')" @click="setAge(-1)" />
          <view class="ag-kids__num" role="status" :aria-label="t('kids.ageValue', { n: num(form.age) })">
            <text class="tb-num ag-kids__big">
              {{ num(form.age) }}
            </text>
            <text class="ag-kids__unit">
              {{ t('kids.ageValue', { n: '' }).trim() }}
            </text>
          </view>
          <tb-button size="s" icon="plus" :disabled="!form.enabled || form.age >= MAX_AGE" :aria-label="t('kids.older')" @click="setAge(1)" />
        </view>
        <text class="ag-kids__hint">
          {{ t('kids.ageHint') }}
        </text>
      </view>

      <view class="ag-kids__topics">
        <text class="ag-kids__label">
          {{ t('kids.topics') }}
        </text>
        <text class="ag-kids__hint">
          {{ t('kids.topicsHint') }}
        </text>
        <view v-if="form.blockedTopics.length" class="ag-kids__chips">
          <view v-for="topic in form.blockedTopics" :key="topic" class="ag-kids__chip">
            <text class="ag-kids__chip-name">
              {{ topic }}
            </text>
            <view class="ag-kids__x" role="button" :aria-label="t('kids.remove', { name: topic })" @click="form.enabled && remove(topic)">
              <tb-icon name="close" :size="14" />
            </view>
          </view>
        </view>
        <text v-else class="ag-kids__hint">
          {{ t('kids.noTopics') }}
        </text>
        <view class="ag-kids__add">
          <view class="ag-kids__input">
            <tb-input
              v-model="draft" :maxlength="MAX_TOPIC_LEN" :disabled="!form.enabled || full" :placeholder="t('kids.topicPlaceholder')"
              :aria-label="t('kids.topicInput')" confirm-type="done" @confirm="add(draft)"
            />
          </view>
          <tb-button icon="plus" :disabled="!form.enabled || full || !draft.trim()" @click="add(draft)">
            {{ t('kids.add') }}
          </tb-button>
        </view>
        <text v-if="full" class="ag-kids__hint tb-num">
          {{ t('kids.max', { n: num(MAX_TOPICS) }) }}
        </text>
        <view v-if="suggestions.length" class="ag-kids__suggest">
          <text class="ag-kids__hint">
            {{ t('kids.suggest') }}
          </text>
          <view class="ag-kids__suggest-list">
            <tb-button v-for="s in suggestions" :key="s" size="s" variant="quiet" icon="plus" :disabled="!form.enabled || full" @click="add(s)">
              {{ s }}
            </tb-button>
          </view>
        </view>
      </view>

      <view class="ag-kids__sample">
        <text class="ag-kids__hint">
          {{ t('kids.sample') }}
        </text>
        <text class="ag-kids__line" lang="bn">
          {{ t('kids.sampleLine') }}
        </text>
      </view>

      <view v-if="dirty" class="ag-kids__foot">
        <tb-button variant="quiet" :disabled="saving" @click="undo">
          {{ t('common.undo') }}
        </tb-button>
        <tb-button variant="primary" :loading="saving" @click="save">
          {{ t('common.save') }}
        </tb-button>
      </view>
    </view>
  </tb-section>
</template>

<style lang="scss">
.ag-kids {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.ag-kids__state {
  padding: 24px 0;
  display: flex;
  justify-content: center;
}
.ag-kids__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--tb-rule-soft);
}
.ag-kids__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}
.ag-kids__label {
  font-weight: 600;
  font-size: 15px;
}
.ag-kids__hint {
  color: var(--tb-ink-2);
  font-size: 13px;
  line-height: 1.55;
}
.ag-kids__age,
.ag-kids__topics,
.ag-kids__sample {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ag-kids__stepper {
  display: flex;
  align-items: center;
  gap: 16px;
}
.ag-kids__stepper .tb-btn--s {
  --h: 44px;
  width: 44px;
  padding: 0;
}
.ag-kids__num {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 96px;
  justify-content: center;
}
.ag-kids__big {
  font-family: var(--tb-font-display);
  font-weight: 800;
  font-size: 48px;
  line-height: 1.15;
}
.ag-kids__unit {
  color: var(--tb-ink-2);
  font-size: 14px;
}
.ag-kids__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.ag-kids__chip {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  min-height: 36px;
  padding: 0 2px 0 12px;
  border: 1px solid var(--tb-alarm);
  border-radius: 999px;
  color: var(--tb-alarm);
  max-width: 100%;
}
.ag-kids__chip-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
}
.ag-kids__x {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 36px;
  color: inherit;
}
.ag-kids__add {
  display: flex;
  gap: 8px;
  align-items: center;
}
.ag-kids__input {
  flex: 1;
  min-width: 0;
}
.ag-kids__suggest {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ag-kids__suggest-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 8px;
}
.ag-kids__sample {
  padding-top: 12px;
  border-top: 1px solid var(--tb-rule-soft);
}
.ag-kids__line {
  font-size: 16px;
  line-height: 1.55;
}
.ag-kids__foot {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  flex-wrap: wrap;
}
.ag-kids.is-off .ag-kids__age,
.ag-kids.is-off .ag-kids__topics {
  opacity: 0.6;
  transition: opacity var(--tb-t-fast) var(--tb-ease);
}
</style>
