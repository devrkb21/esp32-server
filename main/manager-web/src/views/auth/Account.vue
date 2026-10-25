<template>
  <div class="account">
    <TbPageHeader :title="$t('nav.account')" :description="$t('auth.account.desc')">
      <template #actions>
        <TbButton icon="logout" @click="signOut">{{ $t('nav.logout') }}</TbButton>
      </template>
    </TbPageHeader>

    <div class="account__grid">
      <TbSection :title="$t('auth.account.details')">
        <dl class="account__rows">
          <div class="account__row">
            <dt>{{ $t('auth.account.username') }}</dt>
            <dd>{{ user.username || $t('auth.account.unknown') }}</dd>
          </div>
          <div class="account__row">
            <dt>{{ $t('auth.account.role') }}</dt>
            <dd>
              <TbTag v-if="user.superAdmin" variant="line">{{ $t('auth.account.admin') }}</TbTag>
              <span v-else>{{ $t('auth.account.owner') }}</span>
            </dd>
          </div>
          <div class="account__row">
            <dt>{{ $t('nav.language') }}</dt>
            <dd>{{ languageLabel }}</dd>
          </div>
        </dl>
        <p v-if="loadFailed" class="account__fail" role="alert">{{ $t('common.loadFailed') }}
          <TbButton size="s" variant="quiet" icon="refresh" @click="loadUser">{{ $t('common.retry') }}</TbButton></p>
      </TbSection>

      <TbSection :title="$t('auth.account.password')" :description="$t('auth.account.passwordHint')">
        <form class="account__form" novalidate @submit.prevent="changePassword">
          <TbField :label="$t('auth.account.old')" for-id="acc-old" required :error="errors.old">
            <TbInput id="acc-old" v-model="pw.old" type="password" autocomplete="current-password" :invalid="!!errors.old"
              :show-label="$t('auth.showPassword')" :hide-label="$t('auth.hidePassword')" @update:model-value="errors.old = ''" />
          </TbField>
          <TbField :label="$t('auth.account.new')" for-id="acc-new" required :error="errors.next">
            <TbInput id="acc-new" v-model="pw.next" type="password" autocomplete="new-password" :invalid="!!errors.next"
              :show-label="$t('auth.showPassword')" :hide-label="$t('auth.hidePassword')" @update:model-value="errors.next = ''" />
          </TbField>
          <TbField :label="$t('auth.account.confirm')" for-id="acc-confirm" required :error="errors.confirm">
            <TbInput id="acc-confirm" v-model="pw.confirm" type="password" autocomplete="new-password" :invalid="!!errors.confirm"
              :show-label="$t('auth.showPassword')" :hide-label="$t('auth.hidePassword')" @update:model-value="errors.confirm = ''" />
          </TbField>
          <p v-if="failure" class="account__alert" role="alert"><TbIcon name="warning" :size="18" />{{ failure }}</p>
          <div class="account__actions">
            <TbButton variant="primary" native-type="submit" icon="key" :loading="busy">{{ $t('auth.account.submit') }}</TbButton>
            <TbButton variant="quiet" :disabled="!dirty || busy" @click="reset">{{ $t('common.cancel') }}</TbButton>
          </div>
        </form>
      </TbSection>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useStore } from 'vuex';
import Api from '@/apis/api';
import { toast } from '@/kit/toast';
import { LANGUAGES } from '@/i18n';
import { useBusy } from './useAuth';

// The signed-in account: who you are, and the password change of the old ChangePasswordDialog
// (all three fields, new twice and different from the old; signed out after a change).
const { t, locale } = useI18n({ useScope: 'global' });
const store = useStore();
const { busy, on: busyOn, off: busyOff } = useBusy();

const user = computed(() => store.getters.getUserInfo || {});
const languageLabel = computed(() => (LANGUAGES.find((l) => l.code === locale.value) || {}).label || locale.value);
const loadFailed = ref(false);

const pw = reactive({ old: '', next: '', confirm: '' });
const errors = reactive({ old: '', next: '', confirm: '' });
const failure = ref('');
const dirty = computed(() => Boolean(pw.old || pw.next || pw.confirm));

function reset() {
  pw.old = ''; pw.next = ''; pw.confirm = '';
  errors.old = ''; errors.next = ''; errors.confirm = ''; failure.value = '';
}

function loadUser() {
  loadFailed.value = false;
  Api.user.getUserInfo(({ data }) => {
    if (data && data.code === 0 && data.data) store.commit('setUserInfo', data.data);
    else loadFailed.value = true;
  });
}

function changePassword() {
  failure.value = '';
  errors.old = pw.old.trim() ? '' : t('auth.account.required');
  errors.next = pw.next.trim() ? '' : t('auth.account.required');
  errors.confirm = pw.confirm.trim() ? '' : t('auth.account.required');
  if (!errors.next && !errors.confirm && pw.next !== pw.confirm) errors.confirm = t('auth.err.mismatch');
  if (!errors.old && !errors.next && pw.next === pw.old) errors.next = t('auth.account.same');
  const first = ['old', 'next', 'confirm'].find((k) => errors[k]);
  if (first) {
    document.getElementById({ old: 'acc-old', next: 'acc-new', confirm: 'acc-confirm' }[first])?.focus();
    return;
  }
  busyOn();
  Api.user.changePassword(pw.old, pw.next, (res) => {
    busyOff();
    if (res.data.code === 0) {
      reset();
      toast.success(t('auth.account.done'));
      store.dispatch('logout');
    } else {
      failure.value = res.data.msg || t('auth.account.failed');
    }
  }, (err) => {
    busyOff();
    failure.value = (err && err.msg) || t('auth.account.failed');
  });
}

function signOut() { store.dispatch('logout'); }

onMounted(loadUser);
</script>

<style>
.account { padding-bottom: var(--tb-s10); }
.account__grid { display: grid; grid-template-columns: minmax(0, 1fr); }
.account__rows { margin: 0; border-top: 1px solid var(--tb-rule); }
.account__row { display: grid; grid-template-columns: minmax(110px, 160px) minmax(0, 1fr); gap: 12px; align-items: center;
  min-height: 52px; padding: 8px 0; border-bottom: 1px solid var(--tb-rule-soft); }
.account__row dt { color: var(--tb-ink-2); font-size: var(--tb-fs-14); font-weight: 600; }
.account__row dd { margin: 0; font-weight: 600; overflow-wrap: anywhere; }
.account__fail { display: flex; align-items: center; gap: 8px; color: var(--tb-danger); font-size: var(--tb-fs-14); }
.account__form { display: grid; gap: var(--tb-s4); max-width: 440px; }
.account__alert { display: flex; gap: 8px; align-items: flex-start; color: var(--tb-danger); font-weight: 500; font-size: var(--tb-fs-14); }
.account__actions { display: flex; gap: 8px; flex-wrap: wrap; padding-top: 4px; }
@media (min-width: 1000px) {
  .account__grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); column-gap: var(--tb-s10); }
  .account__grid > .tb-section { border-bottom: 0; }
}
@media (max-width: 640px) {
  .account__actions > .tb-btn { flex: 1; }
}
</style>
