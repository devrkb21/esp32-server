<template>
  <CustomDialog :title="title" :visible.sync="dialogVisible" width="640px" class="knowledge-base-dialog"
    :cancel-text="$t('knowledgeBaseDialog.cancel')" :confirm-text="$t('knowledgeBaseDialog.save')"
    @close="handleClose" @confirm="handleSubmit">
    <el-form ref="knowledgeBaseForm" :model="form" :rules="rules" label-position="top" class="kbd-form"
      @submit.native.prevent>
      <el-form-item :label="$t('knowledgeBaseDialog.name')" prop="name">
        <el-input v-model="form.name" :placeholder="$t('knowledgeBaseDialog.namePlaceholder')" maxlength="50"
          clearable></el-input>
      </el-form-item>
      <el-form-item :label="$t('knowledgeBaseDialog.description')" prop="description">
        <el-input v-model="form.description" :placeholder="$t('knowledgeBaseDialog.descriptionPlaceholder')"
          type="textarea" :autosize="{ minRows: 3, maxRows: 8 }" maxlength="300" show-word-limit></el-input>
      </el-form-item>
      <el-form-item :label="$t('knowledgeBaseDialog.ragModel')" prop="ragModelId">
        <el-select v-model="form.ragModelId" :placeholder="$t('knowledgeBaseDialog.ragModelPlaceholder')" clearable
          filterable class="kbd-select" @focus="loadRAGModels">
          <el-option v-for="model in ragModels" :key="model.id" :label="model.modelName" :value="model.id">
          </el-option>
        </el-select>
      </el-form-item>
    </el-form>
  </CustomDialog>
</template>

<script>
import Api from "@/apis/api";
import CustomDialog from "./CustomDialog.vue";

export default {
  name: "KnowledgeBaseDialog",
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
        datasetId: null,
        ragModelId: null,
        name: "",
        description: ""
      })
    }
  },
  data() {
    return {
      dialogVisible: this.visible,
      ragModels: [],
      rules: {
        name: [
          {
            required: true,
            message: this.$t("knowledgeBaseDialog.nameRequired"),
            trigger: "blur"
          },
          {
            min: 1,
            max: 50,
            message: this.$t("knowledgeBaseDialog.nameLength"),
            trigger: "blur"
          },
          {
            pattern: /^[\u4e00-\u9fa5a-zA-Z0-9\s-_]+$/,
            message: this.$t("knowledgeBaseDialog.namePattern"),
            trigger: "blur"
          }
        ],
        description: [
          {
            required: true,
            message: this.$t("knowledgeBaseDialog.descriptionRequired"),
            trigger: "blur"
          },
          {
            max: 300,
            message: this.$t("knowledgeBaseDialog.descriptionLength"),
            trigger: "blur"
          }
        ],
        ragModelId: [
          {
            required: true,
            message: this.$t("knowledgeBaseDialog.ragModelRequired"),
            trigger: "change"
          }
        ]
      }
    };
  },
  components: {
    CustomDialog
  },
  watch: {
    visible(val) {
      this.dialogVisible = val;
      if (val) {
        // Load RAG models list when dialog opens
        this.loadRAGModels();

        // Default to first RAG model when creating knowledge base without ragModelId
        if (!this.form.id && !this.form.ragModelId && this.ragModels.length > 0) {
          this.$set(this.form, 'ragModelId', this.ragModels[0].id);
        }

        if (this.$refs.knowledgeBaseForm) {
          this.$refs.knowledgeBaseForm.clearValidate();
        }
      }
    },
    // Watch RAG model list changes to set default value
    ragModels(newModels) {
      if (newModels.length > 0) {
        // Default to first RAG model when creating knowledge base without ragModelId
        if (!this.form.id && !this.form.ragModelId) {
          this.$set(this.form, 'ragModelId', newModels[0].id);
        }
      }
    }
  },
  methods: {
    handleClose() {
      // Preserve previous choices when editing without resetting form fields
      // Reset validation state only when dialog closes
      if (this.$refs.knowledgeBaseForm) {
        this.$refs.knowledgeBaseForm.clearValidate();
      }
      this.dialogVisible = false;
      this.$emit("update:visible", false);
    },
    handleSubmit() {
      this.$refs.knowledgeBaseForm.validate(valid => {
        if (valid) {
          this.$emit("submit", {
            ...this.form
          });
        }
      });
    },
    loadRAGModels() {
      if (this.ragModels.length > 0) {
        return; // Already loaded, avoid duplicate loading
      }

      Api.model.getRAGModels((res) => {
        if (res.data && res.data.code === 0) {
          this.ragModels = res.data.data || [];

          // Default to first RAG model when creating knowledge base without ragModelId
          if (!this.form.id && !this.form.ragModelId && this.ragModels.length > 0) {
            this.$set(this.form, 'ragModelId', this.ragModels[0].id);
          }
        } else {
          console.error('Failed to get RAG model list:', res.data?.msg);
          this.$message.error(this.$t('knowledgeBaseDialog.loadRAGModelsFailed'));
        }
      });
    }
  }
};
</script>

<style lang="scss" scoped>
.kbd-form {
  ::v-deep .el-form-item {
    margin-bottom: var(--nx-space-4);
  }
  ::v-deep .el-form-item:last-child {
    margin-bottom: 0;
  }
  ::v-deep .el-form-item__label {
    padding-bottom: var(--nx-space-1);
    line-height: 1.4;
  }
}

.kbd-select {
  width: 100%;
}
</style>
