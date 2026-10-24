<template>
  <el-dialog :title="title" :visible="dialogVisible" width="520px" class="address-book-dialog" :append-to-body="true" @close="handleClose">
    <el-form ref="addressBookForm" :model="form" :rules="rules" label-position="top">
      <el-form-item :label="$t('addressBookDialog.name')" prop="name">
        <el-input v-model="form.name" :placeholder="$t('addressBookDialog.namePlaceholder')" clearable></el-input>
      </el-form-item>
      <el-form-item :label="$t('addressBookDialog.description')" prop="description">
        <el-input v-model="form.description" :placeholder="$t('addressBookDialog.descriptionPlaceholder')"
          type="textarea" :autosize="{ minRows: 3, maxRows: 8 }" maxlength="300" show-word-limit></el-input>
      </el-form-item>
      <el-form-item :label="$t('addressBookDialog.status')" prop="status">
        <el-switch
          v-model="form.status"
          :active-value="1"
          :inactive-value="0"
          :aria-label="$t('addressBookDialog.status')"
        />
      </el-form-item>
    </el-form>
    <div slot="footer" class="dialog-footer">
      <el-button @click="handleClose">{{ $t('addressBookDialog.cancel') }}</el-button>
      <el-button type="primary" @click="handleSubmit">{{ $t('addressBookDialog.confirm') }}</el-button>
    </div>
  </el-dialog>
</template>

<script>
export default {
  name: "AddressBookDialog",
  props: {
    title: {
      type: String,
      default: ""
    },
    visible: {
      type: Boolean,
      default: false
    },
    form: {
      type: Object,
      default: () => ({
        id: null,
        name: "",
        description: "",
        status: 1
      })
    }
  },
  data() {
    return {
      dialogVisible: this.visible,
      rules: {
        name: [
          {
            required: true,
            message: this.$t("addressBookDialog.nameRequired"),
            trigger: "blur"
          },
          {
            min: 1,
            max: 50,
            message: this.$t("addressBookDialog.nameLength"),
            trigger: "blur"
          },
          {
            pattern: /^[\u4e00-\u9fa5a-zA-Z0-9\s-_]+$/,
            message: this.$t("addressBookDialog.namePattern"),
            trigger: "blur"
          }
        ],
        description: [
          {
            required: true,
            message: this.$t("addressBookDialog.descriptionRequired"),
            trigger: "blur"
          },
          {
            max: 300,
            message: this.$t("addressBookDialog.descriptionLength"),
            trigger: "blur"
          }
        ]
      }
    };
  },
  watch: {
    visible(val) {
      this.dialogVisible = val;
      if (val) {
        if (this.$refs.addressBookForm) {
          this.$refs.addressBookForm.clearValidate();
        }
      }
    }
  },
  methods: {
    handleClose() {
      if (this.$refs.addressBookForm) {
        this.$refs.addressBookForm.clearValidate();
      }
      this.dialogVisible = false;
      this.$emit("update:visible", false);
    },
    handleSubmit() {
      this.$refs.addressBookForm.validate(valid => {
        if (valid) {
          this.$emit("submit", {
            ...this.form
          });
        }
      });
    }
  }
};
</script>

<style lang="scss" scoped>
// Look comes from the Nobix Element UI styles; only layout here.
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--nx-space-2);

  .el-button + .el-button {
    margin-left: 0;
  }
}
</style>
