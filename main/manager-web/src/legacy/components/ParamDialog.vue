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
    :confirmText="$t('button.ok')"
    :cancelText="$t('button.cancel')"
  >
    <el-form :model="form" :rules="rules" ref="form" label-position="top" class="param-form">
      <div class="param-grid">
        <el-form-item :label="$t('paramDialog.paramCode')" prop="paramCode" class="param-grid__code">
          <el-input v-model="form.paramCode" class="mono-input" :placeholder="$t('paramDialog.paramCodePlaceholder')"></el-input>
        </el-form-item>

        <el-form-item :label="$t('paramDialog.valueType')" prop="valueType">
          <el-select v-model="form.valueType" :placeholder="$t('paramDialog.valueTypePlaceholder')" class="type-select">
            <el-option
              v-for="item in valueTypeOptions"
              :key="item.value"
              :label="$t(`paramDialog.${item.value}Type`)"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
      </div>

      <el-form-item :label="$t('paramDialog.paramValue')" prop="paramValue">
        <el-input
          v-if="form.valueType !== 'json' && form.valueType !== 'array'"
          v-model="form.paramValue"
          class="mono-input"
          :placeholder="$t('paramDialog.paramValuePlaceholder')"
        ></el-input>
        <el-input
          v-else
          type="textarea"
          v-model="form.paramValue"
          class="mono-input"
          :placeholder="$t('paramDialog.paramValuePlaceholder')"
          :rows="8"
        ></el-input>
      </el-form-item>

      <el-form-item :label="$t('paramDialog.remark')" prop="remark">
        <el-input type="textarea" v-model="form.remark" :placeholder="$t('paramDialog.remarkPlaceholder')" :rows="3"></el-input>
      </el-form-item>
    </el-form>
  </CustomDialog>
</template>

<script>
import CustomDialog from './CustomDialog.vue';
export default {
  props: {
    title: {
      type: String,
      default: 'Add Parameter'
    },
    visible: {
      type: Boolean,
      default: false
    },
    form: {
      type: Object,
      default: () => ({
        id: null,
        paramCode: '',
        paramValue: '',
        valueType: 'string',
        remark: ''
      })
    }
  },
  components: {
    CustomDialog
  },
  data() {
    return {
      dialogKey: Date.now(),
      saving: false,
      valueTypeOptions: [
        { value: 'string' },
        { value: 'number' },
        { value: 'boolean' },
        { value: 'array' },
        { value: 'json' }
      ],
      rules: {
        paramCode: [
          { required: true, message: this.$t('paramDialog.requiredParamCode'), trigger: "blur" }
        ],
        paramValue: [
          { required: true, message: this.$t('paramDialog.requiredParamValue'), trigger: "blur" }
        ],
        valueType: [
          { required: true, message: this.$t('paramDialog.requiredValueType'), trigger: "change" }
        ]
      }
    };
  },
  methods: {
    submit() {
      this.$refs.form.validate((valid) => {
        if (valid) {
          const submitData = { ...this.form };

          // If array type, validate format and convert
          if (submitData.valueType === 'array' && submitData.paramValue) {
            const lines = submitData.paramValue.split('\n').filter(line => line.trim());

            // Check if each line except the last ends with a semicolon
            for (let i = 0; i < lines.length - 1; i++) {
              if (!lines[i].trim().endsWith(';')) {
                this.$message.error('Array format error, each line must end with a semicolon');
                return;
              }
            }

            const items = lines
              .map(item => item.trim().replace(/;$/, ''))
              .filter(item => item);
            submitData.paramValue = items.join(';');
          }
          // If json type, minify JSON format before submitting
          else if (submitData.valueType === 'json' && submitData.paramValue) {
            try {
              const parsed = JSON.parse(submitData.paramValue);
              submitData.paramValue = JSON.stringify(parsed);
            } catch (e) {
              // If parsing fails, keep original value
            }
          }

          this.saving = true; // Start loading
          this.$emit('submit', submitData);
        }
      });
    },
    cancel() {
      this.saving = false; // Reset status on cancel
      this.dialogKey = Date.now();
      this.$emit('update:visible', false);
      this.$emit('cancel');
    },

    // Reset saving state for parent component
    resetSaving() {
      this.saving = false;
    }
  },
  watch: {
    visible(newVal) {
      if (newVal) {
        if (this.form.paramValue) {
          // If json type, format display
          if (this.form.valueType === 'json') {
            try {
              const parsed = JSON.parse(this.form.paramValue);
              this.form.paramValue = JSON.stringify(parsed, null, 2);
            } catch (e) {
              // If parsing fails, keep original value
            }
          }
          // If array type, convert semicolon-separated string to one item per line
          else if (this.form.valueType === 'array') {
            const items = this.form.paramValue.split(';').filter(item => item.trim());
            this.form.paramValue = items.join(';\n');
          }
        }
      } else {
        // Reset saving status when dialog closes
        this.saving = false;
      }
    }
  }
};
</script>

<style scoped lang="scss">
// Inputs take their look from styles/nobix/element.scss; only layout and the code font live here
.param-grid {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(160px, 1fr);
  column-gap: var(--nx-space-4);
  @media (max-width: 560px) {
    grid-template-columns: 1fr;
  }
}
.type-select {
  width: 100%;
}
.mono-input ::v-deep .el-input__inner,
.mono-input ::v-deep .el-textarea__inner {
  font-family: var(--nx-font-mono);
  font-size: var(--nx-text-footnote);
}
.mono-input ::v-deep .el-textarea__inner {
  line-height: 1.6;
}
</style>
