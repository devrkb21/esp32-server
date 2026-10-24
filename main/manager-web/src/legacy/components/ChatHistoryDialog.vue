<template>
    <CustomDialog
        :title="$t('chatHistory.with') + agentName + $t('chatHistory.dialogTitle')"
        :visible.sync="dialogVisible"
        width="960px"
        :footer="false"
        :close-on-click-modal="false"
        custom-class="chat-history-dialog">
        <template v-slot:title>
            <div class="ch-title">
                <span class="ch-title__text nx-truncate" :title="$t('chatHistory.with') + agentName + $t('chatHistory.dialogTitle')">
                    {{ $t('chatHistory.with') + agentName + $t('chatHistory.dialogTitle') }}
                </span>
                <span v-if="currentMacAddress" class="nx-badge ch-title__mac nx-mono">
                    <MacAddressMask :macAddress="currentMacAddress" />
                </span>
            </div>
        </template>

        <div class="ch">
            <!-- Sessions -->
            <aside class="ch-sessions">
                <div class="ch-sessions__head">{{ tt('chatHistory.sessions', 'Conversations') }}</div>
                <div class="ch-sessions__list" role="listbox" :aria-label="tt('chatHistory.sessions', 'Conversations')"
                    @scroll="handleScroll">
                    <button v-for="session in sessions" :key="session.sessionId" type="button" class="ch-session"
                        role="option" :aria-selected="String(currentSessionId === session.sessionId)"
                        :class="{ 'is-active': currentSessionId === session.sessionId }" @click="selectSession(session)">
                        <span class="ch-session__avatar" :class="'is-' + sessionTone(session.sessionId)" aria-hidden="true">
                            <i class="el-icon-user"></i>
                        </span>
                        <span class="ch-session__time nx-truncate" :title="session.title || formatTime(session.createdAt)">
                            {{ session.title || formatTime(session.createdAt) }}
                        </span>
                        <span class="ch-session__count nx-num">{{ session.chatCount > 99 ? '99+' : session.chatCount }}</span>
                    </button>

                    <template v-if="loading && sessions.length === 0">
                        <div v-for="i in 5" :key="'sk-' + i" class="ch-session ch-session--skeleton" aria-hidden="true">
                            <span class="nx-skeleton ch-session__avatar"></span>
                            <span class="nx-skeleton" style="flex: 1"></span>
                        </div>
                    </template>
                    <div v-else-if="loading" class="ch-sessions__note">{{ $t('chatHistory.loading') }}</div>
                    <div v-else-if="!hasMore && sessions.length > 0" class="ch-sessions__note">{{ $t('chatHistory.noMoreRecords') }}</div>
                </div>
            </aside>

            <!-- Conversation -->
            <section class="ch-thread">
                <div v-if="currentSessionId" class="ch-messages">
                    <template v-for="(message, index) in messagesWithTime">
                        <div v-if="message.type === 'time'" :key="message.id" class="ch-time">
                            <span>{{ message.content }}</span>
                        </div>
                        <div v-else :key="message.id" class="ch-msg"
                            :class="{ 'ch-msg--user': message.chatType === 1, 'ch-msg--tool': message.chatType === 3 }">
                            <span v-if="message.chatType !== 1" class="ch-msg__avatar" aria-hidden="true">
                                <img src="@/assets/nobix/mark.svg" alt="" width="28" height="28" />
                            </span>
                            <div class="ch-bubble">
                                <div class="ch-bubble__body">
                                    <template v-if="Array.isArray(extractContentFromString(message.content))">
                                        <div v-for="(item, idx) in extractContentFromString(message.content)" :key="idx">
                                            <div v-if="item.type === 'text'" class="ch-text">{{ item.text }}</div>
                                            <div v-else-if="item.type === 'tool'" class="ch-tool">{{ item.text }}</div>
                                            <div v-else-if="item.type === 'tool_result'" class="ch-tool">
                                                <div v-if="item.text && item.text.length > 80" class="ch-tool__result">
                                                    <div v-if="isToolResultCollapsed(index, idx)" class="ch-tool__collapsed">
                                                        {{ getFirstLineText(item.text) }}
                                                    </div>
                                                    <div v-else class="ch-tool__expanded">{{ item.text }}</div>
                                                    <button type="button" class="ch-tool__toggle"
                                                        :aria-expanded="String(!isToolResultCollapsed(index, idx))"
                                                        @click="toggleToolResult(index, idx)">
                                                        <i :class="isToolResultCollapsed(index, idx) ? 'el-icon-arrow-down' : 'el-icon-arrow-up'"
                                                            aria-hidden="true"></i>
                                                    </button>
                                                </div>
                                                <div v-else>{{ item.text }}</div>
                                            </div>
                                        </div>
                                    </template>
                                    <div v-else class="ch-text">{{ extractContentFromString(message.content) }}</div>
                                </div>
                                <button v-if="message.audioId" type="button" class="ch-audio"
                                    :class="{ 'is-playing': playingAudioId === message.audioId }"
                                    :aria-label="playingAudioId === message.audioId ? tt('chatHistory.stopAudio', 'Stop recording') : tt('chatHistory.playAudio', 'Play recording')"
                                    @click="playAudio(message)">
                                    <i :class="getAudioIconClass(message)" aria-hidden="true"></i>
                                </button>
                            </div>
                        </div>
                    </template>
                </div>

                <div v-else-if="!loading && sessions.length === 0" class="nx-empty ch-empty">
                    <span class="nx-icon-tile nx-icon-tile--lg"><i class="el-icon-chat-line-round"></i></span>
                    <h3 class="nx-empty__title">{{ tt('chatHistory.emptyTitle', 'No conversations yet') }}</h3>
                    <p class="nx-empty__text">
                        {{ tt('chatHistory.emptyText', 'Conversations appear here after someone talks to this agent.') }}
                    </p>
                </div>

                <div v-else class="ch-placeholder">{{ $t('chatHistory.selectSession') }}</div>

                <footer v-if="currentSessionId" class="ch-downloads">
                    <el-button size="small" icon="el-icon-download" @click="downloadCurrentSessionWithPrevious">
                        {{ $t('chatHistory.downloadCurrentWithPreviousSessions') }}
                    </el-button>
                    <el-button size="small" icon="el-icon-download" @click="downloadCurrentSession">
                        {{ $t('chatHistory.downloadCurrentSession') }}
                    </el-button>
                </footer>
            </section>
        </div>
    </CustomDialog>
</template>

<script>
import { debounce } from '@/utils'
import Api from '@/apis/api';
import CustomDialog from '@/components/CustomDialog.vue';
import MacAddressMask from '@/components/MacAddressMask.vue';

export default {
    name: 'ChatHistoryDialog',
    props: {
        visible: {
            type: Boolean,
            default: false
        },
        agentId: {
            type: String,
            required: true
        },
        agentName: {
            type: String,
            required: true
        }
    },
    data() {
        return {
            dialogVisible: false,
            sessions: [],
            messages: [],
            currentSessionId: '',
            currentMacAddress: '',
            page: 1,
            limit: 20,
            loading: false,
            hasMore: true,
            scrollTimer: null,
            isFirstLoad: true,
            playingAudioId: null,
            audioElement: null,
            expandedToolResults: {} // Track expansion state of tool results
        };
    },
    components: {
        CustomDialog,
        MacAddressMask,
    },
    watch: {
        visible(val) {
            this.dialogVisible = val;
            if (val) {
                this.resetData();
                this.loadSessions();
            } else {
                this.audioElement?.pause();
                this.audioElement = null;
                this.playingAudioId = null;
            }
        },
        dialogVisible(val) {
            if (!val) {
                this.$emit('update:visible', false);
            }
        }
    },
    computed: {
        messagesWithTime() {
            if (!this.messages || this.messages.length === 0) return [];

            const result = [];
            const TIME_INTERVAL = 60 * 1000; // 1 minute time interval (ms)

            // Add time tag for the first message
            if (this.messages[0]) {
                result.push({
                    type: 'time',
                    content: this.formatTime(this.messages[this.messages.length - 1].createdAt),
                    id: `time-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                });
            }

            // Process message list
            for (let i = 0; i < this.messages.length; i++) {
                const currentMessage = this.messages[i];
                result.push(currentMessage);

                // Check if time tag needs to be added
                if (i < this.messages.length - 1) {
                    const currentTime = new Date(currentMessage.createdAt).getTime();
                    const nextTime = new Date(this.messages[i + 1].createdAt).getTime();

                    if (nextTime - currentTime > TIME_INTERVAL) {
                        result.push({
                            type: 'time',
                            content: this.formatTime(this.messages[i + 1].createdAt),
                            id: `time-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                        });
                    }
                }
            }

            return result;
        }
    },
    methods: {
        /**
         * Extract chat content from content field
         * If content is JSON format (e.g. {"speaker": "Unknown Speaker", "content": "What time is it?"}), extract content field
         * If content is plain string, return directly
         * 
         * @param {string} content Original content
         * @returns {string} Extracted chat content
         */
        extractContentFromString(content) {
            if (!content || content.trim() === '') {
                return content;
            }

            // Try parsing as JSON
            try {
                const jsonObj = JSON.parse(content);

                // If array format (contains text and tool)
                if (Array.isArray(jsonObj)) {
                    return jsonObj;
                }

                // If object and has content field
                if (jsonObj && typeof jsonObj === 'object' && jsonObj.content) {
                    return jsonObj.content;
                }
            } catch (e) {
                // If not valid JSON, return original content directly
            }

            // If not JSON format or no content field, return original content
            return content;
        },
        // Toggle tool result expanded/collapsed state
        toggleToolResult(messageIndex, itemIndex) {
            const key = `${messageIndex}-${itemIndex}`;
            this.$set(this.expandedToolResults, key, !this.expandedToolResults[key]);
        },
        // Check if tool result is in collapsed state
        isToolResultCollapsed(messageIndex, itemIndex) {
            const key = `${messageIndex}-${itemIndex}`;
            // Default collapsed (true means collapsed)
            return !this.expandedToolResults[key];
        },
        // Get truncated text (show only first line)
        getFirstLineText(text) {
            if (!text) return '';
            const firstLine = text.split('\n')[0];
            return firstLine.length < text.length ? firstLine + '...' : text;
        },
        resetData() {
            this.sessions = [];
            this.messages = [];
            this.currentSessionId = '';
            this.currentMacAddress = '';
            this.page = 1;
            this.loading = false;
            this.hasMore = true;
            this.isFirstLoad = true;
            this.expandedToolResults = {};
        },
        loadSessions() {
            if (this.loading || (!this.isFirstLoad && !this.hasMore)) {
                return;
            }

            this.loading = true;
            const params = {
                page: this.page,
                limit: this.limit
            };

            Api.agent.getAgentSessions(this.agentId, params, (res) => {
                if (res.data && res.data.data && Array.isArray(res.data.data.list)) {
                    const list = res.data.data.list;
                    this.hasMore = list.length === this.limit;

                    this.sessions = [...this.sessions, ...list];
                    this.page++;

                    if (this.sessions.length > 0 && !this.currentSessionId) {
                        this.selectSession(this.sessions[0]);
                    }
                }
                this.loading = false;
                this.isFirstLoad = false;
            });
        },
        selectSession(session) {
            this.currentSessionId = session.sessionId;
            Api.agent.getAgentChatHistory(this.agentId, session.sessionId, (res) => {
                if (res.data && res.data.data) {
                    this.messages = res.data.data;
                    if (this.messages.length > 0 && this.messages[0].macAddress) {
                        this.currentMacAddress = this.messages[0].macAddress;
                    }
                    // Update chat record count in session list
                    this.sessions = this.sessions.map(item => {
                        if (item.sessionId === session.sessionId) {
                            item.chatCount = this.messages.length;
                        }
                        return item;
                    })
                }
            });
        },
        handleScroll(e) {
            if (this.scrollTimer) {
                clearTimeout(this.scrollTimer);
            }

            this.scrollTimer = setTimeout(() => {
                const { scrollTop, scrollHeight, clientHeight } = e.target;
                // Load more when scrolled to bottom
                if (scrollHeight - scrollTop <= clientHeight + 50) {
                    this.loadSessions();
                }
            }, 200);
        },
        formatTime(timestamp) {
            const date = new Date(timestamp);
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);

            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');

            if (date >= today) {
                return `${this.$t('chatHistory.today')} ${hours}:${minutes}`;
            } else if (date >= yesterday) {
                return `${this.$t('chatHistory.yesterday')} ${hours}:${minutes}`;
            } else {
                const year = date.getFullYear();
                const month = (date.getMonth() + 1).toString().padStart(2, '0');
                const day = date.getDate().toString().padStart(2, '0');
                return `${year}-${month}-${day} ${hours}:${minutes}`;
            }
        },
        getAudioIconClass(message) {
            if (this.playingAudioId === message.audioId) {
                return 'el-icon-loading';
            }
            return 'el-icon-video-play';
        },
        playAudio: debounce(function(message) {
            if (this.playingAudioId === message.audioId) {
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
            this.playingAudioId = message.audioId;
            Api.agent.getAudioId(message.audioId, (res) => {
                if (res.data && res.data.data) {
                    if (!this.audioElement) {
                        this.audioElement = new Audio();
                    }
                    
                    // Play audio using retrieved download ID
                    this.audioElement.src = Api.getServiceUrl() + `/agent/play/${res.data.data}`;
                    this.audioElement.onended = () => {
                        this.playingAudioId = null;
                        this.audioElement = null;
                    };

                    this.audioElement.play();
                }
            });
        }, 300),
        // Stable soft colour per session (same digit-sum rule the old avatars used)
        sessionTone(sessionId) {
            const tones = ['accent', 'info', 'success', 'warning', 'neutral'];
            const numbers = String(sessionId || '').match(/\d+/g);
            if (!numbers) return tones[0];
            const sum = numbers.reduce((acc, num) => acc + parseInt(num), 0);
            return tones[sum % tones.length];
        },
        // Translate with an English fallback for strings still pending in src/i18n/_pending
        tt(key, fallback) {
            return this.$te(key) ? this.$t(key) : fallback;
        },

        // Download this session chat history
        downloadCurrentSession() {
            Api.agent.getDownloadUrl(this.agentId, this.currentSessionId, (res) => {
                if (res && res.data && res.data.code === 0 && res.data.data) {
                    const uuid = res.data.data;
                    window.open(`${Api.getServiceUrl()}/agent/chat-history/download/${uuid}/current`, '_blank');
                } else {
                    this.$message.error(this.$t('chatHistory.downloadLinkFailed'));
                }
            });
        },

        // Download this session and previous 20 sessions chat history
        downloadCurrentSessionWithPrevious() {
            Api.agent.getDownloadUrl(this.agentId, this.currentSessionId, (res) => {
                if (res && res.data && res.data.code === 0 && res.data.data) {
                    const uuid = res.data.data;
                    window.open(`${Api.getServiceUrl()}/agent/chat-history/download/${uuid}/previous`, '_blank');
                } else {
                    this.$message.error(this.$t('chatHistory.downloadLinkFailed'));
                }
            });
        }
    }
};
</script>

<style lang="scss" scoped>
// ------------------------------------------------------------------ title

.ch-title {
    display: flex;
    align-items: center;
    gap: var(--nx-space-2);
    min-width: 0;
    padding-right: 40px;

    &__text {
        font-size: var(--nx-text-headline);
        font-weight: 600;
        letter-spacing: -0.01em;
        color: var(--nx-text);
    }
    &__mac {
        flex: none;
        font-weight: 500;
    }
}

// ------------------------------------------------------------------ layout

.ch {
    display: grid;
    grid-template-columns: 260px minmax(0, 1fr);
    flex: 1 1 auto;
    min-height: 0;
    border-top: 1px solid var(--nx-border);
}

// ------------------------------------------------------------------ sessions

.ch-sessions {
    display: flex;
    flex-direction: column;
    min-height: 0;
    border-right: 1px solid var(--nx-border);
    background: var(--nx-bg);

    &__head {
        padding: var(--nx-space-3) var(--nx-space-4) var(--nx-space-2);
        font-size: var(--nx-text-caption);
        font-weight: 500;
        letter-spacing: 0.01em;
        color: var(--nx-text-3);
    }
    &__list {
        flex: 1 1 auto;
        min-height: 0;
        overflow-y: auto;
        padding: 0 var(--nx-space-2) var(--nx-space-3);
    }
    &__note {
        padding: var(--nx-space-3) var(--nx-space-2) var(--nx-space-4);
        text-align: center;
        font-size: var(--nx-text-caption);
        color: var(--nx-text-3);
    }
}

.ch-session {
    display: flex;
    align-items: center;
    gap: var(--nx-space-3);
    width: 100%;
    min-height: 52px;
    margin-bottom: 2px;
    padding: 0 var(--nx-space-3) 0 var(--nx-space-2);
    border: 0;
    border-radius: var(--nx-radius);
    background: transparent;
    color: var(--nx-text);
    font: inherit;
    font-size: var(--nx-text-callout);
    text-align: left;
    cursor: pointer;
    transition: background-color var(--nx-dur-1) var(--nx-ease);

    &:hover {
        background: var(--nx-surface-2);
    }
    &.is-active {
        background: var(--nx-surface);
        box-shadow: var(--nx-shadow-1);
        font-weight: 600;
    }
    &--skeleton {
        cursor: default;
        &:hover {
            background: transparent;
        }
    }

    &__avatar {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: none;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: var(--nx-surface-2);
        color: var(--nx-text-2);

        &.is-accent {
            background: var(--nx-accent-soft);
            color: var(--nx-accent);
        }
        &.is-info {
            background: var(--nx-info-soft);
            color: var(--nx-info);
        }
        &.is-success {
            background: var(--nx-success-soft);
            color: var(--nx-success);
        }
        &.is-warning {
            background: var(--nx-warning-soft);
            color: var(--nx-warning);
        }
        &.is-neutral {
            background: var(--nx-surface-3);
            color: var(--nx-text-2);
        }
    }
    &__time {
        flex: 1 1 auto;
    }
    &__count {
        flex: none;
        min-width: 24px;
        height: 20px;
        padding: 0 6px;
        border-radius: var(--nx-radius-pill);
        background: var(--nx-surface-3);
        color: var(--nx-text-2);
        font-size: var(--nx-text-caption);
        font-weight: 600;
        line-height: 20px;
        text-align: center;
    }
}

// ------------------------------------------------------------------ thread

.ch-thread {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
}

.ch-messages {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    padding: var(--nx-space-5) var(--nx-space-6);
}

.ch-time {
    display: flex;
    align-items: center;
    gap: var(--nx-space-3);
    margin: var(--nx-space-2) 0 var(--nx-space-4);
    font-size: var(--nx-text-caption);
    font-weight: 500;
    color: var(--nx-text-3);
    font-variant-numeric: tabular-nums;

    &::before,
    &::after {
        content: "";
        flex: 1;
        height: 1px;
        background: var(--nx-border);
    }
}

.ch-msg {
    display: flex;
    align-items: flex-end;
    gap: var(--nx-space-2);
    margin-bottom: var(--nx-space-3);

    &__avatar {
        flex: none;
        width: 28px;
        height: 28px;
        img {
            display: block;
            width: 100%;
            height: 100%;
        }
    }

    &--user {
        justify-content: flex-end;
    }
}

.ch-bubble {
    display: flex;
    align-items: center;
    gap: var(--nx-space-2);
    max-width: min(78%, 560px);
    min-width: 0;
    padding: 10px 14px;
    border-radius: 18px 18px 18px 6px;
    background: var(--nx-surface-2);
    color: var(--nx-text);
    font-size: var(--nx-text-body);
    line-height: 1.47;
    text-align: left;

    &__body {
        flex: 1 1 auto;
        min-width: 0;
        overflow-wrap: anywhere;
    }

    .ch-msg--user & {
        border-radius: 18px 18px 6px 18px;
        background: var(--nx-accent-soft);
    }
    .ch-msg--tool & {
        padding: 8px 12px;
        border: 1px solid var(--nx-border);
        background: transparent;
        font-size: var(--nx-text-footnote);
        color: var(--nx-text-2);
    }
}

.ch-text,
.ch-tool__expanded {
    white-space: pre-wrap;
}

.ch-text + .ch-text,
.ch-text + .ch-tool,
.ch-tool + .ch-text {
    margin-top: 4px;
}

.ch-tool {
    font-family: var(--nx-font-mono);
    font-size: var(--nx-text-caption);
    color: var(--nx-text-2);

    &__result {
        position: relative;
        padding-right: 28px;
    }
    &__collapsed {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
    }
    &__toggle {
        position: absolute;
        top: -4px;
        right: -4px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border: 0;
        border-radius: var(--nx-radius-sm);
        background: transparent;
        color: var(--nx-accent);
        cursor: pointer;
        &:hover {
            background: var(--nx-accent-soft);
        }
    }
}

// Play button sits at the trailing edge of every bubble, centred vertically
.ch-audio {
    flex: none;
    align-self: center;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    margin-right: -4px;
    border: 0;
    border-radius: 50%;
    background: var(--nx-surface);
    color: var(--nx-accent);
    font-size: var(--nx-text-callout);
    cursor: pointer;
    box-shadow: var(--nx-shadow-1);
    transition: transform var(--nx-dur-1) var(--nx-ease), background-color var(--nx-dur-1) var(--nx-ease);

    &:hover {
        background: var(--nx-accent);
        color: var(--nx-on-accent);
    }
    &:active {
        transform: scale(0.94);
    }
    &.is-playing {
        background: var(--nx-accent);
        color: var(--nx-on-accent);
    }
}

.ch-placeholder {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--nx-space-6);
    text-align: center;
    font-size: var(--nx-text-callout);
    color: var(--nx-text-3);
}

.ch-empty {
    flex: 1;
    justify-content: center;
}

.ch-downloads {
    display: flex;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: var(--nx-space-2);
    padding: var(--nx-space-3) var(--nx-space-5);
    border-top: 1px solid var(--nx-border);

    .el-button + .el-button {
        margin-left: 0;
    }
}

// ------------------------------------------------------------------ narrow

@media (max-width: 720px) {
    .ch {
        grid-template-columns: minmax(0, 1fr);
        grid-template-rows: auto minmax(0, 1fr);
    }
    .ch-sessions {
        max-height: 176px;
        border-right: 0;
        border-bottom: 1px solid var(--nx-border);
    }
    .ch-messages {
        padding: var(--nx-space-4);
    }
    .ch-bubble {
        max-width: 88%;
    }
    .ch-downloads {
        padding: var(--nx-space-3) var(--nx-space-4);
        .el-button {
            flex: 1 1 100%;
            white-space: normal;
        }
    }
}
</style>

<style lang="scss">
// el-dialog is rendered by CustomDialog, so size it with a global, more specific selector
.el-dialog.chat-history-dialog {
    height: min(760px, calc(100vh - 64px));

    .el-dialog__body {
        display: flex;
        flex-direction: column;
        padding: 0;
        overflow: hidden;
    }
}
</style>
