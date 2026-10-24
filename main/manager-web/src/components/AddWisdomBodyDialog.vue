<template>
  <CustomDialog
    :title="$t('addAgentDialog.title')"
    :visible.sync="visible"
    width="480px"
    @confirm="confirm"
    @cancel="cancel"
    @close="handleClose"
    :confirmText="$t('addAgentDialog.confirm')"
    :cancelText="$t('addAgentDialog.cancel')"
    @open="handleOpen"
  >
    <form class="add-agent-form" novalidate @submit.prevent="confirm">
      <div class="add-agent-field">
        <label class="add-agent-field__label" for="add-agent-name">
          {{ $t('addAgentDialog.agentName') }}<span class="add-agent-field__required" aria-hidden="true">*</span>
        </label>
        <el-input
          id="add-agent-name"
          ref="inputRef"
          v-model="wisdomBodyName"
          maxlength="64"
          show-word-limit
          :placeholder="$t('addAgentDialog.placeholder')"
          autocomplete="off"
          aria-required="true"
        />
        <!-- Enter submits the form (single-field implicit submission) -->

      </div>
    </form>
  </CustomDialog>
</template>

<script>
import Api from '@/apis/api';
import CustomDialog from './CustomDialog.vue';

export default {
  name: 'AddWisdomBodyDialog',
  components: { CustomDialog },
  props: {
    visible: { type: Boolean, required: true }
  },
  data() {
    return {
      wisdomBodyName: ""
    }
  },
  methods: {
    handleOpen() {
      this.$nextTick(() => {
        if (this.$refs.inputRef && this.$refs.inputRef.focus) {
          this.$refs.inputRef.focus();
        }
      });
    },
    confirm() {
      if (!this.wisdomBodyName.trim()) {
        this.$message.error(this.$t('addAgentDialog.nameRequired'));
        return;
      }
      Api.agent.addAgent(this.wisdomBodyName, (res) => {
        this.$message.success({
          message: this.$t('addAgentDialog.addSuccess'),
          showClose: true
        });
        this.$emit('confirm', res);
        this.$emit('update:visible', false);
        this.wisdomBodyName = "";
      });
    },
    cancel() {
      this.wisdomBodyName = "";
      this.$emit('update:visible', false);
    },
    handleClose() {
      this.cancel();
    }
  }
}
</script>

<style lang="scss" scoped>
.add-agent-form {
  padding-top: var(--nx-space-1);
}

.add-agent-field {
  display: flex;
  flex-direction: column;
  gap: 6px;

  &__label {
    font-size: var(--nx-text-footnote);
    font-weight: 500;
    color: var(--nx-text-2);
  }
  &__required {
    margin-left: 2px;
    color: var(--nx-danger);
  }
}
</style>
