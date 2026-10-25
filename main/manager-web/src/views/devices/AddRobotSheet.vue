<template>
  <TbSheet :open="open" :title="$t('devices.add.title')" size="s" :close-label="$t('common.close')" @update:open="close">
    <TbChoice v-model="mode" :options="modes" :aria-label="$t('devices.add.how')" />

    <form v-if="mode === 'code'" :id="formId" class="dv-add" @submit.prevent="submitCode">
      <p class="dv-add__help">{{ $t('devices.add.codeHelp') }}</p>
      <TbField :label="$t('devices.add.codeLabel')" :error="codeError" :hint="codeError ? '' : $t('devices.add.codeHint')" :for-id="`${formId}-code`">
        <TbInput :id="`${formId}-code`" class="dv-add__code" :model-value="code" inputmode="numeric" autocomplete="one-time-code"
          :maxlength="6" placeholder="000000" size="l" :invalid="!!codeError" autofocus @update:model-value="onCode" />
      </TbField>
    </form>

    <form v-else :id="formId" class="dv-add" novalidate @submit.prevent="submitManual">
      <p class="dv-add__help">{{ $t('devices.add.manualHelp') }}</p>
      <TbField :label="$t('devices.add.mac')" :error="err('macAddress')" required :for-id="`${formId}-mac`">
        <TbInput :id="`${formId}-mac`" v-model="form.macAddress" placeholder="00:1A:2B:3C:4D:5E" :invalid="!!err('macAddress')"
          autocomplete="off" @blur="touched.macAddress = true" />
      </TbField>
      <div class="dv-add__row">
        <TbField :label="$t('devices.add.board')" :error="err('board')" required :for-id="`${formId}-board`">
          <TbSelect :id="`${formId}-board`" v-model="form.board" :options="boardOptions" :placeholder="$t('devices.add.boardPlaceholder')"
            :invalid="!!err('board')" @change="touched.board = true" />
        </TbField>
        <TbField :label="$t('devices.add.version')" :error="err('appVersion')" required :for-id="`${formId}-ver`">
          <TbInput :id="`${formId}-ver`" v-model="form.appVersion" :placeholder="$t('devices.add.versionPlaceholder')"
            :invalid="!!err('appVersion')" @blur="touched.appVersion = true" />
        </TbField>
      </div>
    </form>

    <template #footer>
      <TbButton variant="secondary" @click="close">{{ $t('common.cancel') }}</TbButton>
      <TbButton variant="primary" native-type="submit" :form="formId" :loading="busy">{{ $t('devices.add.submit') }}</TbButton>
    </template>
  </TbSheet>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import Api from '@/apis/api';
import { toast } from '@/kit/toast';
import { CODE_RE, cleanCode, manualProblems } from './devicesModel';

// Add a robot to this character: by the 6-digit code TinyBot says, or by its MAC address.
const props = defineProps({
  open: Boolean,
  agentId: { type: String, required: true },
  startMode: { type: String, default: 'code' },
  firmwareTypes: { type: Array, default: () => [] },
});
const emit = defineEmits(['update:open', 'added']);
const { t } = useI18n({ useScope: 'global' });

const formId = `dv-add-${Math.random().toString(36).slice(2, 8)}`;
const mode = ref(props.startMode);
const code = ref('');
const codeError = ref('');
const busy = ref(false);
const form = reactive({ macAddress: '', board: '', appVersion: '' });
const touched = reactive({ macAddress: false, board: false, appVersion: false });
const tried = ref(false);

const modes = computed(() => [
  { value: 'code', label: t('devices.add.byCode') },
  { value: 'mac', label: t('devices.add.byMac') },
]);
const boardOptions = computed(() => props.firmwareTypes.map((f) => ({ value: f.key, label: f.name })));
const problems = computed(() => manualProblems(form));
const err = (k) => ((tried.value || touched[k]) && problems.value[k] ? t(`devices.${problems.value[k]}`) : '');

watch(() => props.open, (v) => {
  if (!v) return;
  mode.value = props.startMode;
  code.value = ''; codeError.value = ''; busy.value = false; tried.value = false;
  Object.assign(form, { macAddress: '', board: '', appVersion: '' });
  Object.assign(touched, { macAddress: false, board: false, appVersion: false });
});

function onCode(v) { code.value = cleanCode(v); codeError.value = ''; }
function close() { emit('update:open', false); }

function submitCode() {
  if (!CODE_RE.test(code.value)) {
    codeError.value = t('devices.add.needCode');
    toast.error(t('devices.add.needCode'));
    return;
  }
  busy.value = true;
  Api.device.bindDevice(props.agentId, code.value, ({ data }) => {
    busy.value = false;
    if (data.code === 0) {
      toast.success(t('devices.add.bound'));
      emit('added');
      close();
    } else {
      toast.error(data.msg || t('devices.add.bindFailed'));
    }
  }, (e) => {
    busy.value = false;
    toast.error((e && e.data && e.data.msg) || t('devices.add.bindFailed'));
  });
}

function submitManual() {
  tried.value = true;
  if (Object.keys(problems.value).length) return;
  busy.value = true;
  Api.device.manualAddDevice({ agentId: props.agentId, ...form, appVersion: form.appVersion.trim() }, ({ data }) => {
    busy.value = false;
    if (data.code === 0) {
      toast.success(t('devices.add.added'));
      emit('added');
      close();
    } else {
      toast.error(data.msg || t('devices.add.addFailed'));
    }
  }, (e) => {
    busy.value = false;
    toast.error((e && e.data && e.data.msg) || t('devices.add.addFailed'));
  });
}
</script>

<style>
.dv-add { display: grid; gap: var(--tb-s4); }
.dv-add__help { color: var(--tb-ink-2); font-size: var(--tb-fs-14); }
.dv-add__code .tb-input__el {
  font-family: var(--tb-font-display); font-weight: 800; font-size: var(--tb-fs-24);
  letter-spacing: .35em; text-align: center; font-variant-numeric: tabular-nums;
}
.dv-add__row { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: var(--tb-s4); }
</style>
