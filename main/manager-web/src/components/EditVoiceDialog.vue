<template>
  <el-dialog :visible.sync="dialogVisible" width="640px" :title="voiceForm.voiceName || $t('editVoiceDialog.voiceName')"
    @close="handleClose" class="compact-dialog" :append-to-body="true">
    <el-form :model="voiceForm" :rules="rules" ref="voiceForm" label-position="top">
      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item :label="$t('editVoiceDialog.voiceCode')" prop="voiceCode">
            <el-input v-model="voiceForm.voiceCode" :placeholder="$t('editVoiceDialog.voiceCodePlaceholder')" class="compact-input"></el-input>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item :label="$t('editVoiceDialog.voiceName')" prop="voiceName">
            <el-input v-model="voiceForm.voiceName" :placeholder="$t('editVoiceDialog.voiceNamePlaceholder')" class="compact-input"></el-input>
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item :label="$t('editVoiceDialog.languageType')" prop="languageType">
            <el-input v-model="voiceForm.languageType" :placeholder="$t('editVoiceDialog.languageTypePlaceholder')" class="compact-input"></el-input>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item :label="$t('editVoiceDialog.sortNumber')" prop="sortNumber">
            <el-input-number v-model="voiceForm.sortNumber" :min="1" :controls="false" class="compact-number"></el-input-number>
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item :label="$t('editVoiceDialog.remark')" prop="remark">
        <el-input v-model="voiceForm.remark" type="textarea" :autosize="{ minRows: 2, maxRows: 6 }" :placeholder="$t('editVoiceDialog.remarkPlaceholder')" class="compact-textarea"
        ></el-input>
        <div class="audio-controls">
           <div class="audio-player">
      <audio
        :src="audioUrl"
        controls
        preload="metadata"
        class="custom-audio"
      ></audio>
    </div>
          <el-button size="small" icon="el-icon-video-play" class="preview-btn">{{ $t('editVoiceDialog.generatePreview') }}</el-button>
        </div>
      </el-form-item>
    </el-form>

    <div slot="footer" class="dialog-footer">
      <el-button @click="handleClose">{{ $t('button.close') }}</el-button>
      <el-button type="primary" @click="handleSave">{{ $t('button.save') }}</el-button>
    </div>
  </el-dialog>
</template>

<script>
export default {
  name: 'EditVoiceDialog',
  props: {
    showDialog: Boolean,
    voiceData: {
      type: Object,
      default: () => ({
        voiceCode: 'wawaxiaohe',
        voiceName: this.$t('editVoiceDialog.defaultVoiceName'),
        languageType: this.$t('editVoiceDialog.defaultLanguageType'),
        sortNumber: 123
      })
    }
  },
  data() {
    return {
      dialogVisible: this.showDialog,
      voiceForm: { ...this.voiceData },
      audioUrl: 'http://music.163.com/song/media/outer/url?id=447925558.mp3',
      generatedAudio: null,
      rules: {
        voiceCode: [{ required: true, message: this.$t('editVoiceDialog.requiredVoiceCode'), trigger: 'blur' }],
        voiceName: [{ required: true, message: this.$t('editVoiceDialog.requiredVoiceName'), trigger: 'blur' }]
      }
    }
  },
  watch: {
    showDialog(newVal) {
      this.dialogVisible = newVal
      if (newVal) this.voiceForm = { ...this.voiceData }
    }
  },
  methods: {
    handleClose() {
      this.dialogVisible = false
      this.$emit('update:showDialog', false)
    },
    handleSave() {
      this.$refs.voiceForm.validate(valid => {
        if (valid) this.$emit('save', this.voiceForm)
      })
    },
  }
}
</script>

<style lang="scss" scoped>
// Look comes from the Nobix Element UI styles; only layout here.
.compact-input,
.compact-number,
.compact-textarea {
  width: 100%;
}

.audio-controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--nx-space-3);
  width: 100%;
  margin-top: var(--nx-space-3);
  padding: var(--nx-space-3);
  border-radius: var(--nx-radius);
  background: var(--nx-surface-2);
}

.audio-player {
  flex: 1 1 240px;
  min-width: 0;
}

.custom-audio {
  display: block;
  width: 100%;
  height: var(--nx-control-h);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--nx-space-2);

  .el-button + .el-button {
    margin-left: 0;
  }
}

@media (max-width: 600px) {
  ::v-deep .el-col-12 {
    width: 100%;
  }
}
</style>
