<template>
  <TbSheet :open="open" :title="$t('character.tools.sheetTitle')" size="l" :close-label="$t('common.close')" @update:open="(v) => !v && cancel()">
    <div class="ch-tools">
      <div class="ch-tools__pick">
        <div class="ch-tools__head">
          <h3>{{ $t('character.tools.on') }} <span class="tb-num">{{ num(selectedList.length) }}</span></h3>
          <TbButton size="s" variant="quiet" :disabled="!selectedList.length" @click="deselectAll">{{ $t('character.tools.allOff') }}</TbButton>
        </div>
        <ul v-if="selectedList.length" class="ch-tools__list">
          <li v-for="f in selectedList" :key="f.name" :class="{ 'is-current': current && current.name === f.name }">
            <TbCheckbox :model-value="true" :aria-label="f.name" @update:model-value="toggle(f, $event)" />
            <button type="button" class="ch-tools__name" @click="pick(f)"><span>{{ f.name }}</span><TbIcon name="chevron-right" :size="16" /></button>
          </li>
        </ul>
        <p v-else class="ch-tools__empty">{{ $t('character.tools.noneOn') }}</p>

        <div class="ch-tools__head is-second">
          <h3>{{ $t('character.tools.available') }} <span class="tb-num">{{ num(unselected.length) }}</span></h3>
          <TbButton size="s" variant="quiet" :disabled="!unselected.length" @click="selectAll">{{ $t('character.tools.allOn') }}</TbButton>
        </div>
        <ul v-if="unselected.length" class="ch-tools__list is-off">
          <li v-for="f in unselected" :key="f.name">
            <TbCheckbox :model-value="false" :aria-label="f.name" @update:model-value="toggle(f, $event)" />
            <span class="ch-tools__name is-static">{{ f.name }}</span>
          </li>
        </ul>
        <p v-else class="ch-tools__empty">{{ $t('functionDialog.noMorePlugins') }}</p>
      </div>

      <div class="ch-tools__params" aria-live="polite">
        <template v-if="current">
          <h3 class="ch-tools__title">{{ current.name }}</h3>
          <p class="ch-tools__sub">{{ $t('character.tools.settingsOf') }}</p>

          <div v-if="isHomeAssistant(current)" class="ch-ha">
            <p class="ch-ha__lead"><b>{{ $t('functionDialog.smartHomeGuide') }}</b> {{ $t('functionDialog.smartHomeGuideDesc') }}</p>
            <div class="ch-ha__acts">
              <TbButton v-for="d in haDevices" :key="d.key" size="s" icon="plus" @click="insertDevice(d.text)">{{ $t(d.key) }}</TbButton>
            </div>
            <p class="ch-ha__cmds"><span>{{ $t('functionDialog.sampleCommands') }}:</span> {{ $t('character.tools.haSamples') }}</p>
          </div>

          <p v-if="!current.fieldsMeta.length" class="ch-tools__none"><TbIcon name="check" :size="18" />{{ $t('character.tools.noSettings', { name: current.name }) }}</p>
          <div v-else class="ch-tools__form">
            <TbField v-for="field in current.fieldsMeta" :key="field.key" :label="field.label || field.key" :hint="hintOf(field)"
              :for-id="`ch-p-${field.key}`" :error="jsonError[field.key] || ''">
              <TbTextarea v-if="field.type === 'array'" :id="`ch-p-${field.key}`" :model-value="arrayText(field.key)" autosize :rows="3"
                @update:model-value="setParam(field.key, $event)" />
              <TbTextarea v-else-if="field.type === 'json'" :id="`ch-p-${field.key}`" v-model="textCache[field.key]" :rows="6"
                class="ch-tools__json" :invalid="!!jsonError[field.key]" @blur="flushJson(field)" />
              <TbInput v-else-if="field.type === 'number'" :id="`ch-p-${field.key}`" type="number" number inputmode="decimal"
                :model-value="paramOf(field.key)" @update:model-value="setParam(field.key, $event)" />
              <TbSwitch v-else-if="field.type === 'boolean' || field.type === 'bool'" :model-value="Boolean(paramOf(field.key))"
                :aria-label="field.label || field.key" @update:model-value="setParam(field.key, $event)" />
              <TbInput v-else :id="`ch-p-${field.key}`" :model-value="paramOf(field.key) ?? ''" @update:model-value="setParam(field.key, $event)" />
            </TbField>
          </div>
        </template>
        <TbEmpty v-else :title="$t('character.tools.pickOne')" />
      </div>
    </div>
    <template #footer>
      <TbButton @click="cancel">{{ $t('common.cancel') }}</TbButton>
      <TbButton variant="primary" @click="save">{{ $t('character.tools.keep') }}</TbButton>
    </template>
  </TbSheet>
</template>

<script>
import { digits } from '@/kit/calendar';
import { clone, visiblePlugins } from './characterModel';

// Which plugins the character may use, and their settings. The legacy FunctionDialog's rules:
// work on a copy, hand the chosen list back on "keep", drop every edit on cancel.
export default {
  name: 'ToolsSheet',
  props: {
    open: Boolean,
    functions: { type: Array, default: () => [] },
    allFunctions: { type: Array, default: () => [] },
    focusName: { type: String, default: '' },
    addressBook: Boolean,
  },
  emits: ['update:open', 'update-functions', 'closed'],
  data() {
    return { catalog: [], selectedNames: [], currentName: '', drafts: {}, textCache: {}, jsonError: {} };
  },
  computed: {
    visible() { return visiblePlugins(this.catalog, this.addressBook); },
    selectedList() { return this.visible.filter((f) => this.selectedNames.includes(f.name)); },
    unselected() { return this.visible.filter((f) => !this.selectedNames.includes(f.name)); },
    current() {
      const f = this.selectedList.find((x) => x.name === this.currentName);
      return f ? { ...f, fieldsMeta: f.fieldsMeta || [] } : null;
    },
    haDevices() {
      return [
        { key: 'functionDialog.addLight', text: 'Living Room, Ceiling Light, light.living_room' },
        { key: 'functionDialog.addFan', text: 'Bedroom, Ceiling Fan, fan.bedroom' },
        { key: 'functionDialog.addClimate', text: 'Living Room, AC, climate.living_room' },
        { key: 'functionDialog.addSwitch', text: 'Kitchen, Coffee Maker, switch.coffee_maker' },
        { key: 'functionDialog.addLock', text: 'Entrance, Front Door Lock, lock.front_door' },
      ];
    },
  },
  watch: {
    open: { immediate: true, handler(v) { if (v) this.init(); } },
    current(f) { if (f) this.fillCache(f); },
  },
  methods: {
    num(n) { return digits(n, this.$i18n.locale); },
    init() {
      const saved = new Map(this.functions.map((f) => [f.name, f]));
      this.catalog = this.allFunctions.map((f) => {
        const s = saved.get(f.name);
        return { ...clone(f), params: s ? { ...s.params } : { ...(f.params || {}) } };
      });
      this.selectedNames = this.functions.map((f) => f.name)
        .filter((name) => this.addressBook || this.catalog.find((c) => c.name === name)?.providerCode !== 'call_device');
      this.drafts = {};
      this.jsonError = {};
      const focus = this.focusName && this.selectedList.find((f) => f.name === this.focusName);
      this.currentName = (focus || this.selectedList[0])?.name || '';
    },
    fillCache(f) {
      const cache = {};
      (f.fieldsMeta || []).forEach((field) => {
        if (field.type === 'json') {
          try { cache[field.key] = JSON.stringify(this.paramOf(field.key) ?? {}, null, 2); } catch (e) { cache[field.key] = ''; }
        }
      });
      this.textCache = cache;
      this.jsonError = {};
    },
    paramsOf(name) {
      return this.drafts[name] || this.catalog.find((c) => c.name === name)?.params || {};
    },
    paramOf(key) { return this.current ? this.paramsOf(this.current.name)[key] : undefined; },
    arrayText(key) {
      const v = this.paramOf(key);
      return Array.isArray(v) ? v.join('\n') : (v ?? '');
    },
    setParam(key, value) {
      const name = this.current.name;
      const params = { ...this.paramsOf(name), [key]: value };
      this.drafts = { ...this.drafts, [name]: params };
    },
    flushJson(field) {
      try {
        this.setParam(field.key, JSON.parse(this.textCache[field.key] || ''));
        this.jsonError = { ...this.jsonError, [field.key]: '' };
      } catch (e) {
        const msg = `${this.current.name}${this.$t('functionDialog.jsonFormatError')}`;
        this.jsonError = { ...this.jsonError, [field.key]: this.$t('character.tools.jsonError') };
        this.$message.error(msg);
      }
    },
    hintOf(field) {
      return field.default !== undefined && field.default !== null && field.default !== ''
        ? `${this.$t('functionDialog.defaultValue')}: ${typeof field.default === 'object' ? JSON.stringify(field.default) : field.default}` : '';
    },
    pick(f) { this.currentName = f.name; },
    toggle(f, on) {
      this.selectedNames = on ? Array.from(new Set([...this.selectedNames, f.name])) : this.selectedNames.filter((n) => n !== f.name);
      this.currentName = on ? f.name : (this.selectedList[0]?.name || '');
    },
    selectAll() {
      this.selectedNames = this.catalog.map((f) => f.name);
      this.currentName = this.selectedList[0]?.name || '';
    },
    deselectAll() { this.selectedNames = []; this.currentName = ''; },
    isHomeAssistant(f) {
      const code = String(f.providerCode || '').toLowerCase();
      const id = String(f.id || '').toUpperCase();
      const name = String(f.name || '').toLowerCase();
      return code === 'hass_state' || code === 'home_assistant' || id === 'SYSTEM_PLUGIN_HA_STATE' || name.includes('homeassistant') || name.includes('home assistant');
    },
    insertDevice(line) {
      const cur = this.paramOf('devices') || '';
      this.setParam('devices', cur ? `${String(cur).trim()}\n${line}` : line);
      this.$message.success(this.$t('character.tools.deviceAdded'));
    },
    cancel() {
      this.drafts = {};
      this.$emit('update:open', false);
      this.$emit('closed', false);
    },
    save() {
      const selected = this.selectedList.map((f) => ({ id: f.id, name: f.name, params: { ...this.paramsOf(f.name) }, fieldsMeta: f.fieldsMeta || [] }));
      this.$emit('update-functions', selected);
      this.$emit('update:open', false);
      this.$emit('closed', true);
    },
  },
};
</script>

<style>
.ch-tools { display: grid; grid-template-columns: minmax(220px, 300px) minmax(0, 1fr); gap: var(--tb-s6); align-items: start; }
.ch-tools__pick { min-width: 0; }
.ch-tools__head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-bottom: 6px; border-bottom: 1px solid var(--tb-rule); }
.ch-tools__head.is-second { margin-top: var(--tb-s5); }
.ch-tools__head h3 { font-size: var(--tb-fs-15); display: flex; gap: 6px; align-items: baseline; }
.ch-tools__head h3 span { color: var(--tb-ink-2); font-size: var(--tb-fs-13); }
.ch-tools__list { list-style: none; margin: 0; padding: 0; }
.ch-tools__list li { display: flex; align-items: center; gap: 4px; min-height: 44px; padding-left: 4px; border-bottom: 1px solid var(--tb-rule-soft); }
.ch-tools__list li.is-current { box-shadow: inset 3px 0 0 var(--tb-orange); background: var(--tb-paper-2); }
.ch-tools__name { flex: 1; min-width: 0; display: flex; align-items: center; justify-content: space-between; gap: 6px; min-height: 44px; padding: 0 8px 0 4px; border: 0; background: none; text-align: left; font-weight: 600; }
.ch-tools__name span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ch-tools__name.is-static { font-weight: 500; color: var(--tb-ink-2); display: block; line-height: 44px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ch-tools__empty { padding: 12px 4px; color: var(--tb-ink-3); font-size: var(--tb-fs-14); }
.ch-tools__params { min-width: 0; display: grid; gap: var(--tb-s3); align-content: start; }
.ch-tools__title { font-size: var(--tb-fs-20); }
.ch-tools__sub { color: var(--tb-ink-2); font-size: var(--tb-fs-14); margin-top: -8px; }
.ch-tools__none { display: flex; gap: 8px; align-items: center; color: var(--tb-ink-2); padding: 12px 0; border-top: 1px solid var(--tb-rule-soft); }
.ch-tools__form { display: grid; gap: var(--tb-s4); padding-top: var(--tb-s2); border-top: 1px solid var(--tb-rule-soft); }
.ch-tools__json textarea { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: var(--tb-fs-14); }
.ch-ha { display: grid; gap: 10px; padding: 12px 0; border-top: 1px solid var(--tb-rule-soft); }
.ch-ha__lead { font-size: var(--tb-fs-14); color: var(--tb-ink-2); }
.ch-ha__lead b { color: var(--tb-ink); display: block; }
.ch-ha__acts { display: flex; gap: 6px; flex-wrap: wrap; }
.ch-ha__cmds { font-size: var(--tb-fs-13); color: var(--tb-ink-2); }
.ch-ha__cmds span { font-weight: 600; color: var(--tb-ink); }
@media (max-width: 760px) { .ch-tools { grid-template-columns: 1fr; } }
</style>
