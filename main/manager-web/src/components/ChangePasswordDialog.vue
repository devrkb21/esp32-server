<template>
  <form class="change-password" novalidate @submit.prevent="confirm">
    <CustomDialog
      :title="$t('changePassword.title')"
      :visible.sync="dialogVisible"
      width="480px"
      :confirmText="$t('changePassword.confirmButton')"
      :cancelText="$t('changePassword.cancelButton')"
      @cancel="cancel"
      @confirm="confirm">
      <div class="password-form">
        <p class="password-form__hint">
          <i class="el-icon-info" aria-hidden="true"></i>
          {{ tt('changePassword.signOutHint', "You'll be signed out after changing your password.") }}
        </p>

        <div class="password-field">
          <label class="password-field__label" for="cp-old">
            {{ label('changePassword.oldPasswordLabel') }}<span class="password-field__required" aria-hidden="true">*</span>
          </label>
          <el-input id="cp-old" v-model="oldPassword" :placeholder="$t('changePassword.oldPasswordPlaceholder')"
            type="password" show-password autocomplete="current-password" aria-required="true" />
        </div>

        <div class="password-field">
          <label class="password-field__label" for="cp-new">
            {{ label('changePassword.newPasswordLabel') }}<span class="password-field__required" aria-hidden="true">*</span>
          </label>
          <el-input id="cp-new" v-model="newPassword" :placeholder="$t('changePassword.newPasswordPlaceholder')"
            type="password" show-password autocomplete="new-password" aria-required="true" />
        </div>

        <div class="password-field">
          <label class="password-field__label" for="cp-confirm">
            {{ label('changePassword.confirmPasswordLabel') }}<span class="password-field__required" aria-hidden="true">*</span>
          </label>
          <el-input id="cp-confirm" v-model="confirmNewPassword"
            :placeholder="$t('changePassword.confirmPasswordPlaceholder')" type="password" show-password
            autocomplete="new-password" aria-required="true" />
        </div>
      </div>
    </CustomDialog>
  </form>
</template>

<script>
import userApi from '@/apis/module/user';
import { mapActions } from 'vuex';
import CustomDialog from '@/components/CustomDialog.vue';

export default {
  name: 'ChangePasswordDialog',
  props: {
    value: {
      type: Boolean,
      required: true
    }
  },
  data() {
    return {
      dialogVisible: this.value,
      oldPassword: "",
      newPassword: "",
      confirmNewPassword: ""
    }
  },
  components: {
    CustomDialog
  },
  watch: {
    value(val) {
      this.dialogVisible = val;
    },
    dialogVisible(val) {
      this.$emit('input', val);
    }
  },
  methods: {
    ...mapActions(['logout']), // Import Vuex logout action
    // Translate with an English fallback for strings still pending in src/i18n/_pending
    tt(key, fallback) {
      return this.$te(key) ? this.$t(key) : fallback;
    },
    // Labels sit above fields, so drop the trailing colon some locales include
    label(key) {
      return this.$t(key).replace(/\s*[:：]\s*$/, '');
    },
    confirm() {
      if (!this.oldPassword.trim() || !this.newPassword.trim() || !this.confirmNewPassword.trim()) {
        this.$message.error(this.$t('changePassword.allFieldsRequired'));
        return;
      }
      if (this.newPassword !== this.confirmNewPassword) {
        this.$message.error(this.$t('changePassword.passwordsNotMatch'));
        return;
      }
      if (this.newPassword === this.oldPassword) {
        this.$message.error(this.$t('changePassword.newPasswordSameAsOld'));
        return;
      }

      // API call after update
      userApi.changePassword(this.oldPassword, this.newPassword, (res) => {
        if (res.data.code === 0) {
          this.$message.success({
            message: this.$t('changePassword.passwordChangedSuccessfully'),
            showClose: true
          });
          this.logout().then(() => {
            this.$router.push('/login');
          });
        } else {
          this.$message.error(res.data.msg || this.$t('changePassword.changeFailed'));
        }
      }, (err) => {
        this.$message.error(err.msg || this.$t('changePassword.changeFailed'));
      });
      this.dialogVisible = false;
    },
    cancel() {
      this.resetForm();
    },
    resetForm() {
      this.oldPassword = "";
      this.newPassword = "";
      this.confirmNewPassword = "";
    }
  }
}
</script>

<style lang="scss" scoped>
.password-form {
  display: flex;
  flex-direction: column;
  gap: var(--nx-space-4);

  &__hint {
    display: flex;
    align-items: flex-start;
    gap: var(--nx-space-2);
    margin: 0;
    padding: 10px 12px;
    border-radius: var(--nx-radius);
    background: var(--nx-info-soft);
    color: var(--nx-text-2);
    font-size: var(--nx-text-footnote);
    line-height: 1.45;

    i {
      flex: none;
      margin-top: 1px;
      color: var(--nx-info);
    }
  }
}

.password-field {
  display: flex;
  flex-direction: column;
  gap: 6px;

  &__label {
    font-size: var(--nx-text-footnote);
    font-weight: 500;
    color: var(--nx-text-2);
  }
  &__required {
    margin-left: 2px;
    color: var(--nx-danger);
  }
}
</style>
