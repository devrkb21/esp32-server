<template>
  <div class="tq">
    <RouterLink to="/agent-template-management" class="tq__back">
      <TbIcon name="chevron-left" :size="16" /><span>{{ $t('templates.back') }}</span>
    </RouterLink>

    <TbPageHeader :title="form.agentName || $t('templates.newName')" :description="$t('templates.editorDesc')">
      <template v-if="state === 'ready'" #actions>
        <span class="tq__state" :class="{ 'is-dirty': pending }" role="status">
          <TbIcon :name="pending ? 'dot' : 'check'" :size="16" />{{ pending ? $t('templates.unsaved') : $t('templates.upToDate') }}
        </span>
        <TbButton icon="refresh" :disabled="!dirty" @click="resetConfig">{{ $t('templates.reset') }}</TbButton>
        <TbButton variant="primary" native-type="submit" form="tq-form" :loading="saving">{{ $t('templates.saveTemplate') }}</TbButton>
      </template>
    </TbPageHeader>

    <div v-if="state === 'loading'" class="tq__wait"><TbLoading :label="$t('common.loading')" show-label /></div>

    <TbEmpty v-else-if="state === 'missing'" face="confused" :title="$t('templates.notFound')" :text="$t('templates.notFoundText')">
      <TbButton to="/agent-template-management" icon="chevron-left">{{ $t('templates.back') }}</TbButton>
    </TbEmpty>

    <div v-else class="tq__grid">
      <form id="tq-form" class="tq__form" novalidate @submit.prevent="saveConfig">
        <TbField :label="$t('templates.name')" for-id="tq-name" required :hint="$t('templates.nameHint')" :error="errText('agentName')">
          <TbInput id="tq-name" v-model="form.agentName" :maxlength="NAME_MAX" :invalid="!!errors.agentName"
            :placeholder="$t('templates.namePlaceholder')" @blur="check('agentName')" />
        </TbField>
        <TbField :label="$t('templates.prompt')" for-id="tq-prompt" required :hint="promptHint" :error="errText('systemPrompt')">
          <TbTextarea id="tq-prompt" v-model="form.systemPrompt" class="tq__prompt" :class="{ 'is-near': near }" :rows="16"
            autosize show-count :maxlength="PROMPT_MAX" :invalid="!!errors.systemPrompt"
            :placeholder="$t('templates.promptPlaceholder')" @blur="check('systemPrompt')" />
        </TbField>
      </form>

      <aside class="tq__side">
        <TbSection :title="$t('templates.modelsTitle')" :description="templateId ? $t('templates.modelsDesc') : $t('templates.modelsDefault')">
          <dl class="tq__models">
            <div v-for="[key, label] in MODEL_FIELDS" :key="key" class="tq__model">
              <dt>{{ $t(label) }}</dt>
              <dd>{{ form.model[key] }}</dd>
            </div>
            <div class="tq__model">
              <dt>{{ $t('templates.order') }}</dt>
              <dd class="tb-num">{{ num(form.sort) }}</dd>
            </div>
          </dl>
        </TbSection>
      </aside>
    </div>
  </div>
</template>

<script>
import agentApi from '@/apis/module/agent';
import { digits } from '@/kit/calendar';
import {
  MODEL_FIELDS, NAME_MAX, PROMPT_MAX, PROMPT_NEAR, clone, emptyForm, formFromTemplate, nextSort, payloadOf, snapshot, validate,
} from './templateModel';

export default {
  name: 'TemplateQuickConfig',
  data() {
    return {
      NAME_MAX,
      PROMPT_MAX,
      MODEL_FIELDS,
      form: emptyForm(),
      templateId: '',
      originalForm: null,
      state: 'loading', // loading | ready | missing
      saving: false,
      errors: {},
      leaving: false,
    };
  },
  computed: {
    lang() { return this.$i18n.locale; },
    promptLength() { return String(this.form.systemPrompt || '').length; },
    near() { return this.promptLength >= PROMPT_NEAR; },
    promptHint() {
      return this.near ? this.$t('templates.promptNear', { n: this.num(PROMPT_MAX - this.promptLength) }) : this.$t('templates.promptHint');
    },
    dirty() { return this.state === 'ready' && !!this.originalForm && snapshot(this.form) !== snapshot(this.originalForm); },
    // a new template is not saved until it is created, even untouched
    pending() { return this.dirty || !this.templateId; },
  },
  mounted() {
    const templateId = this.$route.query.templateId;
    if (templateId) {
      this.fetchTemplateById(templateId);
    } else {
      // create mode: a default name, and a place after the last template
      this.form = emptyForm(this.$t('templates.newName'), 1);
      this.fetchTemplateListForSort();
    }
  },
  beforeRouteLeave(to, from, next) {
    if (!this.dirty || this.leaving) { next(); return; }
    this.$confirm(this.$t('templates.discard'), this.$t('templates.discardTitle'), {
      confirmText: this.$t('templates.discardOk'), cancelText: this.$t('templates.keepEditing'), danger: true,
    }).then(() => next()).catch(() => next(false));
  },
  methods: {
    num(n) { return digits(n, this.lang); },
    errText(k) { return this.errors[k] ? this.$t(this.errors[k]) : ''; },
    check(k) { const e = validate(this.form); this.errors = { ...this.errors, [k]: e[k] }; },
    goToHome() { this.$router.push('/agent-template-management'); },

    fetchTemplateById(templateId) {
      this.state = 'loading';
      agentApi.getAgentTemplateById(templateId, (res) => {
        if (res && res.data && res.data.code === 0 && res.data.data) {
          this.form = formFromTemplate(res.data.data, this.form);
          this.templateId = templateId;
          this.originalForm = clone(this.form);
          this.state = 'ready';
        } else {
          this.state = 'missing';
          this.$message.error(res?.data?.msg || this.$t('templates.notFound'));
        }
      });
    },
    fetchTemplateListForSort() {
      agentApi.getAgentTemplate((res) => {
        const list = res && res.data && res.data.code === 0 ? res.data.data : [];
        this.form.sort = nextSort(list);
        this.originalForm = clone(this.form);
        this.state = 'ready';
      });
    },

    saveConfig() {
      const e = validate(this.form);
      this.errors = e;
      if (Object.keys(e).length) {
        document.getElementById(e.agentName ? 'tq-name' : 'tq-prompt')?.focus();
        return;
      }
      const data = payloadOf({ ...this.form, id: this.templateId || '' });
      this.saving = true;
      if (this.templateId) {
        agentApi.updateAgentTemplate(data, (res) => {
          this.saving = false;
          if (res && res.data && res.data.code === 0) {
            this.$message.success(this.$t('templates.saved'));
            this.originalForm = clone(this.form);
          } else {
            this.$message.error(res?.data?.msg || this.$t('templates.saveFailed'));
          }
        });
      } else {
        agentApi.addAgentTemplate(data, (res) => {
          this.saving = false;
          if (res && res.data && res.data.code === 0) {
            this.$message.success(this.$t('templates.saved'));
            this.leaving = true;
            this.goToHome();
          } else {
            this.$message.error(res?.data?.msg || this.$t('templates.saveFailed'));
          }
        });
      }
    },
    resetConfig() {
      this.$confirm(this.$t('templates.resetText'), this.$t('templates.resetTitle'), {
        confirmText: this.$t('templates.reset'), cancelText: this.$t('common.cancel'), danger: true,
      }).then(() => {
        if (this.originalForm) this.form = clone(this.originalForm);
        this.errors = {};
        this.$message.success(this.$t('templates.resetDone'));
      }).catch(() => {});
    },
  },
};
</script>

<style scoped>
.tq__back {
  display: inline-flex; align-items: center; gap: 4px; min-height: 44px; margin-top: var(--tb-s3);
  color: var(--tb-ink-2); font-weight: 600; font-size: var(--tb-fs-14); text-decoration: none;
  transition: color var(--tb-t-hover) var(--tb-ease);
}
.tq__back:hover { color: var(--tb-ink); }
.tq__back:focus-visible { outline: 2px solid var(--tb-focus); outline-offset: 2px; border-radius: 4px; }
.tq :deep(.tb-pagehead) { padding-top: var(--tb-s2); }
.tq :deep(.tb-pagehead__title) { overflow-wrap: anywhere; }
.tq :deep(.tb-pagehead__actions) { align-items: center; }

.tq__state { display: inline-flex; align-items: center; gap: 6px; margin-right: var(--tb-s2); color: var(--tb-ok); font-size: var(--tb-fs-13); font-weight: 600; }
.tq__state.is-dirty { color: var(--tb-warn); }

.tq__wait { display: grid; place-items: center; padding: var(--tb-s12) 0; }

.tq__grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(240px, 320px); gap: 0 var(--tb-s8); align-items: start; }
.tq__form { display: grid; gap: var(--tb-s5); padding: var(--tb-s5) 0 var(--tb-s6); }
.tq__prompt :deep(textarea) { min-height: 320px; }
.tq__prompt.is-near :deep(.tb-textarea__count) { color: var(--tb-warn); font-weight: 600; }

.tq__side { position: sticky; top: var(--tb-s4); }
.tq__side :deep(.tb-section) { border-bottom: 0; }
.tq__models { display: grid; border-top: 1px solid var(--tb-rule); }
.tq__model { display: grid; gap: 2px; padding: 8px 0; border-bottom: 1px solid var(--tb-rule-soft); }
.tq__model dt { margin: 0; color: var(--tb-ink-2); font-size: var(--tb-fs-13); }
.tq__model dd { margin: 0; font-size: var(--tb-fs-14); font-weight: 600; overflow-wrap: anywhere; }

@media (max-width: 899px) {
  .tq__grid { grid-template-columns: minmax(0, 1fr); }
  .tq__side { position: static; border-top: 1px solid var(--tb-rule); }
  .tq__prompt :deep(textarea) { min-height: 260px; }
}
@media (max-width: 640px) {
  .tq :deep(.tb-pagehead__actions) { width: 100%; }
  .tq :deep(.tb-pagehead__actions .tb-btn) { flex: 1; min-height: 44px; }
  .tq__state { flex-basis: 100%; }
  .tq__model { grid-template-columns: 44% 1fr; gap: 8px; }
}
</style>
