<template>
  <CustomDialog
    :title="$t('device.dialogTitle')"
    :visible.sync="visible"
    width="440px"
    :confirmLoading="loading"
    @confirm="confirm"
    @cancel="cancel"
    @close="handleClose"
    @open="focusInput"
    :confirmText="tx('device.addRobotAction', 'Add robot')"
    :cancelText="$t('device.cancelButton')"
  >
    <div class="nx-add-code">
      <div class="nx-add-code__intro">
        <span class="nx-icon-tile" aria-hidden="true"><i class="el-icon-microphone"></i></span>
        <p class="nx-add-code__help">
          {{ tx('device.codeHelp', 'Turn TinyBot on and connect it to Wi-Fi. When it says a 6-digit code, type it below.') }}
        </p>
      </div>

      <label class="nx-add-code__label" for="nx-device-code">{{ $t('device.verificationCode') }}</label>
      <el-input
        id="nx-device-code"
        ref="codeInput"
        v-model="deviceCode"
        class="nx-add-code__input"
        :placeholder="tx('device.codePlaceholder', '000000')"
        maxlength="6"
        inputmode="numeric"
        autocomplete="one-time-code"
        @input="onCodeInput"
        @keyup.enter.native="confirm"
      />
      <p class="nx-add-code__hint">
        {{ tx('device.codeHint', 'The code is valid for a few minutes. Missed it? Restart the robot to hear a new one.') }}
      </p>
    </div>
  </CustomDialog>
</template>

<script>
import Api from '@/apis/api';
import CustomDialog from './CustomDialog.vue';

export default {
  name: 'AddDeviceDialog',
  components: { CustomDialog },
  props: {
    visible: { type: Boolean, required: true },
    agentId: { type: String, required: true }
  },
  data() {
    return {
      deviceCode: "",
      loading: false,
    }
  },
  methods: {
    // Pending i18n keys fall back to their English text until the lead merges them
    tx(key, fallback) {
      return this.$te(key) || this.$te(key, 'en') ? this.$t(key) : fallback;
    },
    onCodeInput(value) {
      this.deviceCode = String(value || '').replace(/\D/g, '').slice(0, 6);
    },
    focusInput() {
      this.$nextTick(() => {
        if (this.$refs.codeInput) this.$refs.codeInput.focus();
      });
    },
    confirm() {
      if (!/^\d{6}$/.test(this.deviceCode)) {
        this.$message.error(this.$t('device.input6DigitCode'));
        return;
      }
      this.loading = true;
      Api.device.bindDevice(
        this.agentId,
        this.deviceCode,
        ({ data }) => {
          this.loading = false;
          if (data.code === 0) {
            this.$emit('refresh');
            this.$message.success({
              message: this.$t('device.bindSuccess'),
              showClose: true
            });
            this.closeDialog();
          } else {
            this.$message.error({
              message: data.msg || this.$t('device.bindFailed'),
              showClose: true
            });
          }
        },
        (err) => {
          this.loading = false;
          const msg = err && err.data && err.data.msg;
          this.$message.error({
            message: msg || this.$t('device.bindFailed'),
            showClose: true
          });
        }
      );
    },
    closeDialog() {
      this.loading = false;
      this.deviceCode = '';
      this.$emit('update:visible', false);
    },
    cancel() {
      this.closeDialog();
    },
    handleClose() {
      this.closeDialog();
    }
  }
}
</script>

<style lang="scss" scoped>
.nx-add-code {
  display: flex;
  flex-direction: column;

  &__intro {
    display: flex;
    align-items: flex-start;
    gap: var(--nx-space-3);
    padding: var(--nx-space-3);
    margin-bottom: var(--nx-space-5);
    border-radius: var(--nx-radius);
    background: var(--nx-surface-2);
  }
  &__help {
    margin: 0;
    font-size: var(--nx-text-callout);
    line-height: 1.43;
    color: var(--nx-text-2);
    align-self: center;
  }
  &__label {
    margin-bottom: var(--nx-space-2);
    font-size: var(--nx-text-footnote);
    color: var(--nx-text-2);
  }
  &__input ::v-deep .el-input__inner {
    height: var(--nx-control-h-lg);
    font-family: var(--nx-font-mono);
    font-size: var(--nx-text-title);
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.4em;
    text-align: center;
  }
  &__input ::v-deep .el-input__inner::placeholder {
    letter-spacing: 0.4em;
    color: var(--nx-text-3);
  }
  &__hint {
    margin: var(--nx-space-2) 0 0;
    font-size: var(--nx-text-caption);
    color: var(--nx-text-3);
  }
}
</style>
