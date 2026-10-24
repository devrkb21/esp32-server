<template>
  <article class="agent-card" :aria-label="device.agentName">
    <!-- Identity -->
    <header class="agent-card__head">
      <span class="nx-avatar agent-card__avatar" aria-hidden="true">{{ initial }}</span>
      <div class="agent-card__id">
        <h3 class="agent-card__name nx-truncate" :title="device.agentName">{{ device.agentName }}</h3>
        <div class="agent-card__meta" :title="`${$t('home.lastConversation')}: ${formattedLastConnectedTime}`">
          <span class="nx-dot" :class="{ 'nx-dot--online': recentlyActive }" aria-hidden="true"></span>
          <span class="nx-num">{{ deviceCountText }}</span>
          <span class="agent-card__sep" aria-hidden="true">·</span>
          <span class="nx-truncate">{{ formattedLastConnectedTime }}</span>
        </div>
      </div>

      <el-dropdown trigger="click" placement="bottom-end" @command="handleCommand">
        <button type="button" class="nx-icon-btn agent-card__more" :aria-label="tt('home.moreActions', 'More actions')"
          :title="tt('home.moreActions', 'More actions')">
          <i class="el-icon-more" aria-hidden="true"></i>
        </button>
        <el-dropdown-menu slot="dropdown" class="agent-card-menu">
          <el-dropdown-item command="configure" icon="el-icon-setting">{{ $t('home.configureRole') }}</el-dropdown-item>
          <el-dropdown-item command="devices" icon="el-icon-cpu">{{ $t('home.deviceManagement') }}</el-dropdown-item>
          <el-dropdown-item command="chatHistory" icon="el-icon-chat-line-round" :disabled="memoryDisabled">
            {{ $t('home.chatHistory') }}
          </el-dropdown-item>
          <el-dropdown-item v-if="featureStatus.voiceprintRecognition" command="voiceprint" icon="el-icon-microphone">
            {{ $t('home.voiceprintRecognition') }}
          </el-dropdown-item>
          <el-dropdown-item command="delete" icon="el-icon-delete" divided class="agent-card-menu__danger">
            {{ $t('home.deleteConfirmTitle') }}
          </el-dropdown-item>
        </el-dropdown-menu>
      </el-dropdown>
    </header>

    <!-- Role prompt preview -->
    <el-tooltip v-if="device.systemPrompt" :content="device.systemPrompt" placement="top" effect="light"
      popper-class="device-item-tooltip" :open-delay="400">
      <p class="agent-card__prompt">{{ device.systemPrompt }}</p>
    </el-tooltip>
    <p v-else class="agent-card__prompt agent-card__prompt--empty">{{ tt('home.noRolePrompt', 'No role description yet.') }}</p>

    <!-- Model / voice summary -->
    <dl class="agent-card__specs">
      <div class="agent-card__spec">
        <dt>{{ $t('home.languageModel') }}</dt>
        <dd class="nx-truncate" :title="device.llmModelName">{{ device.llmModelName || '—' }}</dd>
      </div>
      <div class="agent-card__spec">
        <dt>{{ $t('home.voiceModel') }}</dt>
        <dd class="nx-truncate" :title="voiceSummary">{{ voiceSummary || '—' }}</dd>
      </div>
    </dl>

    <!-- Tags -->
    <div v-if="tags.length" class="agent-card__tags">
      <span v-for="tag in visibleTags" :key="tag" class="nx-badge agent-card__tag" :title="tag">
        <span class="nx-truncate">{{ tag }}</span>
      </span>
      <el-tooltip v-if="hiddenTagCount > 0" :content="tags.join(', ')" placement="top" effect="light">
        <span class="nx-badge nx-num" tabindex="0">+{{ hiddenTagCount }}</span>
      </el-tooltip>
    </div>

    <!-- Actions -->
    <footer class="agent-card__actions">
      <button type="button" class="agent-action agent-action--accent" @click="handleConfigure">
        <i class="el-icon-setting" aria-hidden="true"></i>
        <span>{{ $t('home.configureRole') }}</span>
      </button>
      <button type="button" class="agent-action" @click="handleDeviceManage">
        <i class="el-icon-cpu" aria-hidden="true"></i>
        <span>{{ $t('home.deviceManagement') }}</span>
        <span class="agent-action__count nx-num">{{ deviceCount }}</span>
      </button>
      <el-tooltip v-if="memoryDisabled" :content="$t('home.enableMemory')" placement="top" effect="light">
        <span class="agent-action-wrap" tabindex="0">
          <button type="button" class="agent-action agent-action--icon" disabled :aria-label="$t('home.chatHistory')">
            <i class="el-icon-chat-line-round" aria-hidden="true"></i>
          </button>
        </span>
      </el-tooltip>
      <el-tooltip v-else :content="$t('home.chatHistory')" placement="top">
        <button type="button" class="agent-action agent-action--icon" :aria-label="$t('home.chatHistory')"
          @click="handleChatHistory">
          <i class="el-icon-chat-line-round" aria-hidden="true"></i>
        </button>
      </el-tooltip>
    </footer>
  </article>
</template>

<script>
const MAX_VISIBLE_TAGS = 3;
const RECENT_MINUTES = 5;

export default {
  name: 'DeviceItem',
  props: {
    device: { type: Object, required: true },
    featureStatus: {
      type: Object,
      default: () => ({
        voiceprintRecognition: false,
        voiceClone: false,
        knowledgeBase: false
      })
    }
  },
  data() {
    return { switchValue: false }
  },
  computed: {
    formattedLastConnectedTime() {
      if (!this.device.lastConnectedAt) return this.$t('home.noConversation');

      const lastTime = new Date(this.device.lastConnectedAt);
      const now = new Date();
      const diffMinutes = Math.floor((now - lastTime) / (1000 * 60));

      if (diffMinutes <= 1) {
        return this.$t('home.justNow');
      } else if (diffMinutes < 60) {
        return this.$t('home.minutesAgo', { minutes: diffMinutes });
      } else if (diffMinutes < 24 * 60) {
        const hours = Math.floor(diffMinutes / 60);
        const minutes = diffMinutes % 60;
        return this.$t('home.hoursAgo', { hours, minutes });
      } else {
        return this.device.lastConnectedAt;
      }
    },
    tags() {
      if (!this.device.tags) return [];
      return this.device.tags.map((tag) => tag.tagName).filter(Boolean);
    },
    visibleTags() {
      return this.tags.slice(0, MAX_VISIBLE_TAGS);
    },
    hiddenTagCount() {
      return Math.max(0, this.tags.length - MAX_VISIBLE_TAGS);
    },
    initial() {
      const name = (this.device.agentName || '').trim();
      return name ? Array.from(name)[0] : '?';
    },
    deviceCount() {
      return Number(this.device.deviceCount) || 0;
    },
    deviceCountText() {
      const count = this.deviceCount;
      if (this.$te('home.deviceCount')) {
        return this.$tc('home.deviceCount', count, { count: count.toLocaleString() });
      }
      if (count === 0) return 'No devices';
      return count === 1 ? '1 device' : `${count.toLocaleString()} devices`;
    },
    // Talked within the last few minutes: shown as a live (pulsing) dot
    recentlyActive() {
      if (!this.device.lastConnectedAt) return false;
      const time = new Date(this.device.lastConnectedAt).getTime();
      if (Number.isNaN(time)) return false;
      return Date.now() - time <= RECENT_MINUTES * 60 * 1000;
    },
    voiceSummary() {
      const model = this.device.ttsModelName || '';
      const voice = this.device.ttsVoiceName || '';
      if (model && voice) return `${model} (${voice})`;
      return model || voice;
    },
    memoryDisabled() {
      return this.device.memModelId === 'Memory_nomem';
    }
  },
  methods: {
    // Translate with an English fallback for strings still pending in src/i18n/_pending
    tt(key, fallback) {
      return this.$te(key) ? this.$t(key) : fallback;
    },
    handleCommand(command) {
      const actions = {
        configure: this.handleConfigure,
        devices: this.handleDeviceManage,
        chatHistory: this.handleChatHistory,
        voiceprint: this.handleVoicePrint,
        delete: this.handleDelete
      };
      if (actions[command]) actions[command]();
    },
    handleDelete() {
      this.$emit('delete', this.device)
    },
    handleConfigure() {
      this.$router.push({ path: '/role-config', query: { agentId: this.device.agentId } });
    },
    handleVoicePrint() {
      this.$router.push({ path: '/voice-print', query: { agentId: this.device.agentId } });
    },
    handleDeviceManage() {
      this.$router.push({ path: '/device-management', query: { agentId: this.device.agentId } });
    },
    handleChatHistory() {
      if (this.device.memModelId === 'Memory_nomem') {
        return
      }
      this.$emit('chat-history', { agentId: this.device.agentId, agentName: this.device.agentName })
    }
  },
}
</script>

<style lang="scss" scoped>
.agent-card {
  display: flex;
  flex-direction: column;
  gap: var(--nx-space-4);
  min-width: 0;
  padding: var(--nx-space-5);
  background: var(--nx-surface);
  border: 1px solid var(--nx-border);
  border-radius: var(--nx-radius-lg);
  box-shadow: var(--nx-shadow-1);
  transition: box-shadow var(--nx-dur-2) var(--nx-ease), border-color var(--nx-dur-2) var(--nx-ease);

  &:hover,
  &:focus-within {
    box-shadow: var(--nx-shadow-2);
    border-color: var(--nx-border-strong);
  }

  &__head {
    display: flex;
    align-items: center;
    gap: var(--nx-space-3);
    min-width: 0;
  }
  &__avatar {
    width: 44px;
    height: 44px;
    border-radius: var(--nx-radius);
    font-size: var(--nx-text-headline);
  }
  &__id {
    flex: 1 1 auto;
    min-width: 0;
  }
  &__name {
    margin: 0;
    font-size: var(--nx-text-headline);
    line-height: 1.41;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--nx-text);
  }
  &__meta {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    font-size: var(--nx-text-footnote);
    color: var(--nx-text-2);
    white-space: nowrap;
  }
  &__sep {
    color: var(--nx-text-3);
  }
  &__more {
    flex: none;
    align-self: flex-start;
    margin: -6px -8px 0 0;
  }

  &__prompt {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    margin: 0;
    min-height: calc(2 * 1.43em);
    font-size: var(--nx-text-callout);
    line-height: 1.43;
    color: var(--nx-text-2);
    overflow-wrap: anywhere;

    &--empty {
      color: var(--nx-text-3);
    }
  }

  &__specs {
    display: flex;
    flex-direction: column;
    gap: var(--nx-space-1);
    margin: 0;
    padding: var(--nx-space-3);
    border-radius: var(--nx-radius);
    background: var(--nx-surface-2);
  }
  &__spec {
    display: grid;
    grid-template-columns: minmax(48px, auto) minmax(0, 1fr);
    gap: var(--nx-space-3);
    align-items: baseline;
    min-width: 0;

    dt {
      font-size: var(--nx-text-caption);
      font-weight: 500;
      letter-spacing: 0.01em;
      color: var(--nx-text-3);
    }
    dd {
      margin: 0;
      font-size: var(--nx-text-callout);
      color: var(--nx-text);
    }
  }

  &__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    min-width: 0;
    margin-top: calc(-1 * var(--nx-space-1));
  }
  &__tag {
    max-width: 100%;
  }

  // Three equal actions on one line; long labels truncate instead of wrapping to a new row
  &__actions {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
    gap: var(--nx-space-2);
    margin-top: auto;
    padding-top: var(--nx-space-4);
    border-top: 1px solid var(--nx-border);
  }
}

.agent-action--icon {
  width: var(--nx-control-h-sm);
  padding: 0;
  font-size: var(--nx-icon-sm);
}

.agent-action-wrap {
  display: flex;
  min-width: 0;
  border-radius: var(--nx-radius-sm);
}

.agent-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  min-width: 0;
  height: var(--nx-control-h-sm);
  padding: 0 12px;
  border: 0;
  border-radius: var(--nx-radius-sm);
  background: var(--nx-surface-2);
  color: var(--nx-text);
  font: inherit;
  font-size: var(--nx-text-footnote);
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  > span:not(.agent-action__count) {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  transition: background-color var(--nx-dur-1) var(--nx-ease), color var(--nx-dur-1) var(--nx-ease),
    transform var(--nx-dur-1) var(--nx-ease);

  i {
    font-size: var(--nx-text-callout);
    color: var(--nx-text-2);
  }
  &:hover {
    background: var(--nx-surface-3);
  }
  &:active {
    transform: scale(0.97);
  }
  &:disabled {
    color: var(--nx-text-3);
    cursor: not-allowed;
    pointer-events: none;
    i {
      color: var(--nx-text-3);
    }
  }

  &--accent {
    background: var(--nx-accent-soft);
    color: var(--nx-accent);
    i {
      color: var(--nx-accent);
    }
    &:hover {
      background: var(--nx-accent);
      color: var(--nx-on-accent);
      i {
        color: var(--nx-on-accent);
      }
    }
  }

  &__count {
    min-width: 20px;
    height: 18px;
    padding: 0 6px;
    border-radius: var(--nx-radius-pill);
    background: var(--nx-surface);
    color: var(--nx-text-2);
    font-size: var(--nx-text-caption);
    line-height: 18px;
    text-align: center;
  }
}
</style>

<style lang="scss">
// Poppers are appended to <body>, so these are not scoped
.device-item-tooltip {
  max-width: min(420px, calc(100vw - 32px));
  max-height: 60vh;
  overflow-y: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.5;
}

.agent-card-menu {
  min-width: 200px;

  .el-dropdown-menu__item {
    display: flex;
    align-items: center;
    gap: 8px;
    i {
      margin-right: 0;
      color: var(--nx-text-3);
    }
  }
  .el-dropdown-menu__item.agent-card-menu__danger,
  .el-dropdown-menu__item.agent-card-menu__danger i {
    color: var(--nx-danger);
  }
  .el-dropdown-menu__item.agent-card-menu__danger:hover {
    background: var(--nx-danger-soft);
    color: var(--nx-danger);
  }
}
</style>
