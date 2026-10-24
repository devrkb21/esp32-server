<template>
  <div class="nx-home">
    <HeaderBar :devices="devices" />

    <main class="nx-page">
      <!-- Page header: title, description, search + primary action -->
      <header class="nx-page-header">
        <div class="nx-page-header__text">
          <h1 class="nx-title">{{ $t('header.smartManagement') }}</h1>
          <p class="nx-page-header__desc">
            {{ tt('home.subtitle', 'Each agent gives your robots a personality, a voice and a memory.') }}
          </p>
        </div>
        <div class="nx-page-header__actions home-actions">
          <div class="home-search">
            <el-input ref="searchInput" v-model="search" :placeholder="$t('header.searchPlaceholder')"
              :aria-label="$t('header.searchPlaceholder')" clearable class="home-search__input"
              @keyup.enter.native="handleSearch" @clear="handleSearchReset" @focus="showSearchHistory"
              @blur="hideSearchHistory">
              <i slot="prefix" class="el-input__icon el-icon-search home-search__icon" role="button"
                :aria-label="$t('header.searchPlaceholder')" @click="handleSearch"></i>
            </el-input>

            <!-- Search history -->
            <transition name="nx-fade">
              <div v-if="showHistory && searchHistory.length > 0" class="home-history" role="listbox">
                <div class="home-history__head">
                  <span>{{ $t('header.searchHistory') }}</span>
                  <button type="button" class="home-history__clear" @mousedown.prevent @click="clearSearchHistory">
                    {{ $t('header.clearHistory') }}
                  </button>
                </div>
                <div v-for="(item, index) in searchHistory" :key="index" class="home-history__item" role="option"
                  @mousedown.prevent @click.stop="selectSearchHistory(item)">
                  <i class="el-icon-time" aria-hidden="true"></i>
                  <span class="nx-truncate">{{ item }}</span>
                  <button type="button" class="home-history__remove" :aria-label="$t('header.clearHistory')"
                    @mousedown.prevent @click.stop="removeSearchHistory(index)">
                    <i class="el-icon-close" aria-hidden="true"></i>
                  </button>
                </div>
              </div>
            </transition>
          </div>
          <CustomButton type="add" icon="el-icon-plus" @click="showAddDialog">{{ $t('home.addAgent') }}</CustomButton>
        </div>
      </header>

      <!-- Agents -->
      <section :aria-label="$t('header.smartManagement')" :aria-busy="isLoading ? 'true' : 'false'">
        <div v-if="isLoading" class="nx-grid">
          <div v-for="i in skeletonItems" :key="'skeleton-' + i" class="nx-card home-skeleton" aria-hidden="true">
            <div class="home-skeleton__head">
              <span class="nx-skeleton home-skeleton__avatar"></span>
              <div class="home-skeleton__lines">
                <span class="nx-skeleton" style="width: 60%"></span>
                <span class="nx-skeleton" style="width: 40%"></span>
              </div>
            </div>
            <span class="nx-skeleton" style="width: 92%"></span>
            <span class="nx-skeleton home-skeleton__block"></span>
            <div class="home-skeleton__foot">
              <span class="nx-skeleton home-skeleton__btn"></span>
              <span class="nx-skeleton home-skeleton__btn"></span>
              <span class="nx-skeleton home-skeleton__btn"></span>
            </div>
          </div>
        </div>

        <div v-else-if="devices.length" class="nx-grid">
          <DeviceItem v-for="(item, index) in devices" :key="item.agentId || index" :device="item"
            :feature-status="featureStatus" @configure="goToRoleConfig" @deviceManage="handleDeviceManage"
            @delete="handleDeleteAgent" @chat-history="handleShowChatHistory" />
        </div>

        <!-- No search results -->
        <div v-else-if="isSearching" class="nx-card">
          <div class="nx-empty">
            <span class="nx-icon-tile nx-icon-tile--lg nx-icon-tile--neutral"><i class="el-icon-search"></i></span>
            <h2 class="nx-empty__title">{{ tt('home.noResultsTitle', 'No matching agents') }}</h2>
            <p class="nx-empty__text">{{ tt('home.noResultsText', 'Try another name, tag or MAC address.') }}</p>
            <CustomButton class="nx-empty__action" @click="clearSearch">{{ tt('home.clearSearch', 'Clear search') }}</CustomButton>
          </div>
        </div>

        <!-- No agents yet -->
        <div v-else class="nx-card">
          <div class="nx-empty">
            <span class="nx-icon-tile nx-icon-tile--lg"><i class="el-icon-cpu"></i></span>
            <h2 class="nx-empty__title">{{ tt('home.emptyTitle', 'No agents yet') }}</h2>
            <p class="nx-empty__text">
              {{ tt('home.emptyText', 'Create an agent to give your robot a name, a voice and a personality.') }}
            </p>
            <CustomButton class="nx-empty__action" type="add" icon="el-icon-plus" @click="showAddDialog">
              {{ $t('home.addAgent') }}
            </CustomButton>
          </div>
        </div>
      </section>

      <!-- Activity: analytics & live telemetry -->
      <section class="nx-section">
        <div class="nx-section__head">
          <h2 class="nx-headline">{{ $t('analytics.dashboardTitle') }}</h2>
        </div>

        <div class="home-kpis">
          <div v-for="kpi in kpis" :key="kpi.key" class="nx-card home-kpi">
            <span class="nx-icon-tile nx-icon-tile--neutral"><i :class="kpi.icon" aria-hidden="true"></i></span>
            <div class="nx-stat">
              <span class="nx-stat__label nx-truncate" :title="$t(kpi.label)">{{ $t(kpi.label) }}</span>
              <span class="nx-stat__value nx-truncate">{{ formatNumber(statsSummary[kpi.key]) }}</span>
            </div>
          </div>
        </div>

        <div class="home-analytics">
          <!-- Query volume & token usage -->
          <div class="nx-card home-chart-card">
            <div class="nx-card__header">
              <div class="home-card-title">
                <h3 class="nx-headline">{{ $t('analytics.queryVolume') }}</h3>
                <span class="nx-caption">{{ $t('analytics.tokenUsage') }}</span>
              </div>
            </div>
            <div ref="usageChart" class="home-chart" role="img" :aria-label="$t('analytics.queryVolume')"></div>
          </div>

          <!-- Latency & leaderboards -->
          <div class="nx-card home-telemetry">
            <div class="nx-card__header">
              <h3 class="nx-headline nx-truncate">{{ $t('analytics.latencyBreakdown') }}</h3>
              <span class="nx-badge nx-num" :title="$t('analytics.avgLatency')">{{ statsSummary.avgLatencyMs }} ms</span>
            </div>

            <div class="home-latency">
              <div v-for="bar in latencyBars" :key="bar.key" class="home-latency__item">
                <div class="home-latency__row">
                  <span class="home-latency__name nx-truncate">
                    <i :class="bar.icon" aria-hidden="true"></i>{{ $t(bar.label) }}
                  </span>
                  <span class="home-latency__val nx-num">{{ statsSummary[bar.key] }} ms</span>
                </div>
                <div class="home-latency__track" role="presentation">
                  <span class="home-latency__fill" :class="'home-latency__fill--' + bar.tone"
                    :style="{ transform: 'scaleX(' + calcLatencyPct(statsSummary[bar.key]) / 100 + ')' }"></span>
                </div>
              </div>
            </div>

            <div class="home-leaders">
              <div class="home-leaders__col">
                <div class="home-leaders__title"><i class="el-icon-mobile" aria-hidden="true"></i>{{ $t('analytics.topDevices') }}</div>
                <ol v-if="statsSummary.topDevices && statsSummary.topDevices.length > 0" class="home-leaders__list">
                  <li v-for="(dev, idx) in statsSummary.topDevices.slice(0, 3)" :key="idx" class="home-leaders__item">
                    <span class="home-leaders__rank nx-num" :class="{ 'is-first': idx === 0 }">{{ idx + 1 }}</span>
                    <span class="home-leaders__name nx-truncate" :class="{ 'nx-mono': !dev.deviceName }"
                      :title="dev.deviceName || dev.macAddress">{{ dev.deviceName || dev.macAddress }}</span>
                    <span class="home-leaders__count nx-num">{{ formatNumber(dev.queryCount) }}</span>
                  </li>
                </ol>
                <p v-else class="home-leaders__empty">{{ $t('analytics.noData') }}</p>
              </div>

              <div class="home-leaders__col">
                <div class="home-leaders__title"><i class="el-icon-user" aria-hidden="true"></i>{{ $t('analytics.topAgents') }}</div>
                <ol v-if="statsSummary.topAgents && statsSummary.topAgents.length > 0" class="home-leaders__list">
                  <li v-for="(ag, idx) in statsSummary.topAgents.slice(0, 3)" :key="idx" class="home-leaders__item">
                    <span class="home-leaders__rank nx-num" :class="{ 'is-first': idx === 0 }">{{ idx + 1 }}</span>
                    <span class="home-leaders__name nx-truncate" :title="ag.agentName">{{ ag.agentName }}</span>
                    <span class="home-leaders__count nx-num">{{ formatNumber(ag.queryCount) }}</span>
                  </li>
                </ol>
                <p v-else class="home-leaders__empty">{{ $t('analytics.noData') }}</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>

    <VersionFooter />

    <AddWisdomBodyDialog :visible.sync="addDeviceDialogVisible" @confirm="handleWisdomBodyAdded" />

    <!-- Delete agent: type the name to confirm -->
    <el-dialog :visible.sync="deleteAgentDialogVisible" :close-on-click-modal="!isDeletingAgent"
      :close-on-press-escape="!isDeletingAgent" :show-close="!isDeletingAgent" width="480px" append-to-body
      class="delete-agent-dialog" @closed="resetDeleteAgentDialog">
      <template slot="title">
        <div class="delete-agent-title">{{ $t('home.deleteConfirmTitle') }}</div>
      </template>
      <div class="delete-agent-content">
        <span class="nx-icon-tile delete-agent-icon" aria-hidden="true"><i class="el-icon-delete"></i></span>
        <div class="delete-agent-message">
          <div class="delete-agent-copy-guard" @copy.prevent @cut.prevent @contextmenu.prevent>
            {{ $t('home.confirmDeleteAgent', { agentName: deleteTargetAgentName }) }}
          </div>
          <div class="delete-agent-target delete-agent-copy-guard" @copy.prevent @cut.prevent @contextmenu.prevent>
            {{ deleteTargetAgentName }}
          </div>
          <el-input ref="deleteAgentConfirmInput" v-model="deleteAgentConfirmText" class="delete-agent-input"
            :placeholder="$t('home.deleteAgentNamePlaceholder')" :aria-label="$t('home.deleteAgentNamePlaceholder')"
            clearable @paste.native.prevent="handleDeleteAgentPaste" @drop.native.prevent="handleDeleteAgentPaste"
            @contextmenu.native.prevent @keyup.enter.native="confirmDeleteAgent" />
          <div v-if="deleteAgentConfirmText && !isDeleteAgentNameMatched" class="delete-agent-helper" role="alert">
            {{ $t('home.deleteAgentNameMismatch') }}
          </div>
        </div>
      </div>
      <span slot="footer" class="delete-agent-footer">
        <CustomButton :disabled="isDeletingAgent" @click="closeDeleteAgentDialog">{{ $t('button.cancel') }}</CustomButton>
        <CustomButton type="delete" class="delete-agent-confirm" :loading="isDeletingAgent"
          :disabled="!isDeleteAgentNameMatched" @click="confirmDeleteAgent">
          {{ $t('button.ok') }}
        </CustomButton>
      </span>
    </el-dialog>

    <chat-history-dialog :visible.sync="showChatHistory" :agent-id="currentAgentId" :agent-name="currentAgentName" />
  </div>
</template>

<script>
import Api from '@/apis/api';
import * as echarts from 'echarts';
import { mapState } from "vuex";
import AddWisdomBodyDialog from '@/components/AddWisdomBodyDialog.vue';
import ChatHistoryDialog from '@/components/ChatHistoryDialog.vue';
import CustomButton from '@/components/CustomButton.vue';
import DeviceItem from '@/components/DeviceItem.vue';
import HeaderBar from '@/components/HeaderBar.vue';
import VersionFooter from '@/components/VersionFooter.vue';
import featureManager from '@/utils/featureManager';

const KPIS = [
  { key: 'totalQueries', label: 'analytics.totalQueries', icon: 'el-icon-chat-dot-round' },
  { key: 'todayQueries', label: 'analytics.todayQueries', icon: 'el-icon-data-line' },
  { key: 'activeDevices', label: 'analytics.activeDevices', icon: 'el-icon-cpu' },
  { key: 'totalTokens', label: 'analytics.totalTokens', icon: 'el-icon-coin' },
];

const LATENCY_BARS = [
  { key: 'asrLatencyMs', label: 'analytics.asrLatency', icon: 'el-icon-microphone', tone: 'accent' },
  { key: 'llmLatencyMs', label: 'analytics.llmLatency', icon: 'el-icon-magic-stick', tone: 'info' },
  { key: 'ttsLatencyMs', label: 'analytics.ttsLatency', icon: 'el-icon-headset', tone: 'success' },
];

export default {
  name: 'HomePage',
  components: { DeviceItem, AddWisdomBodyDialog, HeaderBar, VersionFooter, ChatHistoryDialog, CustomButton },
  data() {
    return {
      addDeviceDialogVisible: false,
      devices: [],
      originalDevices: [],
      isSearching: false,
      searchRegex: null,
      isLoading: true,
      skeletonCount: localStorage.getItem('skeletonCount') || 6,
      showChatHistory: false,
      currentAgentId: '',
      currentAgentName: '',
      // Feature status
      featureStatus: {
        voiceprintRecognition: false,
        voiceClone: false,
        knowledgeBase: false
      },
      search: "",
      showHistory: false,
      searchHistory: [],
      SEARCH_HISTORY_KEY: 'agent_search_history',
      MAX_HISTORY_COUNT: 5,
      deleteAgentDialogVisible: false,
      deleteTargetAgentId: '',
      deleteTargetAgentName: '',
      deleteAgentConfirmText: '',
      isDeletingAgent: false,
      // Analytics & Telemetry state
      statsSummary: {
        totalQueries: 0,
        todayQueries: 0,
        totalTokens: 0,
        activeDevices: 0,
        avgLatencyMs: 780,
        asrLatencyMs: 210,
        llmLatencyMs: 390,
        ttsLatencyMs: 180,
        topDevices: [],
        topAgents: []
      },
      dailyUsage: {
        dates: [],
        queryCounts: [],
        tokenCounts: []
      },
      kpis: KPIS,
      latencyBars: LATENCY_BARS,
      chartInstance: null,
      resizeHandler: null,
      themeChangeHandler: null,
    }
  },

  computed: {
    ...mapState({
      userInfo: (state) => state.userInfo,
    }),
    isDeleteAgentNameMatched() {
      return !!this.deleteTargetAgentName && this.deleteAgentConfirmText === this.deleteTargetAgentName;
    },
    // Number of skeleton cards while loading (3–9)
    skeletonItems() {
      const count = Number(this.skeletonCount) || 3;
      return Math.min(Math.max(count, 3), 9);
    },
  },

  async mounted() {
    this.fetchAgentList();
    await this.loadFeatureStatus();
    // Load search history from localStorage
    this.loadSearchHistory();
    // Load analytics & live telemetry
    this.fetchStats();
    this.initTelemetryListeners();
  },

  beforeDestroy() {
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
    }
    if (this.themeChangeHandler) {
      window.removeEventListener('app-theme-changed', this.themeChangeHandler);
    }
    if (this.chartInstance) {
      this.chartInstance.dispose();
      this.chartInstance = null;
    }
  },

  methods: {
    // Translate with an English fallback for strings still pending in src/i18n/_pending
    tt(key, fallback) {
      return this.$te(key) ? this.$t(key) : fallback;
    },

    // Load feature status
    async loadFeatureStatus() {
      await featureManager.waitForInitialization();
      const config = featureManager.getConfig();
      this.featureStatus = {
        voiceprintRecognition: config.voiceprintRecognition,
        voiceClone: config.voiceClone,
        knowledgeBase: config.knowledgeBase
      };
    },

    showAddDialog() {
      this.addDeviceDialogVisible = true
    },
    goToRoleConfig() {
      // Navigate to role configuration page after clicking configure
      this.$router.push('/role-config')
    },
    handleWisdomBodyAdded(res) {
      this.fetchAgentList();
      this.addDeviceDialogVisible = false;
    },
    handleDeviceManage() {
      this.$router.push('/device-management');
    },
    handleSearchReset() {
      this.isSearching = false;
      // Assign original device list to display list directly to avoid reloading
      this.devices = [...this.originalDevices];
    },
    // Empty-state action: clear the query and show every agent again
    clearSearch() {
      this.search = '';
      this.handleSearchReset();
    },

    // Search and update agent list
    handleSearchResult(filteredList) {
      this.devices = filteredList; // Update device list
    },
    // Get agent list
    fetchAgentList() {
      this.isLoading = true;
      Api.agent.getAgentList(({ data }) => {
        if (data?.data) {
          this.originalDevices = data.data.map(item => ({
            ...item,
            agentId: item.id
          }));

          // Dynamically set skeleton screen count (optional)
          this.skeletonCount = Math.min(
            Math.max(this.originalDevices.length, 3), // At least 3
            10 // At most 10
          );

          this.handleSearchReset();
        }
        this.isLoading = false;
      }, (error) => {
        console.error('Failed to fetch agent list:', error);
        this.isLoading = false;
      });
    },
    // Delete agent
    handleDeleteAgent(device) {
      const targetAgent = typeof device === 'object'
        ? device
        : this.devices.find((item) => item.agentId === device || item.id === device);
      const agentId = targetAgent?.agentId || targetAgent?.id;
      const agentName = targetAgent?.agentName || '';

      if (!agentId || !agentName) {
        this.$message.error(this.$t('home.deleteAgentMissingInfo'));
        return;
      }

      this.deleteTargetAgentId = agentId;
      this.deleteTargetAgentName = agentName;
      this.deleteAgentConfirmText = '';
      this.deleteAgentDialogVisible = true;
      this.$nextTick(() => {
        if (this.$refs.deleteAgentConfirmInput) {
          this.$refs.deleteAgentConfirmInput.focus();
        }
      });
    },
    handleDeleteAgentPaste() {
      this.$message.warning(this.$t('home.deleteAgentPasteForbidden'));
    },
    closeDeleteAgentDialog() {
      if (this.isDeletingAgent) return;
      this.deleteAgentDialogVisible = false;
    },
    resetDeleteAgentDialog() {
      this.deleteTargetAgentId = '';
      this.deleteTargetAgentName = '';
      this.deleteAgentConfirmText = '';
      this.isDeletingAgent = false;
    },
    confirmDeleteAgent() {
      if (!this.isDeleteAgentNameMatched || this.isDeletingAgent) return;

      this.isDeletingAgent = true;
      Api.agent.deleteAgent(this.deleteTargetAgentId, (res) => {
        this.isDeletingAgent = false;
        if (res.data.code === 0) {
          this.$message.success({
            message: this.$t('home.deleteSuccess'),
            showClose: true
          });
          this.deleteAgentDialogVisible = false;
          this.fetchAgentList(); // Refresh list
        } else {
          this.$message.error({
            message: res.data.msg || this.$t('home.deleteFailed'),
            showClose: true
          });
        }
      });
    },
    handleShowChatHistory({ agentId, agentName }) {
      this.currentAgentId = agentId;
      this.currentAgentName = agentName;
      this.showChatHistory = true;
    },
    // Handle search
    handleSearch() {
      const searchValue = this.search.trim();

      // If search query is empty, trigger reset event
      if (!searchValue) {
        this.handleSearchReset();
        return;
      }

      // Save search history
      this.saveSearchHistory(searchValue);

      // Blur input after search to hide search history
      if (this.$refs.searchInput) {
        this.$refs.searchInput.blur();
      }

      this.isSearching = true;
      this.isLoading = true;
      // Detect MAC address format: contains 4 colons
      const isMac = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.test(searchValue)
      const searchType = isMac ? 'mac' : 'name';
      Api.agent.searchAgent(searchValue, searchType, ({ data }) => {
        if (data?.data) {
          this.devices = data.data.map(item => ({
            ...item,
            agentId: item.id
          }));
        }
        this.isLoading = false;
      }, (error) => {
        console.error('Failed to search agents:', error);
        this.isLoading = false;
        this.$message.error(this.$t('message.searchFailed'));
      });
    },

    // Show search history
    showSearchHistory() {
      this.showHistory = true;
    },

    // Hide search history
    hideSearchHistory() {
      // Delay hiding so click events can execute
      setTimeout(() => {
        this.showHistory = false;
      }, 200);
    },

    // Load search history
    loadSearchHistory() {
      try {
        const history = localStorage.getItem(this.SEARCH_HISTORY_KEY);
        if (history) {
          this.searchHistory = JSON.parse(history);
        }
      } catch (error) {
        console.error("Failed to load search history:", error);
        this.searchHistory = [];
      }
    },

    // Save search history
    saveSearchHistory(keyword) {
      if (!keyword || this.searchHistory.includes(keyword)) {
        return;
      }

      // Add to start of history
      this.searchHistory.unshift(keyword);

      // Limit history record count
      if (this.searchHistory.length > this.MAX_HISTORY_COUNT) {
        this.searchHistory = this.searchHistory.slice(0, this.MAX_HISTORY_COUNT);
      }

      // Save to localStorage
      try {
        localStorage.setItem(this.SEARCH_HISTORY_KEY, JSON.stringify(this.searchHistory));
      } catch (error) {
        console.error("Failed to save search history:", error);
      }
    },

    // Select search history item
    selectSearchHistory(keyword) {
      this.search = keyword;
      this.handleSearch();
    },

    // Remove single search history item
    removeSearchHistory(index) {
      this.searchHistory.splice(index, 1);
      try {
        localStorage.setItem(this.SEARCH_HISTORY_KEY, JSON.stringify(this.searchHistory));
      } catch (error) {
        console.error("Failed to update search history:", error);
      }
    },

    // Clear all search history
    clearSearchHistory() {
      this.searchHistory = [];
      try {
        localStorage.removeItem(this.SEARCH_HISTORY_KEY);
      } catch (error) {
        console.error("Failed to clear search history:", error);
      }
    },

    formatNumber(val) {
      if (val === undefined || val === null) return '0';
      return Number(val).toLocaleString();
    },

    calcLatencyPct(val) {
      const total = (this.statsSummary.asrLatencyMs || 0) + (this.statsSummary.llmLatencyMs || 0) + (this.statsSummary.ttsLatencyMs || 0);
      if (!total) return 0;
      return Math.min(100, Math.round(((val || 0) / total) * 100));
    },

    fetchStats() {
      Api.stats.getSummary((res) => {
        if (res?.data?.code === 0 && res.data.data) {
          this.statsSummary = {
            ...this.statsSummary,
            ...res.data.data
          };
        }
      });

      Api.stats.getDailyUsage((res) => {
        if (res?.data?.code === 0 && res.data.data) {
          this.dailyUsage = res.data.data;
        }
        // Render either the data or an empty week so the card never stays blank
        this.$nextTick(() => {
          this.renderChart();
        });
      });
    },

    initTelemetryListeners() {
      this.resizeHandler = () => {
        if (this.chartInstance) {
          this.chartInstance.resize();
        }
      };
      window.addEventListener('resize', this.resizeHandler);

      this.themeChangeHandler = () => {
        if (this.chartInstance) {
          this.renderChart();
        }
      };
      window.addEventListener('app-theme-changed', this.themeChangeHandler);
    },

    // Chart colours come from the Nobix tokens, so light/dark follow the theme automatically
    readTokens() {
      const css = getComputedStyle(document.documentElement);
      const token = (name) => css.getPropertyValue(name).trim();
      return {
        accent: token('--nx-accent'),
        info: token('--nx-info'),
        text: token('--nx-text'),
        text2: token('--nx-text-2'),
        text3: token('--nx-text-3'),
        border: token('--nx-border'),
        borderStrong: token('--nx-border-strong'),
        surface: token('--nx-surface'),
        font: token('--nx-font'),
        caption: parseFloat(token('--nx-text-caption')) || 12,
        footnote: parseFloat(token('--nx-text-footnote')) || 13,
      };
    },

    renderChart() {
      const container = this.$refs.usageChart;
      if (!container) return;

      if (!this.chartInstance) {
        this.chartInstance = echarts.init(container);
      }

      const c = this.readTokens();

      const dates = (this.dailyUsage && this.dailyUsage.dates && this.dailyUsage.dates.length > 0)
        ? this.dailyUsage.dates
        : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

      const queries = (this.dailyUsage && this.dailyUsage.queryCounts && this.dailyUsage.queryCounts.length > 0)
        ? this.dailyUsage.queryCounts
        : [0, 0, 0, 0, 0, 0, 0];

      const tokens = (this.dailyUsage && this.dailyUsage.tokenCounts && this.dailyUsage.tokenCounts.length > 0)
        ? this.dailyUsage.tokenCounts
        : [0, 0, 0, 0, 0, 0, 0];

      const axisLabel = { color: c.text3, fontFamily: c.font, fontSize: c.caption };

      const option = {
        textStyle: { fontFamily: c.font },
        tooltip: {
          trigger: 'axis',
          backgroundColor: c.surface,
          borderColor: c.border,
          borderWidth: 1,
          padding: [8, 12],
          textStyle: { color: c.text, fontFamily: c.font, fontSize: c.footnote },
          axisPointer: {
            type: 'line',
            lineStyle: { color: c.borderStrong }
          }
        },
        legend: {
          data: [this.$t('analytics.queries'), this.$t('analytics.tokens')],
          textStyle: { color: c.text2, fontFamily: c.font },
          icon: 'roundRect',
          itemWidth: 10,
          itemHeight: 10,
          top: 0,
          right: 0
        },
        grid: {
          top: 40,
          left: 4,
          right: 4,
          bottom: 4,
          containLabel: true
        },
        xAxis: [
          {
            type: 'category',
            data: dates,
            axisLine: { lineStyle: { color: c.border } },
            axisTick: { show: false },
            axisLabel
          }
        ],
        yAxis: [
          {
            type: 'value',
            name: this.$t('analytics.queries'),
            nameTextStyle: { color: c.text3, fontFamily: c.font },
            splitLine: { lineStyle: { color: c.border } },
            axisLabel
          },
          {
            type: 'value',
            name: this.$t('analytics.tokens'),
            nameTextStyle: { color: c.text3, fontFamily: c.font },
            splitLine: { show: false },
            axisLabel
          }
        ],
        series: [
          {
            name: this.$t('analytics.queries'),
            type: 'bar',
            barMaxWidth: 20,
            itemStyle: {
              borderRadius: [6, 6, 0, 0],
              color: c.accent
            },
            data: queries
          },
          {
            name: this.$t('analytics.tokens'),
            type: 'line',
            yAxisIndex: 1,
            smooth: true,
            symbol: 'circle',
            symbolSize: 6,
            itemStyle: { color: c.info },
            lineStyle: { width: 2, color: c.info },
            areaStyle: { color: c.info, opacity: 0.08 },
            data: tokens
          }
        ]
      };

      this.chartInstance.setOption(option, true);
    },
  }
}
</script>

<style lang="scss" scoped>
.nx-home {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--nx-bg);

  > .nx-page {
    flex: 1 0 auto;
  }
}

// ------------------------------------------------------------------ header actions + search

.home-actions {
  flex-wrap: nowrap;
}

.home-search {
  position: relative;
  width: 300px;

  &__icon {
    cursor: pointer;
    &:hover {
      color: var(--nx-text);
    }
  }
}

.home-history {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 20;
  padding: 6px;
  background: var(--nx-surface);
  border: 1px solid var(--nx-border);
  border-radius: var(--nx-radius);
  box-shadow: var(--nx-shadow-2);
  transform-origin: top center;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 8px 6px;
    font-size: var(--nx-text-caption);
    font-weight: 500;
    color: var(--nx-text-3);
  }
  &__clear {
    padding: 2px 4px;
    border: 0;
    border-radius: var(--nx-radius-sm);
    background: transparent;
    color: var(--nx-accent);
    font: inherit;
    font-size: var(--nx-text-caption);
    cursor: pointer;
    &:hover {
      background: var(--nx-accent-soft);
    }
  }
  &__item {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 36px;
    padding: 0 4px 0 10px;
    border-radius: var(--nx-radius-sm);
    font-size: var(--nx-text-callout);
    color: var(--nx-text);
    cursor: pointer;

    > i {
      flex: none;
      color: var(--nx-text-3);
    }
    > .nx-truncate {
      flex: 1 1 auto;
    }
    &:hover {
      background: var(--nx-surface-2);
    }
    &:hover .home-history__remove {
      opacity: 1;
    }
  }
  &__remove {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: 0;
    border-radius: var(--nx-radius-sm);
    background: transparent;
    color: var(--nx-text-3);
    cursor: pointer;
    opacity: 0;
    transition: opacity var(--nx-dur-1) var(--nx-ease);

    &:focus-visible {
      opacity: 1;
    }
    &:hover {
      background: var(--nx-danger-soft);
      color: var(--nx-danger);
    }
  }
}

// ------------------------------------------------------------------ skeleton

.home-skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--nx-space-4);
  min-height: 252px;

  &__head {
    display: flex;
    align-items: center;
    gap: var(--nx-space-3);
  }
  &__avatar {
    flex: none;
    width: 44px;
    height: 44px;
    border-radius: var(--nx-radius);
  }
  &__lines {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--nx-space-2);
  }
  &__block {
    height: 64px;
    border-radius: var(--nx-radius);
  }
  &__foot {
    display: flex;
    gap: var(--nx-space-2);
    margin-top: auto;
    padding-top: var(--nx-space-4);
    border-top: 1px solid var(--nx-border);
  }
  &__btn {
    width: 92px;
    height: var(--nx-control-h-sm);
  }
}

// ------------------------------------------------------------------ activity

.home-kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--nx-space-4);
  margin-bottom: var(--nx-space-5);
}

.home-kpi {
  display: flex;
  align-items: center;
  gap: var(--nx-space-4);
  padding: var(--nx-space-4) var(--nx-space-5);

  .nx-stat {
    flex: 1 1 auto;
  }
}

.home-analytics {
  display: grid;
  grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
  gap: var(--nx-space-5);
  align-items: stretch;
}

.home-card-title {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.home-chart {
  width: 100%;
  height: 260px;
}

.home-telemetry {
  display: flex;
  flex-direction: column;
}

.home-latency {
  display: flex;
  flex-direction: column;
  gap: var(--nx-space-3);

  &__row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--nx-space-3);
    margin-bottom: 6px;
    font-size: var(--nx-text-footnote);
  }
  &__name {
    color: var(--nx-text-2);
    i {
      margin-right: 6px;
      color: var(--nx-text-3);
    }
  }
  &__val {
    flex: none;
    font-weight: 600;
    color: var(--nx-text);
  }
  &__track {
    height: 6px;
    border-radius: var(--nx-radius-pill);
    background: var(--nx-surface-2);
    overflow: hidden;
  }
  &__fill {
    display: block;
    height: 100%;
    border-radius: inherit;
    transform-origin: left center;
    transition: transform var(--nx-dur-3) var(--nx-ease);

    &--accent {
      background: var(--nx-accent);
    }
    &--info {
      background: var(--nx-info);
    }
    &--success {
      background: var(--nx-success);
    }
  }
}

.home-leaders {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--nx-space-5);
  margin-top: var(--nx-space-5);
  padding-top: var(--nx-space-4);
  border-top: 1px solid var(--nx-border);

  &__title {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: var(--nx-space-2);
    font-size: var(--nx-text-caption);
    font-weight: 500;
    letter-spacing: 0.01em;
    color: var(--nx-text-3);
  }
  &__list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  &__item {
    display: flex;
    align-items: center;
    gap: var(--nx-space-2);
    min-width: 0;
    font-size: var(--nx-text-footnote);
  }
  &__rank {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--nx-surface-2);
    color: var(--nx-text-2);
    font-size: var(--nx-text-caption);
    font-weight: 600;

    &.is-first {
      background: var(--nx-accent-soft);
      color: var(--nx-accent);
    }
  }
  &__name {
    flex: 1 1 auto;
    color: var(--nx-text);
  }
  &__count {
    flex: none;
    font-weight: 600;
    color: var(--nx-text-2);
  }
  &__empty {
    margin: 0;
    padding: 4px 0;
    font-size: var(--nx-text-footnote);
    color: var(--nx-text-3);
  }
}

// ------------------------------------------------------------------ delete dialog

.delete-agent-title {
  padding-right: 32px;
  font-size: var(--nx-text-headline);
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--nx-text);
}

.delete-agent-content {
  display: flex;
  gap: var(--nx-space-4);
  align-items: flex-start;
}

.delete-agent-icon {
  background: var(--nx-danger-soft);
  color: var(--nx-danger);
}

.delete-agent-message {
  flex: 1;
  min-width: 0;
  font-size: var(--nx-text-callout);
  line-height: 1.5;
  color: var(--nx-text-2);
}

.delete-agent-target {
  margin-top: var(--nx-space-3);
  padding: 10px 12px;
  border-radius: var(--nx-radius);
  background: var(--nx-surface-2);
  color: var(--nx-text);
  font-weight: 600;
  overflow-wrap: anywhere;
}

.delete-agent-copy-guard {
  user-select: none;
  -webkit-user-select: none;
}

.delete-agent-input {
  margin-top: var(--nx-space-3);
}

.delete-agent-helper {
  margin-top: 6px;
  font-size: var(--nx-text-caption);
  color: var(--nx-danger);
}

.delete-agent-footer {
  display: inline-flex;
  gap: var(--nx-space-2);
}

// ------------------------------------------------------------------ responsive

@media (max-width: 1100px) {
  .home-analytics {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 720px) {
  .home-actions {
    width: 100%;
    flex-wrap: wrap;
  }
  .home-search {
    flex: 1 1 200px;
    width: auto;
  }
}

@media (max-width: 480px) {
  .home-leaders {
    grid-template-columns: minmax(0, 1fr);
  }
  .home-chart {
    height: 220px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .home-latency__fill {
    transition: none;
  }
}
</style>

<style lang="scss">
// The single-column grid would overflow a 360px phone: let cards shrink below 320px there
@media (max-width: 400px) {
  .nx-home .nx-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
