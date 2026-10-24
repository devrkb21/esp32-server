<template>
  <CustomDialog
    :title="title"
    :visible="visible"
    width="640px"
    class="param-dialog-wrapper"
    @update:visible="val => $emit('update:visible', val)"
    @confirm="submit"
    @close="cancel"
    :confirmLoading="saving"
  >
    <el-form :model="localForm" :rules="rules" ref="form" label-position="top" class="param-form">
      <el-form-item :label="$t('replacementDialog.fileName')" prop="fileName">
        <el-input v-model="localForm.fileName" :placeholder="$t('replacementDialog.fileNamePlaceholder')"
          @input="clearFieldError('fileName')"></el-input>
      </el-form-item>

      <el-form-item :label="$t('replacementDialog.content')" prop="content" class="content-item">
        <el-input
          type="textarea"
          class="content-input"
          v-model="localForm.content"
          :placeholder="$t('replacementDialog.contentPlaceholder')"
          :rows="9"
          @input="clearFieldError('content')"
        ></el-input>
        <div class="content-meta">
          <span class="format-tip">
            <i class="el-icon-info" aria-hidden="true"></i>
            {{ $t('replacementDialog.formatTip') }}
          </span>
          <span class="word-count nx-num" :class="{ 'over-limit': isOverLimit }">
            {{ wordCountText }} {{ $t('replacementDialog.wordCountUnit') }}
          </span>
        </div>
      </el-form-item>

      <div class="upload-row">
        <el-upload
          class="upload-btn"
          action=""
          :auto-upload="false"
          :show-file-list="false"
          accept=".txt"
          :on-change="handleFileChange"
        >
          <el-button size="small" icon="el-icon-upload2">{{ $t('replacementDialog.uploadTxt') }}</el-button>
        </el-upload>
        <div class="upload-row__text">
          <span>{{ $t('replacementDialog.clickUploadTip') }}</span>
          <span class="upload-row__warn">{{ $t('replacementDialog.uploadCoverTip') }}</span>
        </div>
      </div>
    </el-form>
  </CustomDialog>
</template>

<script>
import CustomDialog from './CustomDialog.vue';

export default {
  components: {
    CustomDialog
  },
  props: {
    title: {
      type: String,
      default: 'Add Replacement Word'
    },
    visible: {
      type: Boolean,
      default: false
    },
    form: {
      type: Object,
      default: () => ({
        id: undefined,
        fileName: '',
        content: ''
      })
    }
  },
  data() {
    const MAX_WORD_COUNT = 4000;

    const validateContent = (rule, value, callback) => {
      if (!value || !value.trim()) {
        callback(new Error(this.$t('replacementDialog.requiredContent')));
        return;
      }

      const lines = this.getValidLines(value);
      const lineCount = lines.length;

      if (lineCount > MAX_WORD_COUNT) {
        callback(new Error(this.$t('replacementDialog.maxWordCountExceeded', { max: MAX_WORD_COUNT })));
        return;
      }

      for (let i = 0; i < lines.length; i++) {
        const pipeCount = (lines[i].match(/\|/g) || []).length;
        if (pipeCount !== 1) {
          callback(new Error(this.$t('replacementDialog.invalidPipeCount', { line: i + 1 })));
          return;
        }
        const parts = lines[i].split('|');
        if (!parts[0] || !parts[0].trim()) {
          callback(new Error(this.$t('replacementDialog.emptyOriginal', { line: i + 1 })));
          return;
        }
        if (!parts[1] || !parts[1].trim()) {
          callback(new Error(this.$t('replacementDialog.emptyReplacement', { line: i + 1 })));
          return;
        }
        const specialCharRegex = /[!@#$%^&*()_+=\[\]{};':"\\<>?\/`~]/;
        if (specialCharRegex.test(parts[0])) {
          callback(new Error(this.$t('replacementDialog.invalidOriginalChar', { line: i + 1 })));
          return;
        }
        if (specialCharRegex.test(parts[1])) {
          callback(new Error(this.$t('replacementDialog.invalidReplacementChar', { line: i + 1 })));
          return;
        }
      }
      callback();
    };

    return {
      dialogKey: Date.now(),
      saving: false,
      localForm: {
        id: undefined,
        fileName: '',
        content: ''
      },
      maxWordCount: MAX_WORD_COUNT,
      rules: {
        fileName: [
          { required: true, message: this.$t('replacementDialog.requiredFileName'), trigger: "blur" }
        ],
        content: [
          { required: true, validator: validateContent, trigger: "blur" }
        ]
      }
    };
  },
  computed: {
    wordCount() {
      if (!this.localForm.content) return 0;
      const contentStr = Array.isArray(this.localForm.content)
        ? this.localForm.content.join('\n')
        : this.localForm.content;
      if (!contentStr.trim()) {
        return 0;
      }
      const lines = this.getValidLines();
      return lines.filter(line => line.includes('|')).length;
    },

    isOverLimit() {
      return this.wordCount > this.maxWordCount;
    },

    wordCountText() {
      return `${this.wordCount} / ${this.maxWordCount}`;
    }
  },
  methods: {
    getValidLines() {
      if (!this.localForm.content) return [];
      const contentStr = Array.isArray(this.localForm.content) 
        ? this.localForm.content.join('\n') 
        : this.localForm.content;
      return contentStr.split(/\r?\n/).filter(line => line.trim());
    },

    clearFieldError(field) {
      if (this.$refs.form) {
        this.$refs.form.clearValidate(field);
      }
    },

    handleFileChange(file) {
      if (!file) return;

      const rawFile = file.raw;
      if (!rawFile) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target.result;
        this.localForm.content = content;

        const lines = this.getValidLines(content);
        if (lines.length > this.maxWordCount) {
          this.$message.warning(
            this.$t('replacementDialog.maxWordCountExceeded', { max: this.maxWordCount })
          );
        }

        this.$nextTick(() => {
          if (this.$refs.form) {
            this.$refs.form.clearValidate('content');
          }
        });
      };
      reader.onerror = () => {
        this.$message.error(this.$t('replacementDialog.readFileError'));
      };
      reader.readAsText(rawFile);
    },

    submit() {
      this.$refs.form.validate((valid) => {
        if (valid) {
          if (this.isOverLimit) {
            this.$message.error(
              this.$t('replacementDialog.maxWordCountExceeded', { max: this.maxWordCount })
            );
            return;
          }

          const submitData = {
            id: this.localForm.id,
            fileName: this.localForm.fileName,
            content: this.getValidLines()
          };
          this.saving = true;
          this.$emit('submit', submitData);
        }
      });
    },

    cancel() {
      this.saving = false;
      this.dialogKey = Date.now();
      this.$emit('cancel');
    },

    resetSaving() {
      this.saving = false;
    }
  },
  watch: {
    visible(newVal) {
      if (newVal) {
        this.localForm.id = this.form.id;
        this.localForm.fileName = this.form.fileName || '';
        const contentData = this.form.content;
        this.localForm.content = Array.isArray(contentData) ? contentData.join('\n') : (contentData || '');
        this.$nextTick(() => {
          if (this.$refs.form) {
            this.$refs.form.clearValidate();
          }
        });
      } else {
        this.saving = false;
      }
    }
  }
};
</script>

<style scoped lang="scss">
.param-form {
  .content-input ::v-deep .el-textarea__inner {
    font-family: var(--nx-font-mono);
    font-size: var(--nx-text-footnote);
    line-height: 1.6;
  }
}
.content-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--nx-space-2);
  margin-top: var(--nx-space-2);
  line-height: 1.4;
}
.format-tip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--nx-text-caption);
  color: var(--nx-text-3);
}
.word-count {
  font-size: var(--nx-text-caption);
  font-weight: 600;
  color: var(--nx-text-2);
  transition: color var(--nx-dur-2) var(--nx-ease);
  &.over-limit {
    color: var(--nx-danger);
  }
}
.upload-row {
  display: flex;
  align-items: center;
  gap: var(--nx-space-3);
  padding: var(--nx-space-3);
  border-radius: var(--nx-radius);
  background: var(--nx-surface-2);
  &__text {
    display: flex;
    flex-direction: column;
    min-width: 0;
    font-size: var(--nx-text-footnote);
    color: var(--nx-text-2);
  }
  &__warn {
    font-size: var(--nx-text-caption);
    color: var(--nx-text-3);
  }
  .upload-btn ::v-deep .el-button {
    background: var(--nx-surface);
  }
}
</style>
