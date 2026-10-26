<script lang="ts" setup>
import type { LibraryItem, LibraryKind } from '@/api/companion'
import { computed, ref } from 'vue'
import { t } from '@/i18n'
import { tbConfirm } from '@/utils/tbConfirm'
import { toast } from '@/utils/toast'
import { useDay } from '../dayContext'
import { LIBRARY_KINDS, libraryPayload, libraryProblem, MAX_TEXT, MAX_TITLE, MAX_URL } from '../dayVoiceModel.mjs'
import DayField from './DayField.vue'

// The library: the robot's own items (links or texts) and the shared samples. Play sends the
// `play` command with the item id; the server turns it into the audio link.
const KIND_INK: Record<string, string> = { story: 'routine', rhyme: 'look', music: 'message', recitation: 'prayer' }
const day = useDay()
const items = computed<LibraryItem[]>(() => day.view?.library || [])
const open = ref(false)
const error = ref('')
const form = ref({ title: '', kind: 'story' as LibraryKind, source: 'link', url: '', text: '' })

const kindOptions = computed(() => (LIBRARY_KINDS as string[]).map(k => ({ value: k, label: t(`dayVoice.library.kind.${k}`) })))
const sourceOptions = computed(() => [
  { value: 'link', label: t('dayVoice.library.byLink') },
  { value: 'text', label: t('dayVoice.library.byText') },
])

function openAdd() {
  form.value = { title: '', kind: 'story', source: 'link', url: '', text: '' }
  error.value = ''
  open.value = true
}
async function submit() {
  const problem = libraryProblem(form.value)
  if (problem) {
    error.value = t(problem)
    toast.warning(error.value)
    return
  }
  error.value = ''
  if (await day.save({ library: { add: libraryPayload(form.value) as any } }, 'library'))
    open.value = false
}
async function remove(item: LibraryItem) {
  const ok = await tbConfirm({ title: t('dayVoice.library.deleteTitle'), message: t('dayVoice.library.confirmDelete', { title: item.title }), confirmText: t('common.delete'), danger: true })
  if (ok)
    await day.save({ library: { delete: [item.id] } }, 'library', t('day.deleted'))
}
function play(item: LibraryItem) {
  day.command('play', item.id, t('dayVoice.library.playing'), `play-${item.id}`)
}
defineExpose({ add: openAdd })
</script>

<template>
  <tb-section :title="t('day.tab.library')" :description="t('dayVoice.library.desc')" ink="message">
    <template #actions>
      <tb-sync v-bind="day.syncOf('library')" />
    </template>

    <tb-empty v-if="!items.length" face="sleepy" :title="t('dayVoice.library.none')" :text="t('dayVoice.library.emptyText')" />
    <view v-else class="drows">
      <view v-for="it in items" :key="it.id" class="drow vlib">
        <view class="drow__body">
          <text class="drow__title">
            {{ it.title }}
          </text>
          <view class="vlib__tags">
            <tb-tag :ink="KIND_INK[it.kind]" mark>
              {{ t(`dayVoice.library.kind.${it.kind}`) }}
            </tb-tag>
            <tb-tag v-if="it.source === 'default'">
              {{ t('dayVoice.library.sample') }}
            </tb-tag>
            <text class="drow__meta">
              {{ it.text ? t('dayVoice.library.byText') : t('dayVoice.library.byLink') }}
            </text>
          </view>
        </view>
        <view class="vlib__acts">
          <tb-button size="s" variant="secondary" icon="play" :loading="day.busy === `play-${it.id}`" :aria-label="t('dayVoice.library.play')" @click="play(it)">
            {{ t('dayVoice.library.play') }}
          </tb-button>
          <tb-button v-if="it.source !== 'default'" size="s" variant="quiet" icon="trash" :aria-label="t('dayVoice.library.delete', { title: it.title })" @click="remove(it)" />
        </view>
      </view>
    </view>
    <view class="dfoot">
      <tb-button variant="primary" icon="plus" @click="openAdd">
        {{ t('dayVoice.library.add') }}
      </tb-button>
    </view>

    <tb-sheet v-model:open="open" :title="t('dayVoice.library.add')">
      <DayField :label="t('dayVoice.library.title')">
        <tb-input v-model="form.title" :maxlength="MAX_TITLE" clearable :aria-label="t('dayVoice.library.title')" />
      </DayField>
      <DayField :label="t('dayVoice.library.kind')">
        <tb-choice v-model="form.kind" wrap :options="kindOptions" :aria-label="t('dayVoice.library.kind')" />
      </DayField>
      <DayField :label="t('dayVoice.library.source')">
        <tb-choice v-model="form.source" wrap :options="sourceOptions" :aria-label="t('dayVoice.library.source')" />
      </DayField>
      <DayField v-if="form.source === 'link'" :label="t('dayVoice.library.url')" :hint="t('dayVoice.library.urlHint')" :error="error">
        <tb-input v-model="form.url" :maxlength="MAX_URL" clearable placeholder="https://" :aria-label="t('dayVoice.library.url')" />
      </DayField>
      <DayField v-else :label="t('dayVoice.library.text')" :error="error">
        <view class="dsay">
          <textarea v-model="form.text" class="dsay__el" :maxlength="MAX_TEXT" auto-height placeholder-class="dsay__ph" />
          <text class="tb-num dsay__count">
            {{ day.num(form.text.length) }}/{{ day.num(MAX_TEXT) }}
          </text>
        </view>
      </DayField>
      <template #footer>
        <tb-button variant="primary" :loading="!!day.saving.library" @click="submit">
          {{ t('common.save') }}
        </tb-button>
      </template>
    </tb-sheet>
  </tb-section>
</template>

<style lang="scss">
.vlib {
  align-items: flex-start;
}
.vlib__tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding-top: 4px;
}
.vlib__acts {
  flex: none;
  display: flex;
  align-items: center;
  gap: 2px;
}
</style>
