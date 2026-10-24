<template>
  <CustomDialog :title="tt('user.newPasswordTitle', 'New password')" :visible="visible" width="440px"
    :cancel-text="tt('user.close', 'Close')" :confirm-text="tt('user.copyPassword', 'Copy password')"
    @update:visible="val => $emit('update:visible', val)" @close="closeDialog"
    @confirm="copyPassword">
    <div class="pw">
      <span class="nx-icon-tile pw__icon" aria-hidden="true"><i class="el-icon-lock"></i></span>
      <p class="pw__lead">{{ $t('user.resetPasswordSuccess') }}</p>
      <label class="pw__label" for="nx-generated-password">{{ $t('user.generatedPassword') }}</label>
      <div class="pw__field">
        <input id="nx-generated-password" ref="field" class="pw__value nx-mono" :value="password" readonly
          @focus="$event.target.select()" />
        <button type="button" class="nx-icon-btn" :aria-label="tt('user.copyPassword', 'Copy password')"
          @click="copyPassword">
          <i class="el-icon-document-copy" aria-hidden="true"></i>
        </button>
      </div>
      <p class="pw__hint">{{ tt('user.newPasswordHint', 'This password is shown only once. Share it with the user privately.') }}</p>
    </div>
  </CustomDialog>
</template>

<script>
import CustomDialog from './CustomDialog.vue';

export default {
  name: 'ViewPasswordDialog',
  components: { CustomDialog },
  props: {
    visible: { type: Boolean, required: true },
    password: { type: String, default: '' }
  },
  methods: {
    tt(key, fallback) {
      return this.$te(key) || this.$te(key, 'en') ? this.$t(key) : fallback;
    },
    closeDialog() {
      this.$emit('update:visible', false)
    },
    copyPassword() {
      const done = () => this.$message.success({
        message: this.tt('user.passwordCopied', 'Password copied'),
        showClose: true
      });
      const fail = () => {
        // Clipboard unavailable (e.g. plain http): select the text so it can be copied by hand
        if (this.$refs.field) this.$refs.field.select();
        this.$message.error(this.$t('common.copyFailed'));
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(this.password).then(done, fail);
      } else {
        fail();
      }
    }
  }
}
</script>

<style scoped lang="scss">
.pw {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--nx-space-2);
  &__icon {
    margin-bottom: var(--nx-space-2);
  }
  &__lead {
    margin: 0 0 var(--nx-space-3);
    font-size: var(--nx-text-callout);
    color: var(--nx-text-2);
  }
  &__label {
    font-size: var(--nx-text-footnote);
    color: var(--nx-text-2);
  }
  &__field {
    display: flex;
    align-items: center;
    gap: var(--nx-space-1);
    width: 100%;
    padding: var(--nx-space-1) var(--nx-space-1) var(--nx-space-1) var(--nx-space-4);
    background: var(--nx-surface-2);
    border-radius: var(--nx-radius);
  }
  &__value {
    flex: 1;
    min-width: 0;
    height: var(--nx-control-h);
    border: 0;
    outline: none;
    background: transparent;
    color: var(--nx-text);
    font-size: var(--nx-text-headline);
    font-weight: 600;
    letter-spacing: 0.04em;
  }
  &__hint {
    margin: 0;
    font-size: var(--nx-text-caption);
    color: var(--nx-text-3);
  }
}
</style>
