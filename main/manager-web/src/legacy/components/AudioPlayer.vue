<template>
  <div class="ap" :class="{ 'is-playing': isPlaying }">
    <audio
      ref="audioRef"
      :src="audioUrl"
      preload="metadata"
      @timeupdate="updateProgress"
      @loadedmetadata="updateDuration"
      @ended="handleEnded"
      @pause="isPlaying = false"
      @play="isPlaying = true"
    ></audio>

    <!-- Round play / pause button -->
    <button
      type="button"
      class="ap-play"
      :aria-label="isPlaying ? tx('modelConfig.pause', 'Pause') : tx('modelConfig.play', 'Play')"
      @click="togglePlay"
    >
      <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden="true">
        <path fill="currentColor" :d="isPlaying ? 'M5 3h3.5v14H5zm6.5 0H15v14h-3.5z' : 'M6 3.2v13.6c0 .6.7 1 1.2.7l10.2-6.8c.5-.3.5-1 0-1.4L7.2 2.5C6.7 2.2 6 2.6 6 3.2z'" />
      </svg>
    </button>

    <!-- Slim progress: a native range for drag + keyboard, drawn as a thin track -->
    <div class="ap-progress">
      <div class="ap-progress__track" aria-hidden="true">
        <div class="ap-progress__fill" :style="{ transform: 'scaleX(' + progress / 100 + ')' }"></div>
      </div>
      <input
        class="ap-progress__input"
        type="range"
        min="0"
        max="100"
        step="0.1"
        :value="progress"
        :aria-label="tx('modelConfig.seek', 'Playback position')"
        :aria-valuetext="formattedCurrentTime + ' / ' + formattedDuration"
        @input="seekToPercentage(Number($event.target.value))"
      />
    </div>

    <span class="ap-time nx-num">{{ formattedCurrentTime }} / {{ formattedDuration }}</span>

    <!-- Volume: click to mute, hover for the level -->
    <el-popover placement="top" trigger="hover" width="44" popper-class="ap-volume-pop" :open-delay="150">
      <div class="ap-volume">
        <el-slider
          v-model="volumePercent"
          vertical
          height="88px"
          :show-tooltip="false"
          :aria-label="tx('modelConfig.volume', 'Volume')"
          @input="handleVolumeChange"
        />
      </div>
      <button
        slot="reference"
        type="button"
        class="ap-mute"
        :aria-label="isMuted ? tx('modelConfig.unmute', 'Unmute') : tx('modelConfig.mute', 'Mute')"
        :aria-pressed="isMuted ? 'true' : 'false'"
        @click="toggleMute"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="currentColor" :d="volumeIconPath" />
        </svg>
      </button>
    </el-popover>
  </div>
</template>

<script>
const ICON_MUTED =
  'M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z';
const ICON_VOLUME =
  'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z';

// Format time as M:SS
const formatTime = (seconds) => {
  const sec = Math.floor(seconds || 0);
  return `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`;
};

export default {
  name: 'AudioPlayer',
  props: {
    audioUrl: String,
  },
  data() {
    return {
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      progress: 0,
      volume: 0.7,
      isMuted: false,
    };
  },
  computed: {
    formattedCurrentTime() {
      return formatTime(this.currentTime);
    },
    formattedDuration() {
      return formatTime(this.duration);
    },
    volumeIconPath() {
      return this.isMuted || this.volume === 0 ? ICON_MUTED : ICON_VOLUME;
    },
    volumePercent: {
      get() {
        return Math.round((this.isMuted ? 0 : this.volume) * 100);
      },
      set(val) {
        this.volume = val / 100;
      },
    },
  },
  watch: {
    audioUrl() {
      this.isPlaying = false;
      this.currentTime = 0;
      this.progress = 0;
      this.duration = 0;
    },
  },
  mounted() {
    if (this.$refs.audioRef) {
      this.$refs.audioRef.volume = this.volume;
    }
  },
  beforeDestroy() {
    if (this.$refs.audioRef) {
      this.$refs.audioRef.pause();
    }
  },
  methods: {
    tx(key, fallback) {
      const value = this.$t(key);
      return value !== key ? value : fallback;
    },
    // Playback control
    togglePlay() {
      const audio = this.$refs.audioRef;
      if (!audio) return;
      if (this.isPlaying) {
        audio.pause();
        this.isPlaying = false;
      } else {
        const playing = audio.play();
        this.isPlaying = true;
        if (playing && playing.catch) {
          playing.catch(() => {
            this.isPlaying = false;
          });
        }
      }
    },
    updateDuration() {
      const audio = this.$refs.audioRef;
      if (audio && isFinite(audio.duration)) {
        this.duration = audio.duration;
      }
    },
    updateProgress() {
      const audio = this.$refs.audioRef;
      if (audio && audio.duration) {
        this.currentTime = audio.currentTime;
        this.progress = (this.currentTime / audio.duration) * 100;
      }
    },
    handleEnded() {
      this.isPlaying = false;
      this.progress = 0;
      this.currentTime = 0;
    },
    seekToPercentage(percentage) {
      const audio = this.$refs.audioRef;
      const clamped = Math.min(Math.max(percentage, 0), 100);
      this.progress = clamped;
      if (audio && this.duration) {
        audio.currentTime = (clamped / 100) * this.duration;
      }
    },
    // Volume control
    toggleMute() {
      const audio = this.$refs.audioRef;
      this.isMuted = !this.isMuted;
      if (audio) audio.muted = this.isMuted;

      // Restore default volume if unmuting and volume is 0
      if (!this.isMuted && this.volume === 0) {
        this.volume = 0.5;
        if (audio) audio.volume = 0.5;
      }
    },
    handleVolumeChange(val) {
      const audio = this.$refs.audioRef;
      const newVolume = Number(val) / 100;
      this.volume = newVolume;
      this.isMuted = newVolume === 0;
      if (audio) {
        audio.volume = newVolume;
        audio.muted = this.isMuted;
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.ap {
  display: flex;
  align-items: center;
  gap: var(--nx-space-2);
  width: 100%;
  min-width: 200px;
  max-width: 360px;
  height: var(--nx-control-h-lg);
  padding: 0 var(--nx-space-1) 0 var(--nx-space-1);
  border-radius: var(--nx-radius-pill);
  background: var(--nx-surface-2);

  audio {
    display: none;
  }
}

.ap-play {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 50%;
  background: var(--nx-accent);
  color: var(--nx-on-accent);
  cursor: pointer;
  box-shadow: var(--nx-shadow-1);
  transition: background-color var(--nx-dur-1) var(--nx-ease), transform var(--nx-dur-1) var(--nx-ease);

  &:hover {
    background: var(--nx-accent-hover);
  }
  &:active {
    transform: scale(0.94);
  }
}

.ap-progress {
  position: relative;
  flex: 1 1 auto;
  min-width: 48px;
  height: 20px;
  display: flex;
  align-items: center;

  &__track {
    position: absolute;
    left: 0;
    right: 0;
    height: 4px;
    border-radius: var(--nx-radius-pill);
    background: var(--nx-surface-3);
    overflow: hidden;
  }
  &__fill {
    width: 100%;
    height: 100%;
    border-radius: inherit;
    background: var(--nx-accent);
    transform-origin: left center;
  }

  // Invisible native range on top: drag, click and arrow keys
  &__input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    background: transparent;
    cursor: pointer;
    -webkit-appearance: none;
    appearance: none;

    &::-webkit-slider-runnable-track {
      height: 20px;
      background: transparent;
    }
    &::-moz-range-track {
      height: 20px;
      background: transparent;
    }
    &::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 12px;
      height: 12px;
      margin-top: 4px;
      border: 2px solid var(--nx-surface);
      border-radius: 50%;
      background: var(--nx-accent);
      box-shadow: var(--nx-shadow-1);
      opacity: 0;
      transition: opacity var(--nx-dur-1) var(--nx-ease);
    }
    &::-moz-range-thumb {
      width: 10px;
      height: 10px;
      border: 2px solid var(--nx-surface);
      border-radius: 50%;
      background: var(--nx-accent);
      opacity: 0;
      transition: opacity var(--nx-dur-1) var(--nx-ease);
    }
    &:focus-visible {
      outline: 2px solid var(--nx-accent);
      outline-offset: 2px;
      border-radius: var(--nx-radius-sm);
    }
  }

  &:hover &__input::-webkit-slider-thumb,
  &__input:focus-visible::-webkit-slider-thumb {
    opacity: 1;
  }
  &:hover &__input::-moz-range-thumb,
  &__input:focus-visible::-moz-range-thumb {
    opacity: 1;
  }
}

.ap-time {
  flex: none;
  font-size: var(--nx-text-caption);
  color: var(--nx-text-2);
  white-space: nowrap;
}

.ap-mute {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--nx-text-2);
  cursor: pointer;
  transition: background-color var(--nx-dur-1) var(--nx-ease), color var(--nx-dur-1) var(--nx-ease);

  &:hover {
    background: var(--nx-surface-3);
    color: var(--nx-text);
  }
}

.ap-volume {
  display: flex;
  justify-content: center;
  padding: var(--nx-space-1) 0;
}

@media (max-width: 480px) {
  .ap-time {
    display: none;
  }
}
</style>

<style lang="scss">
// Popover is appended to body, so it cannot use scoped styles
.el-popover.ap-volume-pop {
  min-width: 0;
  padding: var(--nx-space-2) var(--nx-space-1);
}
</style>
