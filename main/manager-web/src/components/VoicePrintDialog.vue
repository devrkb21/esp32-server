<template>
  <CustomDialog
    :title="title"
    :visible.sync="innerVisible"
    :confirm-loading="saving"
    width="560px"
    :confirmText="$t('voicePrintDialog.save')"
    :cancelText="$t('voicePrintDialog.cancel')"
    @confirm="submit"
    @cancel="cancel"
  >
    <el-form :model="form" :rules="rules" ref="form" label-position="top" class="vp-form">
      <el-form-item :label="$t('voicePrintDialog.voicePrintVector')" prop="audioId">
        <el-select v-model="form.audioId" :placeholder="$t('voicePrintDialog.selectVoiceMessage')" class="vp-form__select"
          popper-class="vp-audio-menu" filterable>
          <el-option v-for="item in valueTypeOptions" :key="item.audioId" :label="item.content" :value="item.audioId">
            <span class="vp-audio">
              <span class="vp-audio__text">{{ item.content }}</span>
              <button v-if="item.audioId" type="button" class="vp-audio__play"
                :class="{ 'is-playing': playingAudioId === item.audioId }"
                :aria-label="playingAudioId === item.audioId ? tx('voicePrintDialog.stop', 'Stop') : tx('voicePrintDialog.play', 'Play')"
                @click.stop="playAudio(item.audioId)">
                <i :class="getAudioIconClass(item.audioId)" aria-hidden="true"></i>
              </button>
            </span>
          </el-option>
        </el-select>
        <div class="vp-form__help">
          {{ tx('voicePrintDialog.vectorHelp', 'Pick a recent sentence this person said to TinyBot. Use ▶ to listen first.') }}
        </div>
      </el-form-item>

      <el-form-item :label="$t('voicePrintDialog.name')" prop="sourceName">
        <el-input v-model="form.sourceName" :placeholder="$t('voicePrintDialog.enterName')"></el-input>
      </el-form-item>

      <el-form-item :label="$t('voicePrintDialog.description')" prop="introduce" class="vp-form__last">
        <el-input type="textarea" v-model="form.introduce" :placeholder="$t('voicePrintDialog.enterDescription')"
          :autosize="{ minRows: 3, maxRows: 6 }" maxlength="100" show-word-limit></el-input>
      </el-form-item>
    </el-form>
  </CustomDialog>
</template>

<script>
import api from '@/apis/api';
import CustomDialog from './CustomDialog.vue';

export default {
  components: { CustomDialog },
  props: {
    title: {
      type: String,
      default: 'Add Speaker'
    },
    visible: {
      type: Boolean,
      default: false
    },
    agentId: {
      type: String
    },
    form: {
      type: Object,
      default: () => ({
        id: null,
        audioId: '',
        sourceName: '',
        introduce: ''
      })
    }
  },
  data() {
    return {
      saving: false,
      playingAudioId: null,
      audioElement: null,
      valueTypeOptions: [
        { audioId: '', content: '' }
      ],
      rules: {
        introduce: [
          { required: true, message: this.$t('voicePrintDialog.requiredDescription'), trigger: "blur" }
        ],
        sourceName: [
          { required: true, message: this.$t('voicePrintDialog.requiredName'), trigger: "blur" }
        ],
        audioId: [
          { required: true, message: this.$t('voicePrintDialog.requiredAudioVector'), trigger: "change" }
        ]
      }
    };
  },
  computed: {
    innerVisible: {
      get() {
        return this.visible;
      },
      set(val) {
        this.$emit('update:visible', val);
      }
    }
  },
  methods: {
    // Pending i18n keys fall back to their English text until the lead merges them
    tx(key, fallback) {
      return this.$te(key) || this.$te(key, 'en') ? this.$t(key) : fallback;
    },
    getAudioIconClass(audioId) {
      if (this.playingAudioId === audioId) {
        return 'el-icon-video-pause';
      }
      return 'el-icon-video-play';
    },
    playAudio(audioId) {
      if (this.playingAudioId === audioId) {
        // If current audio is playing, stop playing
        if (this.audioElement) {
          this.audioElement.pause();
          this.audioElement = null;
        }
        this.playingAudioId = null;
        return;
      }

      // Stop currently playing audio
      if (this.audioElement) {
        this.audioElement.pause();
        this.audioElement = null;
      }

      // First get audio download ID
      this.playingAudioId = audioId;
      api.agent.getAudioId(audioId, (res) => {
        if (res.data && res.data.data) {
          // Play audio using retrieved download ID
          this.audioElement = new Audio(api.getServiceUrl() + `/agent/play/${res.data.data}`);

          this.audioElement.onended = () => {
            this.playingAudioId = null;
            this.audioElement = null;
          };

          this.audioElement.play();
        }
      });
    },
    submit() {
      this.$refs.form.validate((valid) => {
        if (valid) {
          this.saving = true;
          this.$emit('submit', {
            form: this.form,
            done: () => {
              this.saving = false;
            }
          });

          setTimeout(() => {
            this.saving = false;
          }, 3000);
        }
      });
    },
    cancel() {
      this.saving = false;
      this.$emit('cancel');
    }
  },
  watch: {
    visible(newVal) {
      if (newVal) {
        this.saving = false;
        api.agent.getRecentlyFiftyByAgentId(this.agentId, ((data) => {
          this.valueTypeOptions = data.data.data.map(item => ({
            ...item
          }));
        }))
      }
    },
    'form.audioId'(newVal) {
      if (newVal == null || newVal == "") {
        return
      }
      if (this.valueTypeOptions.some(item => item.audioId === newVal)) {
        return;
      }
      api.agent.getContentByAudioId(newVal, ((data) => {
        this.valueTypeOptions.push({
          audioId: newVal, content: data.data.data
        })
      }))
    }
  }
};
</script>

<style scoped lang="scss">
.vp-form {
  &__select {
    width: 100%;
  }
  &__help {
    margin-top: var(--nx-space-1);
    font-size: var(--nx-text-caption);
    line-height: 1.4;
    color: var(--nx-text-3);
  }
  &__last {
    margin-bottom: 0;
  }
}
</style>

<style lang="scss">
// Option rows live in the select popper (appended to <body>)
.vp-audio-menu .vp-audio {
  display: flex;
  align-items: center;
  gap: var(--nx-space-3);
  min-width: 0;

  &__text {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  &__play {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 28px;
    height: 28px;
    border: 0;
    border-radius: 50%;
    background: var(--nx-surface-2);
    color: var(--nx-accent);
    font-size: var(--nx-text-callout);
    cursor: pointer;
    transition: background-color var(--nx-dur-1) var(--nx-ease), transform var(--nx-dur-1) var(--nx-ease);

    &:hover {
      background: var(--nx-accent-soft);
    }
    &:active {
      transform: scale(0.92);
    }
    &.is-playing {
      background: var(--nx-accent);
      color: var(--nx-on-accent);
    }
  }
}
</style>
