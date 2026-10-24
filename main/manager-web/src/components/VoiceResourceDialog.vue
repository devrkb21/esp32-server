<template>
  <CustomDialog
    :title="title"
    :visible.sync="dialogVisible"
    :close-on-click-modal="false"
    width="640px"
    :cancel-text="$t('button.cancel')"
    :confirm-text="title || $t('voiceClone.addVoiceClone')"
    @close="handleClose"
    @open="handleOpen"
    @cancel="handleCancel"
    @confirm="handleSubmit"
  >
    <el-form ref="form" :model="form" :rules="rules" label-position="top" class="vrd-form" @submit.native.prevent>
      <el-form-item :label="$t('voiceClone.platformName')" prop="modelId">
        <el-select v-model="form.modelId" :placeholder="$t('voiceClone.platformNamePlaceholder')" filterable
          class="vrd-full" @change="handlePlatformChange">
          <el-option v-for="model in platformList" :key="model.id" :label="model.modelName" :value="model.id">
          </el-option>
        </el-select>
      </el-form-item>

      <el-form-item :label="$t('voiceClone.voiceId')" prop="voiceIds">
        <el-select v-model="form.voiceIds" :placeholder="$t('voiceClone.voiceIdPlaceholder')" filterable multiple
          allow-create default-first-option class="vrd-full vrd-mono">
          <el-option v-for="voiceId in voiceIdList" :key="voiceId" :label="voiceId" :value="voiceId">
          </el-option>
        </el-select>
      </el-form-item>

      <div class="vrd-grid">
        <el-form-item :label="$t('voiceClone.userId')" prop="userId">
          <el-select v-model="form.userId" :placeholder="$t('voiceClone.userIdPlaceholder')" filterable remote
            :remote-method="remoteSearchUser" :loading="userLoading" class="vrd-full">
            <el-option v-for="user in userList" :key="user.userid" :label="user.mobile" :value="user.userid">
            </el-option>
          </el-select>
        </el-form-item>

        <el-form-item :label="$t('voiceClone.languages')" prop="languages">
          <el-input v-model="form.languages" :placeholder="$t('voiceClone.languagesPlaceholder')">
          </el-input>
        </el-form-item>
      </div>
    </el-form>
  </CustomDialog>
</template>

<script>
import Api from '@/apis/api';
import CustomDialog from './CustomDialog.vue';

export default {
  name: 'VoiceCloneDialog',
  components: { CustomDialog },
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
    }
  },

  data() {
    return {
      dialogVisible: this.visible,
      platformList: [],
      voiceIdList: [],
      userList: [],
      userLoading: false,
      rules: {
        modelId: [
          { required: true, message: this.$t('voiceClone.platformNameRequired'), trigger: 'change' }
        ],
        voiceIds: [
          { required: true, message: this.$t('voiceClone.voiceIdRequired'), trigger: 'change' }
        ],
        userId: [
          { required: true, message: this.$t('voiceClone.userIdRequired'), trigger: 'change' }
        ],
        languages: [
          { required: true, message: this.$t('voiceClone.languagesRequired'), trigger: 'blur' }
        ]
      }
    }
  },

  watch: {
    visible(val) {
      this.dialogVisible = val;
    },
    dialogVisible(val) {
      this.$emit('update:visible', val);
    }
  },

  methods: {
    handleClose() {
      this.dialogVisible = false;
      this.$emit('cancel');
    },

    handleCancel() {
      this.$refs.form.clearValidate();
      this.$emit('cancel');
    },

    handleSubmit() {
      this.$refs.form.validate(valid => {
        if (valid) {
          this.$emit('submit', this.form);
        }
      });
    },

    handleOpen() {
      // Load platform list when dialog opens
      this.fetchPlatformList();
      // Reset voice ID list
      this.voiceIdList = [];
    },

    handlePlatformChange(modelId) {
      // Clear voice ID selection
      this.form.voiceIds = [];
    },

    // Get TTS platform list
    fetchPlatformList() {
      Api.voiceResource.getTtsPlatformList((res) => {
        if (res.data.code === 0) {
          this.platformList = res.data.data;
        }
      });
    },

    // Remote search user
    remoteSearchUser(query) {
      if (query !== '') {
        this.userLoading = true;
        const params = {
          page: 1,
          limit: 20,
          mobile: query
        };
        Api.admin.getUserList(params, (res) => {
          this.userLoading = false;
          if (res.data.code === 0) {
            this.userList = res.data.data.list;
          }
        });
      } else {
        this.userList = [];
      }
    }
  }
}
</script>


<style lang="scss" scoped>
.vrd-form {
  ::v-deep .el-form-item {
    min-width: 0;
    margin-bottom: var(--nx-space-4);
  }
  ::v-deep .el-form-item__label {
    padding-bottom: var(--nx-space-1);
    line-height: 1.4;
  }
}

.vrd-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: var(--nx-space-4);

  ::v-deep .el-form-item {
    margin-bottom: 0;
  }
}

.vrd-full {
  width: 100%;
}

.vrd-mono ::v-deep .el-tag {
  font-family: var(--nx-font-mono);
}

@media (max-width: 560px) {
  .vrd-grid {
    grid-template-columns: minmax(0, 1fr);
    row-gap: var(--nx-space-4);
  }
}
</style>
