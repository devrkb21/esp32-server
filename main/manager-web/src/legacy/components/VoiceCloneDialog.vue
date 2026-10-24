<template>
    <CustomDialog
        :title="$t('voiceClone.dialogTitle')"
        :visible.sync="innerVisible"
        width="720px"
        :footer="false"
        @close="handleDialogClose"
    >
        <template slot="title">
            <div class="dialog-title vcd-title">
                <span>{{ $t('voiceClone.dialogTitle') }}</span>
                <span v-if="voiceCloneData && voiceCloneData.name" class="vcd-title__name nx-truncate"
                    :title="voiceCloneData.name">{{ voiceCloneData.name }}</span>
            </div>
        </template>

        <div class="vcd">
            <!-- Steps -->
            <ol class="vcd-steps" :aria-label="$t('voiceClone.dialogTitle')">
                <li class="vcd-step" :class="{ 'is-active': currentStep === 1, 'is-done': currentStep > 1 }"
                    :aria-current="currentStep === 1 ? 'step' : null">
                    <span class="vcd-step__num">
                        <i v-if="currentStep > 1" class="el-icon-check" aria-hidden="true"></i>
                        <span v-else>1</span>
                    </span>
                    <span class="vcd-step__label">{{ $t('voiceClone.stepUpload') }}</span>
                </li>
                <li class="vcd-steps__line" :class="{ 'is-done': currentStep > 1 }" aria-hidden="true"></li>
                <li class="vcd-step" :class="{ 'is-active': currentStep === 2 }"
                    :aria-current="currentStep === 2 ? 'step' : null">
                    <span class="vcd-step__num">2</span>
                    <span class="vcd-step__label">{{ $t('voiceClone.stepEdit') }}</span>
                </li>
            </ol>

            <!-- Step 1: Audio upload -->
            <div v-if="currentStep === 1" class="vcd-body">
                <el-upload class="vcd-dropzone" drag :action="uploadAction" :auto-upload="false"
                    :on-change="handleFileChange" :show-file-list="false" accept="audio/*">
                    <span class="nx-icon-tile nx-icon-tile--lg"><i class="el-icon-microphone" aria-hidden="true"></i></span>
                    <div class="vcd-dropzone__title">{{ $t('voiceClone.dragOrClick') }}</div>
                    <div class="vcd-dropzone__tip">{{ $t('voiceClone.uploadTip') }}</div>
                </el-upload>
            </div>

            <!-- Step 2: Audio editing -->
            <div v-if="currentStep === 2" class="vcd-body">
                <div class="vcd-tips">
                    <i class="el-icon-info" aria-hidden="true"></i>
                    <div>
                        <p class="vcd-tips__lead">{{ $t('voiceClone.editTip1') }}</p>
                        <p>{{ $t('voiceClone.editTip2') }}</p>
                    </div>
                </div>

                <!-- Waveform: drag across it to select the part to keep -->
                <div class="vcd-wave">
                    <canvas ref="waveformCanvas" class="vcd-wave__canvas" @mousedown="handleWaveformMouseDown"
                        @mousemove="handleWaveformMouseMove" @mouseup="handleWaveformMouseUp"
                        @mouseleave="handleWaveformMouseUp"></canvas>
                    <div class="vcd-wave__selection" v-if="isSelecting || selectionStart !== null"
                        :style="selectionStyle"></div>
                    <div class="vcd-wave__duration nx-num"
                        :class="{ 'is-invalid': selectedDuration && (selectedDuration < 8 || selectedDuration > 60) }">
                        {{ $t('voiceClone.selectedDuration', { duration: selectedDuration.toFixed(1) }) }}
                    </div>
                </div>

                <!-- Audio control buttons -->
                <div class="vcd-controls">
                    <CustomButton size="small" :icon="isPlaying ? 'el-icon-video-pause' : 'el-icon-video-play'"
                        @click="togglePlay">
                        {{ isPlaying ? $t('voiceClone.pause') : $t('voiceClone.play') }}
                    </CustomButton>
                    <CustomButton size="small" icon="el-icon-scissors" :disabled="selectionStart === null"
                        @click="handleTrim">
                        {{ $t('voiceClone.trim') }}
                    </CustomButton>
                    <CustomButton size="small" icon="el-icon-refresh-left" @click="handleReset">
                        {{ $t('voiceClone.reset') }}
                    </CustomButton>
                </div>

                <!-- Audio elements -->
                <audio ref="audioPlayer" @timeupdate="handleTimeUpdate" @ended="handleAudioEnded"
                    style="display: none;"></audio>
            </div>
        </div>

        <div class="vcd-footer">
            <CustomButton @click="handleCancel">
                {{ currentStep === 1 ? $t('voiceClone.cancel') : $t('voiceClone.prevStep') }}
            </CustomButton>
            <CustomButton type="confirm" :loading="uploading" @click="handleNext">
                {{ currentStep === 1 ? $t('voiceClone.nextStep') : $t('voiceClone.upload') }}
            </CustomButton>
        </div>
    </CustomDialog>
</template>

<script>
import Api from "@/apis/api";
import CustomDialog from './CustomDialog.vue';
import CustomButton from './CustomButton.vue';

export default {
    name: 'VoiceCloneDialog',
    components: {
        CustomDialog,
        CustomButton
    },
    props: {
        visible: {
            type: Boolean,
            default: false
        },
        voiceCloneData: {
            type: Object,
            default: () => ({})
        }
    },
    data() {
        return {
            currentStep: 1,
            uploadAction: '',
            audioFile: null,
            originalAudioFile: null,
            audioBuffer: null,
            originalAudioBuffer: null,
            isPlaying: false,
            uploading: false,
            // Waveform related
            waveformData: [],
            // Selection related
            isSelecting: false,
            selectionStart: null,
            selectionEnd: null,
            mouseStartX: 0,
            // Audio context
            audioContext: null,
            audioSource: null,
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
        },
        selectedDuration() {
            if (this.selectionStart !== null && this.selectionEnd !== null && this.audioBuffer) {
                const duration = this.audioBuffer.duration;
                const start = Math.min(this.selectionStart, this.selectionEnd) * duration;
                const end = Math.max(this.selectionStart, this.selectionEnd) * duration;
                return end - start;
            }
            return this.audioBuffer ? this.audioBuffer.duration : 0;
        },
        selectionStyle() {
            if (this.selectionStart === null) return {};
            const canvas = this.$refs.waveformCanvas;
            if (!canvas) return {};

            const start = Math.min(this.selectionStart, this.selectionEnd || this.selectionStart);
            const end = Math.max(this.selectionStart, this.selectionEnd || this.selectionStart);

            return {
                left: `${start * 100}%`,
                width: `${(end - start) * 100}%`
            };
        }
    },
    methods: {
        // Resolve a CSS custom property (design token) for canvas drawing
        tokenColor(el, name) {
            const value = el ? getComputedStyle(el).getPropertyValue(name).trim() : '';
            return value || 'gray';
        },
        handleCancel() {
            if (this.currentStep === 2) {
                this.currentStep = 1;
            } else {
                this.$emit('update:visible', false);
            }
        },
        handleDialogClose() {
            this.resetDialog();
        },
        resetDialog() {
            this.currentStep = 1;
            this.audioFile = null;
            this.originalAudioFile = null;
            this.audioBuffer = null;
            this.originalAudioBuffer = null;
            this.isPlaying = false;
            this.uploading = false;
            this.waveformData = [];
            this.selectionStart = null;
            this.selectionEnd = null;
            if (this.audioSource) {
                this.audioSource.stop();
                this.audioSource = null;
            }
        },
        async handleFileChange(file) {
            if (!file || !file.raw) return;

            this.audioFile = file.raw;
            this.originalAudioFile = file.raw;

            // Enter step 2 first to ensure DOM is rendered
            this.currentStep = 2;

            // Wait for DOM update before loading audio
            await this.$nextTick();
            await this.loadAudio(file.raw);
        },
        async loadAudio(file) {
            try {
                const arrayBuffer = await file.arrayBuffer();
                if (!this.audioContext) {
                    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                }
                this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer.slice(0));
                this.originalAudioBuffer = await this.audioContext.decodeAudioData(await file.arrayBuffer());

                // Set up audio player
                if (this.$refs.audioPlayer) {
                    const audioUrl = URL.createObjectURL(file);
                    this.$refs.audioPlayer.src = audioUrl;
                    // Load audio metadata
                    this.$refs.audioPlayer.load();
                }

                // Generate waveform data
                await this.generateWaveform();
            } catch (error) {
                console.error('Failed to load audio:', error);
                this.$message.error(this.$t('voiceClone.loadAudioFailed'));
            }
        },
        async generateWaveform() {
            if (!this.audioBuffer) return;

            await this.$nextTick();
            const canvas = this.$refs.waveformCanvas;
            if (!canvas) {
                console.error('Canvas element does not exist');
                return;
            }

            // Set canvas size
            const containerWidth = canvas.parentElement.offsetWidth;
            const containerHeight = canvas.parentElement.offsetHeight;
            canvas.width = containerWidth || 800;
            canvas.height = containerHeight || 200;

            const canvasWidth = canvas.width;
            const channelData = this.audioBuffer.getChannelData(0);
            const step = Math.floor(channelData.length / canvasWidth);
            const waveformData = [];

            for (let i = 0; i < canvasWidth; i++) {
                let sum = 0;
                for (let j = 0; j < step; j++) {
                    sum += Math.abs(channelData[i * step + j] || 0);
                }
                waveformData.push(sum / step);
            }

            this.waveformData = waveformData;
            this.drawWaveform();
        },
        drawWaveform() {
            const canvas = this.$refs.waveformCanvas;
            if (!canvas) {
                console.error('Canvas does not exist when drawing waveform');
                return;
            }

            const ctx = canvas.getContext('2d');
            const width = canvas.width;
            const height = canvas.height;

            // Clear canvas
            ctx.clearRect(0, 0, width, height);

            // Background is the container's token fill (--nx-surface-2); the canvas stays transparent

            if (this.waveformData.length === 0) {
                console.error('Waveform data is empty');
                return;
            }

            // Find maximum value for normalization
            const maxValue = Math.max(...this.waveformData);

            // Draw waveform in the accent token
            const barColor = this.tokenColor(canvas, '--nx-accent');
            ctx.fillStyle = barColor;
            ctx.strokeStyle = barColor;
            ctx.lineWidth = 1;

            const barWidth = width / this.waveformData.length;

            this.waveformData.forEach((value, index) => {
                // Normalize and amplify, using 80% height
                const normalizedValue = maxValue > 0 ? value / maxValue : 0;
                const barHeight = Math.max(1, normalizedValue * height * 0.8);
                const x = index * barWidth;
                const y = (height - barHeight) / 2;

                ctx.fillRect(x, y, Math.max(1, barWidth - 1), barHeight);
            });
        },
        handleWaveformMouseDown(e) {
            const canvas = this.$refs.waveformCanvas;
            const rect = canvas.getBoundingClientRect();
            this.mouseStartX = e.clientX - rect.left;
            this.selectionStart = this.mouseStartX / rect.width;
            this.selectionEnd = this.selectionStart;
            this.isSelecting = true;
        },
        handleWaveformMouseMove(e) {
            if (!this.isSelecting) return;

            const canvas = this.$refs.waveformCanvas;
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            this.selectionEnd = Math.max(0, Math.min(1, x / rect.width));
        },
        handleWaveformMouseUp() {
            this.isSelecting = false;
        },
        async handleTrim() {
            if (this.selectionStart === null || this.selectionEnd === null || !this.audioBuffer) return;

            const start = Math.min(this.selectionStart, this.selectionEnd);
            const end = Math.max(this.selectionStart, this.selectionEnd);

            // Create new audio buffer
            const duration = this.audioBuffer.duration;
            const startTime = start * duration;
            const endTime = end * duration;
            const startOffset = Math.floor(startTime * this.audioBuffer.sampleRate);
            const endOffset = Math.floor(endTime * this.audioBuffer.sampleRate);
            const newLength = endOffset - startOffset;

            const newBuffer = this.audioContext.createBuffer(
                this.audioBuffer.numberOfChannels,
                newLength,
                this.audioBuffer.sampleRate
            );

            for (let channel = 0; channel < this.audioBuffer.numberOfChannels; channel++) {
                const oldData = this.audioBuffer.getChannelData(channel);
                const newData = newBuffer.getChannelData(channel);
                for (let i = 0; i < newLength; i++) {
                    newData[i] = oldData[startOffset + i];
                }
            }

            this.audioBuffer = newBuffer;

            // Update audio file
            await this.bufferToFile(newBuffer);

            // Reset selection
            this.selectionStart = null;
            this.selectionEnd = null;

            // Regenerate waveform
            this.generateWaveform();

            this.$message.success(this.$t('voiceClone.trimSuccess'));
        },
        async handleReset() {
            if (!this.originalAudioFile) return;

            this.audioFile = this.originalAudioFile;
            await this.loadAudio(this.originalAudioFile);
            this.selectionStart = null;
            this.selectionEnd = null;

            this.$message.success(this.$t('voiceClone.resetSuccess'));
        },
        togglePlay() {
            const audio = this.$refs.audioPlayer;
            if (this.isPlaying) {
                audio.pause();
                this.isPlaying = false;
            } else {
                audio.play();
                this.isPlaying = true;
            }
        },
        handleTimeUpdate() {
            // Update playback progress here
        },
        handleAudioEnded() {
            this.isPlaying = false;
        },
        async bufferToFile(buffer) {
            // Convert AudioBuffer to WAV file
            const wav = this.audioBufferToWav(buffer);
            const blob = new Blob([wav], { type: 'audio/wav' });
            this.audioFile = new File([blob], 'audio.wav', { type: 'audio/wav' });

            // Update player
            await this.$nextTick();
            if (this.$refs.audioPlayer) {
                const audioUrl = URL.createObjectURL(blob);
                this.$refs.audioPlayer.src = audioUrl;
            }
        },
        audioBufferToWav(buffer) {
            const length = buffer.length * buffer.numberOfChannels * 2 + 44;
            const arrayBuffer = new ArrayBuffer(length);
            const view = new DataView(arrayBuffer);
            const channels = [];
            let offset = 0;
            let pos = 0;

            // Write WAV file header
            const setUint16 = (data) => {
                view.setUint16(pos, data, true);
                pos += 2;
            };
            const setUint32 = (data) => {
                view.setUint32(pos, data, true);
                pos += 4;
            };

            // "RIFF" chunk descriptor
            setUint32(0x46464952); // "RIFF"
            setUint32(length - 8); // file length - 8
            setUint32(0x45564157); // "WAVE"

            // "fmt " sub-chunk
            setUint32(0x20746d66); // "fmt "
            setUint32(16); // SubChunk1Size = 16
            setUint16(1); // AudioFormat = 1 (PCM)
            setUint16(buffer.numberOfChannels);
            setUint32(buffer.sampleRate);
            setUint32(buffer.sampleRate * 2 * buffer.numberOfChannels); // byte rate
            setUint16(buffer.numberOfChannels * 2); // block align
            setUint16(16); // bits per sample

            // "data" sub-chunk
            setUint32(0x61746164); // "data"
            setUint32(length - pos - 4); // SubChunk2Size

            // Write audio data
            for (let i = 0; i < buffer.numberOfChannels; i++) {
                channels.push(buffer.getChannelData(i));
            }

            while (pos < length) {
                for (let i = 0; i < buffer.numberOfChannels; i++) {
                    let sample = Math.max(-1, Math.min(1, channels[i][offset]));
                    sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                    view.setInt16(pos, sample, true);
                    pos += 2;
                }
                offset++;
            }

            return arrayBuffer;
        },
        async handleNext() {
            if (this.currentStep === 1) {
                // Validate whether file is selected
                if (!this.audioFile) {
                    this.$message.warning(this.$t('voiceClone.pleaseSelectAudio'));
                    return;
                }
                this.currentStep = 2;
            } else {
                // Upload audio
                await this.uploadAudio();
            }
        },
        async uploadAudio() {
            if (!this.audioFile) {
                this.$message.warning(this.$t('voiceClone.pleaseSelectAudio'));
                return;
            }

            // Validate audio duration (8-60 seconds)
            if (this.audioBuffer) {
                const duration = this.audioBuffer.duration;
                if (duration < 8 || duration > 60) {
                    this.$message.warning(this.$t('voiceClone.durationError'));
                    return;
                }
            }

            this.uploading = true;

            try {
                const formData = new FormData();
                formData.append('voiceFile', this.audioFile);
                formData.append('id', this.voiceCloneData.id);

                await Api.voiceClone.uploadVoice(formData, (res) => {
                    this.uploading = false;
                    res = res.data;
                    if (res.code === 0) {
                        this.$message.success(this.$t('voiceClone.uploadSuccess'));
                        this.resetDialog();
                        this.$emit('update:visible', false);
                        this.$emit('success');
                    } else {
                        this.$message.error(res.msg || this.$t('voiceClone.uploadFailed'));
                    }
                });
            } catch (error) {
                this.uploading = false;
                console.error('Failed to upload audio:', error);
                this.$message.error(this.$t('voiceClone.uploadFailed'));
            }
        }
    },
    mounted() {
        // Set canvas size
        this.$nextTick(() => {
            const canvas = this.$refs.waveformCanvas;
            if (canvas) {
                canvas.width = canvas.offsetWidth;
                canvas.height = canvas.offsetHeight;
            }
        });
    },
    beforeDestroy() {
        if (this.audioContext) {
            this.audioContext.close();
        }
    }
};
</script>

<style lang="scss" scoped>
.vcd-title {
    display: flex;
    align-items: baseline;
    gap: var(--nx-space-2);
    min-width: 0;

    &__name {
        font-size: var(--nx-text-callout);
        font-weight: 400;
        color: var(--nx-text-2);
    }
}

.vcd {
    display: flex;
    flex-direction: column;
    gap: var(--nx-space-5);
}

// ------------------------------------------------------------ steps
.vcd-steps {
    display: flex;
    align-items: center;
    gap: var(--nx-space-3);
    margin: 0;
    padding: 0;
    list-style: none;

    &__line {
        flex: 1 1 auto;
        min-width: 24px;
        height: 2px;
        border-radius: var(--nx-radius-pill);
        background: var(--nx-surface-3);
        transition: background-color var(--nx-dur-3) var(--nx-ease);

        &.is-done {
            background: var(--nx-success);
        }
    }
}

.vcd-step {
    display: flex;
    align-items: center;
    gap: var(--nx-space-2);
    flex: none;
    color: var(--nx-text-3);
    font-size: var(--nx-text-callout);

    &__num {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: var(--nx-surface-2);
        color: var(--nx-text-2);
        font-size: var(--nx-text-footnote);
        font-weight: 700;
        transition: background-color var(--nx-dur-2) var(--nx-ease), color var(--nx-dur-2) var(--nx-ease);
    }

    &.is-active {
        color: var(--nx-text);
        font-weight: 600;

        .vcd-step__num {
            background: var(--nx-accent);
            color: var(--nx-on-accent);
        }
    }
    &.is-done {
        color: var(--nx-text-2);

        .vcd-step__num {
            background: var(--nx-success-soft);
            color: var(--nx-success);
        }
    }
}

// ------------------------------------------------------------ step 1
.vcd-dropzone {
    ::v-deep .el-upload {
        display: block;
        width: 100%;
    }
    ::v-deep .el-upload-dragger {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: var(--nx-space-3);
        width: 100%;
        height: auto;
        min-height: 240px;
        padding: var(--nx-space-7) var(--nx-space-5);
        transition: border-color var(--nx-dur-2) var(--nx-ease), background-color var(--nx-dur-2) var(--nx-ease);
    }
    ::v-deep .el-upload-dragger.is-dragover {
        border-color: var(--nx-accent);
        background: var(--nx-accent-soft);
    }

    &__title {
        font-size: var(--nx-text-callout);
        font-weight: 500;
        color: var(--nx-text);
    }
    &__tip {
        max-width: 420px;
        font-size: var(--nx-text-caption);
        line-height: 1.5;
        color: var(--nx-text-3);
        text-align: center;
    }
}

// ------------------------------------------------------------ step 2
.vcd-body {
    display: flex;
    flex-direction: column;
    gap: var(--nx-space-4);
}

.vcd-tips {
    display: flex;
    gap: var(--nx-space-3);
    padding: var(--nx-space-3) var(--nx-space-4);
    border-radius: var(--nx-radius);
    background: var(--nx-info-soft);
    color: var(--nx-info);

    > i {
        margin-top: 2px;
        font-size: var(--nx-text-body);
    }
    p {
        margin: 0;
        font-size: var(--nx-text-footnote);
        line-height: 1.5;
        color: var(--nx-text-2);

        &.vcd-tips__lead {
            font-weight: 600;
            color: var(--nx-text);
        }
    }
}

.vcd-wave {
    position: relative;
    width: 100%;
    height: 180px;
    border-radius: var(--nx-radius-lg);
    background: var(--nx-surface-2);
    overflow: hidden;
    cursor: crosshair;
    user-select: none;

    &__canvas {
        display: block;
        width: 100%;
        height: 100%;
    }
    &__selection {
        position: absolute;
        top: 0;
        bottom: 0;
        border-left: 2px solid var(--nx-accent);
        border-right: 2px solid var(--nx-accent);
        background: color-mix(in srgb, var(--nx-accent) 16%, transparent);
        pointer-events: none;
    }
    &__duration {
        position: absolute;
        top: var(--nx-space-2);
        right: var(--nx-space-2);
        padding: 4px 10px;
        border-radius: var(--nx-radius-pill);
        background: var(--nx-surface);
        box-shadow: var(--nx-shadow-1);
        color: var(--nx-text);
        font-size: var(--nx-text-caption);
        font-weight: 600;

        &.is-invalid {
            background: var(--nx-danger-soft);
            color: var(--nx-danger);
        }
    }
}

.vcd-controls {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--nx-space-2);

    .el-button + .el-button {
        margin-left: 0;
    }
}

.vcd-footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--nx-space-2);
    margin-top: var(--nx-space-6);

    .el-button + .el-button {
        margin-left: 0;
    }
}

@media (max-width: 480px) {
    .vcd-step__label {
        font-size: var(--nx-text-footnote);
    }
    .vcd-wave {
        height: 140px;
    }
}
</style>
