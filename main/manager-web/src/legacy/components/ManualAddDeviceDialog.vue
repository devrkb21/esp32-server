<template>
  <CustomDialog
    :title="$t('manualAddDeviceDialog.title')"
    :visible="visible"
    width="520px"
    :destroy-on-close="false"
    :confirmText="tx('device.addRobotAction', 'Add robot')"
    :cancelText="$t('manualAddDeviceDialog.cancel')"
    @close="closeDialog"
    @confirm="submitForm"
  >
    <p class="nx-manual__help">
      {{ tx('device.manualHelp', 'Use this when the robot cannot say a code. You find the MAC address on the robot’s settings screen or label.') }}
    </p>
    <el-form :model="deviceForm" :rules="rules" ref="deviceForm" label-position="top" class="nx-manual__form">
      <el-form-item :label="$t('manualAddDeviceDialog.macAddress')" prop="macAddress">
        <el-input v-model="deviceForm.macAddress" class="nx-manual__mac"
          :placeholder="$t('manualAddDeviceDialog.macAddressPlaceholder')" autocomplete="off" spellcheck="false"></el-input>
      </el-form-item>
      <div class="nx-manual__row">
        <el-form-item :label="$t('manualAddDeviceDialog.deviceType')" prop="board">
          <el-select v-model="deviceForm.board" :placeholder="$t('manualAddDeviceDialog.deviceTypePlaceholder')" filterable class="nx-manual__full">
            <el-option
              v-for="item in firmwareTypes"
              :key="item.key"
              :label="item.name"
              :value="item.key">
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item :label="$t('manualAddDeviceDialog.firmwareVersion')" prop="appVersion">
          <el-input v-model="deviceForm.appVersion" :placeholder="$t('manualAddDeviceDialog.firmwareVersionPlaceholder')"></el-input>
        </el-form-item>
      </div>
    </el-form>
  </CustomDialog>
</template>

<script>
import Api from '@/apis/api';
import CustomDialog from './CustomDialog.vue';

export default {
  name: 'ManualAddDeviceDialog',
  components: { CustomDialog },
  props: {
    visible: { type: Boolean, required: true },
    agentId: { type: String, required: true }
  },
  data() {
    const validateMac = (rule, value, callback) => {
      const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
      if (!value) {
        callback(new Error(this.$t('manualAddDeviceDialog.requiredMacAddress')));
      } else if (!macRegex.test(value)) {
        callback(new Error(this.$t('manualAddDeviceDialog.invalidMacAddress')));
      } else {
        callback();
      }
    };

    return {
      deviceForm: {
        board: '',
        appVersion: '',
        macAddress: ''
      },
      firmwareTypes: [],
      rules: {
        board: [
          { required: true, message: this.$t('manualAddDeviceDialog.requiredDeviceType'), trigger: 'change' }
        ],
        appVersion: [
          { required: true, message: this.$t('manualAddDeviceDialog.requiredFirmwareVersion'), trigger: 'blur' }
        ],
        macAddress: [
          { required: true, validator: validateMac, trigger: 'blur' }
        ]
      }
    };
  },
  created() {
    this.getFirmwareTypes();
  },
  methods: {
    tx(key, fallback) {
      return this.$te(key) || this.$te(key, 'en') ? this.$t(key) : fallback;
    },
    async getFirmwareTypes() {
      try {
        const res = await Api.dict.getDictDataByType('FIRMWARE_TYPE');
        this.firmwareTypes = res.data;
      } catch (error) {
        console.error('Failed to get firmware type:', error);
        this.$message.error(error.message || this.$t('manualAddDeviceDialog.getFirmwareTypeFailed'));
      }
    },
    submitForm() {
      this.$refs.deviceForm.validate((valid) => {
        if (valid) {
          this.addDevice();
        }
      });
    },
    addDevice() {
      const params = {
        agentId: this.agentId,
        ...this.deviceForm
      };

      Api.device.manualAddDevice(params, ({ data }) => {
        if (data.code === 0) {
          this.$message.success(this.$t('manualAddDeviceDialog.addSuccess'));
          this.$emit('refresh');
          this.closeDialog();
        } else {
          this.$message.error(data.msg || this.$t('manualAddDeviceDialog.addFailed'));
        }
      });
    },
    closeDialog() {
      this.$emit('update:visible', false);
      this.$refs.deviceForm.resetFields();
    }
  }
};
</script>

<style lang="scss" scoped>
.nx-manual__help {
  margin: 0 0 var(--nx-space-5);
  font-size: var(--nx-text-callout);
  color: var(--nx-text-2);
}
.nx-manual__row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  column-gap: var(--nx-space-4);
}
.nx-manual__full {
  width: 100%;
}
.nx-manual__mac ::v-deep .el-input__inner {
  font-family: var(--nx-font-mono);
  letter-spacing: 0.02em;
}
.nx-manual__form ::v-deep .el-form-item:last-child {
  margin-bottom: 0;
}
</style>
