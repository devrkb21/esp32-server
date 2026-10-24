<template>
  <CustomDialog
    :title="title"
    :visible="visible"
    width="640px"
    @update:visible="val => $emit('update:visible', val)"
    @confirm="submit"
    @close="cancel"
    @open="handleOpen"
    :confirmLoading="saving"
  >
    <el-form ref="form" :model="form" :rules="rules" label-position="top" class="firmware-form">
      <!-- Step 1: the file -->
      <div class="fw-step">
        <span class="fw-step__num nx-num" aria-hidden="true">1</span>
        <span class="fw-step__title">{{ tt('firmwareDialog.stepFile', 'Upload the firmware file') }}</span>
      </div>
      <el-form-item prop="firmwarePath" class="fw-upload-item">
        <el-upload ref="upload" class="fw-upload" drag action="#" :http-request="handleUpload"
          :before-upload="beforeUpload" :accept="'.bin,.apk,.wav'" :limit="1" :multiple="false" :auto-upload="true"
          :on-remove="handleRemove">
          <span class="nx-icon-tile fw-upload__icon" aria-hidden="true"><i class="el-icon-upload2"></i></span>
          <div class="fw-upload__title">
            {{ tt('firmwareDialog.dropHere', 'Drop the file here, or') }}
            <em>{{ $t('firmwareDialog.clickUpload') }}</em>
          </div>
          <div class="fw-upload__tip">{{ $t('firmwareDialog.uploadTip') }}</div>
        </el-upload>
        <el-progress v-if="isUploading || uploadStatus === 'success'" class="fw-progress" :percentage="uploadProgress"
          :status="uploadStatus || undefined" :stroke-width="6"></el-progress>
        <p v-if="form.id && form.firmwarePath && !isUploading && uploadStatus !== 'success'" class="fw-note">
          <i class="el-icon-document" aria-hidden="true"></i>
          {{ tt('firmwareDialog.keepCurrentFile', 'The current file is kept unless you upload a new one.') }}
        </p>
        <div class="fw-hint" role="note">
          <i class="el-icon-info" aria-hidden="true"></i>
          <span>{{ $t('firmwareDialog.uploadHint') }}</span>
        </div>
      </el-form-item>

      <!-- Step 2: details -->
      <div class="fw-step">
        <span class="fw-step__num nx-num" aria-hidden="true">2</span>
        <span class="fw-step__title">{{ tt('firmwareDialog.stepDetails', 'Describe the build') }}</span>
      </div>
      <el-form-item :label="$t('firmwareDialog.firmwareName')" prop="firmwareName">
        <el-input v-model="form.firmwareName" :placeholder="$t('firmwareDialog.firmwareNamePlaceholder')" />
      </el-form-item>
      <div class="fw-grid">
        <el-form-item :label="$t('firmwareDialog.firmwareType')" prop="type">
          <el-select v-model="form.type" :placeholder="$t('firmwareDialog.firmwareTypePlaceholder')"
            class="fw-select" filterable :disabled="isTypeDisabled">
            <el-option v-for="item in firmwareTypes" :key="item.key" :label="item.name" :value="item.key"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item :label="$t('firmwareDialog.version')" prop="version">
          <el-input v-model="form.version" class="fw-version" :placeholder="$t('firmwareDialog.versionPlaceholder')" />
        </el-form-item>
      </div>
      <el-form-item :label="$t('firmwareDialog.remark')" prop="remark">
        <el-input type="textarea" v-model="form.remark" :rows="3"
          :placeholder="$t('firmwareDialog.remarkPlaceholder')" />
      </el-form-item>
    </el-form>
  </CustomDialog>
</template>

<script>
import Api from '@/apis/api';
import CustomDialog from './CustomDialog.vue';

export default {
  name: 'FirmwareDialog',
  components: {
    CustomDialog
  },
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    title: {
      type: String,
      default: ''
    },
    form: {
      type: Object,
      default: () => ({})
    },
    firmwareTypes: {
      type: Array,
      default: () => []
    }
  },

  data() {
    return {
      uploadProgress: 0,
      uploadStatus: '',
      isUploading: false,
      saving: false,
      rules: {
        firmwareName: [
          { required: true, message: this.$t('firmwareDialog.requiredFirmwareName'), trigger: 'blur' }
        ],
        type: [
          { required: true, message: this.$t('firmwareDialog.requiredFirmwareType'), trigger: 'change' }
        ],
        version: [
          { required: true, message: this.$t('firmwareDialog.requiredVersion'), trigger: 'blur' },
          { pattern: /^\d+\.\d+\.\d+$/, message: this.$t('firmwareDialog.versionFormatError'), trigger: 'blur' }
        ],
        firmwarePath: [
          { required: false, message: this.$t('firmwareDialog.requiredFirmwareFile'), trigger: 'change' }
        ]
      }
    }
  },
  computed: {
    isTypeDisabled() {
      // If id exists, editing mode, disable type selection
      return !!this.form.id
    }
  },
  methods: {
    tt(key, fallback) {
      return this.$te(key) || this.$te(key, 'en') ? this.$t(key) : fallback;
    },
    submit() {
      this.$refs.form.validate(valid => {
        if (valid) {
          // If adding mode and no file uploaded, show error
          if (!this.form.id && !this.form.firmwarePath) {
            this.$message.error(this.$t('firmwareDialog.requiredFirmwareFile'))
            return
          }
          this.saving = true
          // Hand over dialog close logic to parent after submit
          this.$emit('submit', this.form)
          // Fallback: release the loading state after 3 s if the parent never resets it
          setTimeout(() => {
            this.saving = false
          }, 3000)
        }
      })
    },
    cancel() {
      this.saving = false
      this.$emit('cancel')
    },
    // Reset saving state for parent component
    resetSaving() {
      this.saving = false
    },
    beforeUpload(file) {
      const isValidSize = file.size / 1024 / 1024 < 100
      const isValidType = ['.bin', '.apk'].some(ext => file.name.toLowerCase().endsWith(ext))

      if (!isValidType) {
        this.$message.error(this.$t('firmwareDialog.invalidFileType'))
        return false
      }
      if (!isValidSize) {
        this.$message.error(this.$t('firmwareDialog.invalidFileSize'))
        return false
      }
      return true
    },
    handleUpload(options) {
      const { file } = options
      this.uploadProgress = 0
      this.uploadStatus = ''
      this.isUploading = true

      // Simple 0-50% transition using setTimeout
      const timer = setTimeout(() => {
        if (this.uploadProgress < 50) {  // Only set when progress < 50%
          this.uploadProgress = 50
        }
      }, 1000)

      Api.ota.uploadFirmware(file, (res) => {
        clearTimeout(timer)  // Clear timer
        res = res.data
        if (res.code === 0) {
          this.form.firmwarePath = res.data
          this.form.size = file.size
          this.uploadProgress = 100
          this.uploadStatus = 'success'
          this.$message.success(this.$t('firmwareDialog.uploadSuccess'))
          // Hide progress bar after 2 seconds delay
          setTimeout(() => {
            this.isUploading = false
          }, 2000)
        } else {
          this.uploadStatus = 'exception'
          this.$message.error(res.msg || this.$t('firmwareDialog.uploadFailed'))
          this.isUploading = false
        }
      }, (progressEvent) => {
        if (progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          // Only update when progress > 50%
          if (progress > 50) {
            this.uploadProgress = progress
          }
          // If upload completed but no response yet, keep progress bar visible
          if (progress === 100) {
            this.uploadStatus = ''
          }
        }
      })
    },
    handleRemove() {
      this.form.firmwarePath = ''
      this.form.size = 0
      this.uploadProgress = 0
      this.uploadStatus = ''
      this.isUploading = false
    },
    handleOpen() {
      // Reset upload status
      this.uploadProgress = 0
      this.uploadStatus = ''
      this.isUploading = false
      this.saving = false
      // Reset file fields in form
      if (!this.form.id) {  // Only reset when adding
        this.form.firmwarePath = ''
        this.form.size = 0
      }
      // Reset upload component regardless of mode
      this.$nextTick(() => {
        if (this.$refs.upload) {
          this.$refs.upload.clearFiles()
        }
      })
    }
  }
}
</script>

<style scoped lang="scss">
.fw-step {
  display: flex;
  align-items: center;
  gap: var(--nx-space-2);
  margin: 0 0 var(--nx-space-3);
  &:not(:first-child) {
    margin-top: var(--nx-space-2);
    padding-top: var(--nx-space-5);
    border-top: 1px solid var(--nx-border);
  }
  &__num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--nx-accent-soft);
    color: var(--nx-accent);
    font-size: var(--nx-text-caption);
    font-weight: 700;
  }
  &__title {
    font-size: var(--nx-text-callout);
    font-weight: 600;
    color: var(--nx-text);
  }
}
.fw-upload-item ::v-deep .el-form-item__content {
  line-height: 1.4;
}
.fw-upload {
  width: 100%;
  ::v-deep .el-upload,
  ::v-deep .el-upload-dragger {
    width: 100%;
  }
  ::v-deep .el-upload-dragger {
    height: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--nx-space-2);
    padding: var(--nx-space-6) var(--nx-space-4);
    transition: border-color var(--nx-dur-2) var(--nx-ease), background-color var(--nx-dur-2) var(--nx-ease);
    &.is-dragover {
      border-color: var(--nx-accent);
      background: var(--nx-accent-soft);
    }
  }
  &__icon {
    margin-bottom: var(--nx-space-1);
  }
  &__title {
    font-size: var(--nx-text-callout);
    color: var(--nx-text);
    em {
      font-style: normal;
      font-weight: 600;
      color: var(--nx-accent);
    }
  }
  &__tip {
    font-size: var(--nx-text-caption);
    color: var(--nx-text-3);
  }
}
.fw-progress {
  margin-top: var(--nx-space-3);
}
.fw-note {
  display: flex;
  align-items: center;
  gap: var(--nx-space-2);
  margin: var(--nx-space-3) 0 0;
  font-size: var(--nx-text-footnote);
  color: var(--nx-text-2);
}
.fw-hint {
  display: flex;
  align-items: flex-start;
  gap: var(--nx-space-2);
  margin-top: var(--nx-space-3);
  padding: var(--nx-space-3);
  border-radius: var(--nx-radius);
  background: var(--nx-info-soft);
  color: var(--nx-info);
  font-size: var(--nx-text-footnote);
  line-height: 1.45;
  i {
    margin-top: 2px;
  }
}
.fw-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  column-gap: var(--nx-space-4);
}
.fw-select {
  width: 100%;
}
.fw-version ::v-deep .el-input__inner {
  font-family: var(--nx-font-mono);
}
</style>
