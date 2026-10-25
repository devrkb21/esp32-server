<template>
  <TbSheet :open="open" size="l" :title="form.id ? $t('products.editTitle') : $t('products.addTitle')"
    :close-label="$t('common.close')" :close-on-scrim="false" @update:open="$emit('update:open', $event)">
    <form id="product-sheet-form" class="pm-sheet" novalidate @submit.prevent="submit">
      <p v-if="serverError" class="pm-sheet__server" role="alert">{{ serverError }}</p>

      <div class="pm-sheet__pair">
        <TbField :label="$t('products.key')" :hint="keyHint" :error="errorText('productKey')" required for-id="pm-key">
          <TbInput id="pm-key" v-model="form.productKey" :disabled="!!form.id" :maxlength="50"
            :invalid="!!errorText('productKey')" placeholder="tinybot" autocomplete="off" @blur="touch('productKey')" />
        </TbField>
        <TbField :label="$t('products.sort')" :hint="$t('products.sortHint')" :error="errorText('sort')" for-id="pm-sort">
          <TbInput id="pm-sort" v-model="form.sort" type="number" number inputmode="numeric" :invalid="!!errorText('sort')" @blur="touch('sort')" />
        </TbField>
      </div>

      <div class="pm-sheet__pair pm-sheet__pair--even">
        <TbField :label="$t('products.nameBn')" for-id="pm-name-bn">
          <TbInput id="pm-name-bn" v-model="form.nameBn" :maxlength="100" placeholder="টাইনিবট" />
        </TbField>
        <TbField :label="$t('products.nameEn')" :error="errorText('nameEn')" required for-id="pm-name-en">
          <TbInput id="pm-name-en" v-model="form.nameEn" :maxlength="100" placeholder="TinyBot" :invalid="!!errorText('nameEn')"
            @blur="touch('nameEn')" />
        </TbField>
      </div>

      <TbField :label="$t('products.description')" for-id="pm-desc">
        <TbTextarea id="pm-desc" v-model="form.description" :rows="2" :maxlength="500" />
      </TbField>

      <TbField :label="$t('products.icon')" :hint="$t('products.iconHint')" :error="errorText('iconUrl')" for-id="pm-icon">
        <TbInput id="pm-icon" v-model="form.iconUrl" type="url" :maxlength="500" placeholder="https://" :invalid="!!errorText('iconUrl')"
          @blur="touch('iconUrl')" />
      </TbField>

      <TbField :label="$t('products.boards')" :hint="$t('products.boardsHint')" :error="errorText('boardTypes')" required for-id="pm-boards">
        <TbInput id="pm-boards" v-model="form.boardTypes" :maxlength="500" placeholder="tinybot, tinybot-*"
          :invalid="!!errorText('boardTypes')" @blur="touch('boardTypes')" />
      </TbField>

      <fieldset class="pm-sheet__features">
        <legend>{{ $t('products.features') }} <span class="tb-num">{{ num(featureCount) }}</span></legend>
        <p class="pm-sheet__help">{{ $t('products.featuresHint') }}</p>
        <ul class="pm-feats">
          <li v-for="f in KNOWN_FEATURES" :key="f">
            <TbCheckbox v-model="form.features" :value="f">
              <span class="pm-feat"><span>{{ $t(`products.feature.${f}`) }}</span><code>{{ f }}</code></span>
            </TbCheckbox>
          </li>
        </ul>
        <TbField :label="$t('products.extra')" :hint="$t('products.extraHint')" :error="errorText('features')" for-id="pm-extra">
          <TbInput id="pm-extra" v-model="form.extraFeatures" :maxlength="300" placeholder="night_light, radio"
            :invalid="!!errorText('features')" @blur="touch('features')" />
        </TbField>
      </fieldset>

      <div class="pm-sheet__status">
        <TbSwitch v-model="form.status" :label="form.status ? $t('products.statusOn') : $t('products.statusOff')" />
        <p class="pm-sheet__help">{{ $t('products.statusHint') }}</p>
      </div>
    </form>
    <template #footer>
      <TbButton :disabled="saving" @click="$emit('update:open', false)">{{ $t('common.cancel') }}</TbButton>
      <TbButton variant="primary" icon="check" native-type="submit" form="product-sheet-form" :loading="saving">
        {{ saving ? $t('common.saving') : $t('common.save') }}</TbButton>
    </template>
  </TbSheet>
</template>

<script>
import { digits } from '@/kit/calendar';
import { KNOWN_FEATURES, featuresOf, isValid, toForm, toPayload, validate } from './productsModel';

// Add or edit one product (super admins). The key is fixed once a product exists; features are
// the known keys as checkboxes plus any extra keys typed in. The server's own message (a key
// already taken, a pattern it refuses) shows above the form when it says no.
export default {
  name: 'ProductSheet',
  props: {
    open: Boolean,
    product: { type: Object, default: null },
    saving: Boolean,
    serverError: { type: String, default: '' },
    serverField: { type: String, default: '' },
  },
  emits: ['update:open', 'submit'],
  data() {
    return { KNOWN_FEATURES, form: toForm(null), touched: {}, tried: false };
  },
  computed: {
    errors() { return validate(this.form); },
    featureCount() { return featuresOf(this.form).length; },
    keyHint() { return this.form.id ? this.$t('products.keyLocked') : this.$t('products.keyHint'); },
  },
  watch: {
    open: {
      immediate: true,
      handler(v) {
        if (!v) return;
        this.form = toForm(this.product);
        this.touched = {};
        this.tried = false;
      },
    },
  },
  methods: {
    num(n) { return digits(n, this.$i18n.locale); },
    touch(field) { this.touched = { ...this.touched, [field]: true }; },
    errorText(field) {
      const code = this.errors[field];
      if (code && (this.tried || this.touched[field])) return this.$t(`products.err.${field}.${code}`);
      if (this.serverField === field && this.serverError) return this.serverError;
      return '';
    },
    submit() {
      if (this.saving) return;
      this.tried = true;
      if (!isValid(this.errors)) return;
      this.$emit('submit', toPayload(this.form));
    },
  },
};
</script>

<style>
.pm-sheet { display: grid; gap: var(--tb-s4); }
.pm-sheet__server { padding: var(--tb-s2) 0; border-top: 1px solid var(--tb-danger); border-bottom: 1px solid var(--tb-danger); color: var(--tb-danger); font-size: var(--tb-fs-14); }
.pm-sheet__pair { display: grid; grid-template-columns: minmax(0, 2fr) minmax(120px, 1fr); gap: var(--tb-s4); }
.pm-sheet__pair--even { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
.pm-sheet__features { margin: 0; padding: var(--tb-s3) 0 0; border: 0; border-top: 1px solid var(--tb-rule); display: grid; gap: var(--tb-s2); }
.pm-sheet__features legend { padding: 0; font-weight: 700; font-size: var(--tb-fs-15); }
.pm-sheet__features legend .tb-num { color: var(--tb-ink-2); font-weight: 600; margin-left: 6px; }
.pm-sheet__help { color: var(--tb-ink-2); font-size: var(--tb-fs-13); }
.pm-feats { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); column-gap: var(--tb-s4); }
.pm-feats li { border-bottom: 1px solid var(--tb-rule-soft); }
.pm-feat { display: inline-flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.pm-feat code { font: 500 var(--tb-fs-12) var(--tb-font-text); color: var(--tb-ink-3); }
.pm-sheet__status { display: grid; gap: 2px; padding-top: var(--tb-s3); border-top: 1px solid var(--tb-rule); }
@media (max-width: 560px) {
  .pm-sheet__pair, .pm-sheet__pair--even { grid-template-columns: 1fr; }
}
</style>
