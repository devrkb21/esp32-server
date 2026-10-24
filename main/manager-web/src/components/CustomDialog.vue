<template>
  <el-dialog
    :title="title"
    :visible.sync="dialogVisible"
    :width="width"
    :close-on-click-modal="closeOnClickModal"
    :close-on-press-escape="closeOnPressEscape"
    :show-close="showClose"
    :destroy-on-close="destroyOnClose"
    :custom-class="dialogCustomClass"
    class="custom-dialog"
    @close="handleClose"
    @open="handleOpen"
  >
    <template slot="title">
      <slot name="title">
        <div class="dialog-title">
          <span>{{ title }}</span>
        </div>
      </slot>
    </template>
    <slot></slot>
    <template slot="footer">
      <div v-if="footer" class="dialog-footer">
        <CustomButton @click="handleCancel">{{ cancelText }}</CustomButton>
        <CustomButton :loading="confirmLoading" type="confirm" @click="handleConfirm">
          <span class="confirm-inner">{{ confirmText }}</span>
        </CustomButton>
      </div>
    </template>
  </el-dialog>
</template>

<script>
import CustomButton from './CustomButton.vue';
export default {
  name: "CustomDialog",
  props: {
    title: {
      type: String,
      default: ""
    },
    visible: {
      type: Boolean,
      default: false
    },
    confirmLoading: {
      type: Boolean,
      default: false
    },
    width: {
      type: String,
      default: "720px"
    },
    footer: {
      type: Boolean,
      default: true
    },
    closeOnClickModal: {
      type: Boolean,
      default: false
    },
    closeOnPressEscape: {
      type: Boolean,
      default: true
    },
    showClose: {
      type: Boolean,
      default: true
    },
    destroyOnClose: {
      type: Boolean,
      default: true
    },
    customClass: {
      type: String,
      default: ""
    },
    size: {
      type: String,
      default: "small",
      validator: (val) => ["small", "large"].includes(val),
    },
    cancelText: {
      type: String,
      default: "Cancel"
    },
    confirmText: {
      type: String,
      default: "Confirm Save"
    }
  },
  data() {
    return {
      dialogVisible: this.visible
    };
  },
  computed: {
    dialogCustomClass() {
      const classes = ["custom-dialog"];
      if (this.customClass) classes.push(this.customClass);
      if (this.size === "large") classes.push("custom-dialog--large");
      if (String(this.width).includes("%")) classes.push("custom-dialog--fluid");
      return classes.join(" ");
    },
  },
  components: {
    CustomButton
  },
  watch: {
    visible(val) {
      this.dialogVisible = val;
    }
  },
  methods: {
    handleClose() {
      this.dialogVisible = false;
      this.$emit("update:visible", false);
      this.$emit("close");
    },
    handleOpen() {
      this.$emit("open");
    },
    handleCancel() {
      this.dialogVisible = false;
      this.$emit("update:visible", false);
      this.$emit("cancel");
    },
    handleConfirm() {
      this.$emit("confirm");
    }
  }
};
</script>

<style lang="scss" scoped>
// Size presets: .custom-dialog--large for tables, fluid when the width is a percentage
::v-deep .el-dialog.custom-dialog {
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 64px);
  margin: 32px auto !important;
}
::v-deep .el-dialog.custom-dialog--large {
  width: min(var(--dialog-table-max), calc(100vw - 32px)) !important;
}
::v-deep .el-dialog__body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}
::v-deep .dialog-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-right: 32px;
  font-size: var(--nx-text-headline);
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--nx-text);
  > span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
::v-deep .dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  .el-button + .el-button {
    margin-left: 0;
  }
}
</style>
