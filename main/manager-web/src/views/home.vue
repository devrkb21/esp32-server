<template>
  <div class="welcome">
    <!-- Header -->
    <HeaderBar :devices="devices" />
    <el-main style="padding: 20px;display: flex;flex-direction: column;">
      <div>
        <!-- Home Content -->
        <div class="add-device">
          <div class="add-device-bg">
            <div class="hellow-text" style="padding-top: 30px;">
              {{ $t('home.greeting') }}
            </div>
            <div class="hellow-text">
              {{ $t('home.wish') }}
            </div>
            <div class="hi-hint">
              let's have a wonderful day!
            </div>
            <div class="add-device-options">
            <div class="search-container">
              <div class="search-wrapper">
                  <el-input
                    v-model="search"
                    :placeholder="$t('header.searchPlaceholder')"
                    class="custom-search-input"
                    @keyup.enter.native="handleSearch"
                    @clear="handleSearchReset"
                    clearable
                    ref="searchInput"
                    @focus="showSearchHistory"
                    @blur="hideSearchHistory"
                  >
                    <i slot="suffix" class="el-icon-search search-icon" @click="handleSearch"></i>
                  </el-input>
                  <!-- Search History Dropdown -->
                  <div v-if="showHistory && searchHistory.length > 0" class="search-history-dropdown">
                    <div class="search-history-header">
                      <span>{{ $t("header.searchHistory") }}</span>
                      <el-button type="text" size="small" class="clear-history-btn" @click="clearSearchHistory">
                        {{ $t("header.clearHistory") }}
                      </el-button>
                    </div>
                    <div class="search-history-list">
                      <div v-for="(item, index) in searchHistory" :key="index" class="search-history-item"
                        @click.stop="selectSearchHistory(item)">
                        <span class="history-text">{{ item }}</span>
                        <i class="el-icon-close clear-item-icon" @click.stop="removeSearchHistory(index)"></i>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <el-button icon="el-icon-plus" class="add-device-btn" @click="showAddDialog">{{ $t('home.addAgent') }}</el-button>
            </div>
          </div>
        </div>

        <!-- Analytics & Live Telemetry Section -->
        <div class="analytics-dashboard">
          <!-- KPI Summary Cards -->
          <div class="kpi-grid">
            <div class="kpi-card">
              <div class="kpi-icon-wrapper kpi-blue">
                <i class="el-icon-chat-dot-round"></i>
              </div>
              <div class="kpi-info">
                <div class="kpi-label">{{ $t('analytics.totalQueries') }}</div>
                <div class="kpi-num">{{ formatNumber(statsSummary.totalQueries) }}</div>
              </div>
            </div>
            <div class="kpi-card">
              <div class="kpi-icon-wrapper kpi-green">
                <i class="el-icon-data-line"></i>
              </div>
              <div class="kpi-info">
                <div class="kpi-label">{{ $t('analytics.todayQueries') }}</div>
                <div class="kpi-num">{{ formatNumber(statsSummary.todayQueries) }}</div>
              </div>
            </div>
            <div class="kpi-card">
              <div class="kpi-icon-wrapper kpi-purple">
                <i class="el-icon-cpu"></i>
              </div>
              <div class="kpi-info">
                <div class="kpi-label">{{ $t('analytics.activeDevices') }}</div>
                <div class="kpi-num">{{ formatNumber(statsSummary.activeDevices) }}</div>
              </div>
            </div>
            <div class="kpi-card">
              <div class="kpi-icon-wrapper kpi-orange">
                <i class="el-icon-coin"></i>
              </div>
              <div class="kpi-info">
                <div class="kpi-label">{{ $t('analytics.totalTokens') }}</div>
                <div class="kpi-num">{{ formatNumber(statsSummary.totalTokens) }}</div>
              </div>
            </div>
          </div>

          <!-- Charts and Telemetry Row -->
          <div class="analytics-row">
            <!-- Query Volume & Token Usage Chart -->
            <div class="chart-panel trend-panel">
              <div class="panel-header">
                <span class="panel-title">
                  <i class="el-icon-data-analysis title-icon"></i>
                  {{ $t('analytics.queryVolume') }}
                </span>
                <span class="panel-sub">{{ $t('analytics.tokenUsage') }}</span>
              </div>
              <div ref="usageChart" class="chart-container"></div>
            </div>

            <!-- Latency & Top Ranks Panel -->
            <div class="chart-panel telemetry-panel">
              <div class="panel-header">
                <span class="panel-title">
                  <i class="el-icon-odometer title-icon"></i>
                  {{ $t('analytics.latencyBreakdown') }}
                </span>
                <span class="latency-badge">{{ statsSummary.avgLatencyMs }} ms</span>
              </div>

              <!-- Latency Progress Breakdown -->
              <div class="latency-bars">
                <div class="latency-item">
                  <div class="latency-header">
                    <span class="latency-name"><i class="el-icon-microphone"></i> {{ $t('analytics.asrLatency') }}</span>
                    <span class="latency-val">{{ statsSummary.asrLatencyMs }} ms</span>
                  </div>
                  <el-progress :percentage="calcLatencyPct(statsSummary.asrLatencyMs)" :color="'#3b82f6'" :show-text="false" :stroke-width="8"></el-progress>
                </div>
                <div class="latency-item">
                  <div class="latency-header">
                    <span class="latency-name"><i class="el-icon-magic-stick"></i> {{ $t('analytics.llmLatency') }}</span>
                    <span class="latency-val">{{ statsSummary.llmLatencyMs }} ms</span>
                  </div>
                  <el-progress :percentage="calcLatencyPct(statsSummary.llmLatencyMs)" :color="'#10b981'" :show-text="false" :stroke-width="8"></el-progress>
                </div>
                <div class="latency-item">
                  <div class="latency-header">
                    <span class="latency-name"><i class="el-icon-headset"></i> {{ $t('analytics.ttsLatency') }}</span>
                    <span class="latency-val">{{ statsSummary.ttsLatencyMs }} ms</span>
                  </div>
                  <el-progress :percentage="calcLatencyPct(statsSummary.ttsLatencyMs)" :color="'#f59e0b'" :show-text="false" :stroke-width="8"></el-progress>
                </div>
              </div>

              <!-- Top Active Devices & Agents -->
              <div class="leaderboard-row">
                <div class="leaderboard-col">
                  <div class="lb-title"><i class="el-icon-mobile"></i> {{ $t('analytics.topDevices') }}</div>
                  <div v-if="statsSummary.topDevices && statsSummary.topDevices.length > 0" class="lb-list">
                    <div v-for="(dev, idx) in statsSummary.topDevices.slice(0, 3)" :key="idx" class="lb-item">
                      <span class="lb-rank" :class="'rank-' + (idx + 1)">{{ idx + 1 }}</span>
                      <span class="lb-name" :title="dev.deviceName || dev.macAddress">{{ dev.deviceName || dev.macAddress }}</span>
                      <span class="lb-count">{{ dev.queryCount }}</span>
                    </div>
                  </div>
                  <div v-else class="lb-empty">{{ $t('analytics.noData') }}</div>
                </div>

                <div class="leaderboard-col">
                  <div class="lb-title"><i class="el-icon-user"></i> {{ $t('analytics.topAgents') }}</div>
                  <div v-if="statsSummary.topAgents && statsSummary.topAgents.length > 0" class="lb-list">
                    <div v-for="(ag, idx) in statsSummary.topAgents.slice(0, 3)" :key="idx" class="lb-item">
                      <span class="lb-rank" :class="'rank-' + (idx + 1)">{{ idx + 1 }}</span>
                      <span class="lb-name" :title="ag.agentName">{{ ag.agentName }}</span>
                      <span class="lb-count">{{ ag.queryCount }}</span>
                    </div>
                  </div>
                  <div v-else class="lb-empty">{{ $t('analytics.noData') }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="device-list-container">
          <template v-if="isLoading">
            <div v-for="i in skeletonCount" :key="'skeleton-' + i" class="skeleton-item">
              <div class="skeleton-image"></div>
              <div class="skeleton-content">
                <div class="skeleton-line"></div>
                <div class="skeleton-line-short"></div>
              </div>
            </div>
          </template>

          <template v-else>
            <DeviceItem v-for="(item, index) in devices" :key="index" :device="item" :feature-status="featureStatus" 
              @configure="goToRoleConfig" @deviceManage="handleDeviceManage" @delete="handleDeleteAgent" 
              @chat-history="handleShowChatHistory" />
          </template>
        </div>
      </div>
      <AddWisdomBodyDialog :visible.sync="addDeviceDialogVisible" @confirm="handleWisdomBodyAdded" />
      <el-dialog
        :visible.sync="deleteAgentDialogVisible"
        :close-on-click-modal="!isDeletingAgent"
        :close-on-press-escape="!isDeletingAgent"
        :show-close="!isDeletingAgent"
        width="520px"
        append-to-body
        class="delete-agent-dialog"
        @closed="resetDeleteAgentDialog"
      >
        <template slot="title">
          <div class="delete-agent-title">
            <img src="@/assets/knowledge-base/level.png" class="delete-agent-title-icon" />
            <span>{{ $t('home.deleteConfirmTitle') }}</span>
          </div>
        </template>
        <div class="delete-agent-content">
          <i class="el-icon-warning-outline delete-agent-warning"></i>
          <div class="delete-agent-message">
            <div class="delete-agent-copy-guard" @copy.prevent @cut.prevent @contextmenu.prevent>
              {{ $t('home.confirmDeleteAgent', { agentName: deleteTargetAgentName }) }}
            </div>
            <div class="delete-agent-target delete-agent-copy-guard" @copy.prevent @cut.prevent @contextmenu.prevent>
              {{ deleteTargetAgentName }}
            </div>
            <el-input
              ref="deleteAgentConfirmInput"
              v-model="deleteAgentConfirmText"
              class="delete-agent-input"
              :placeholder="$t('home.deleteAgentNamePlaceholder')"
              clearable
              @paste.native.prevent="handleDeleteAgentPaste"
              @drop.native.prevent="handleDeleteAgentPaste"
              @contextmenu.native.prevent
              @keyup.enter.native="confirmDeleteAgent"
            />
            <div v-if="deleteAgentConfirmText && !isDeleteAgentNameMatched" class="delete-agent-helper">
              {{ $t('home.deleteAgentNameMismatch') }}
            </div>
          </div>
        </div>
        <span slot="footer" class="delete-agent-footer">
          <el-button class="delete-agent-cancel" :disabled="isDeletingAgent" @click="closeDeleteAgentDialog">{{ $t('button.cancel') }}</el-button>
          <el-button
            class="delete-agent-confirm"
            type="primary"
            :loading="isDeletingAgent"
            :disabled="!isDeleteAgentNameMatched"
            @click="confirmDeleteAgent"
          >
            {{ $t('button.ok') }}
          </el-button>
        </span>
      </el-dialog>
    </el-main>
    <el-footer>
      <version-footer />
    </el-footer>
    <chat-history-dialog :visible.sync="showChatHistory" :agent-id="currentAgentId" :agent-name="currentAgentName" />
  </div>

</template>

<script>
import Api from '@/apis/api';
import * as echarts from 'echarts';
import { mapState } from "vuex";
import AddWisdomBodyDialog from '@/components/AddWisdomBodyDialog.vue';
import ChatHistoryDialog from '@/components/ChatHistoryDialog.vue';
import DeviceItem from '@/components/DeviceItem.vue';
import HeaderBar from '@/components/HeaderBar.vue';
import VersionFooter from '@/components/VersionFooter.vue';
import featureManager from '@/utils/featureManager';

export default {
  name: 'HomePage',
  components: { DeviceItem, AddWisdomBodyDialog, HeaderBar, VersionFooter, ChatHistoryDialog },
  data() {
    return {
      addDeviceDialogVisible: false,
      devices: [],
      originalDevices: [],
      isSearching: false,
      searchRegex: null,
      isLoading: true,
      skeletonCount: localStorage.getItem('skeletonCount') || 8,
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
          this.$nextTick(() => {
            this.renderChart();
          });
        }
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

    renderChart() {
      const container = this.$refs.usageChart;
      if (!container) return;

      if (!this.chartInstance) {
        this.chartInstance = echarts.init(container);
      }

      const isDark = document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');
      const textColor = isDark ? '#94a3b8' : '#64748b';
      const splitLineColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';

      const dates = (this.dailyUsage && this.dailyUsage.dates && this.dailyUsage.dates.length > 0)
        ? this.dailyUsage.dates
        : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

      const queries = (this.dailyUsage && this.dailyUsage.queryCounts && this.dailyUsage.queryCounts.length > 0)
        ? this.dailyUsage.queryCounts
        : [0, 0, 0, 0, 0, 0, 0];

      const tokens = (this.dailyUsage && this.dailyUsage.tokenCounts && this.dailyUsage.tokenCounts.length > 0)
        ? this.dailyUsage.tokenCounts
        : [0, 0, 0, 0, 0, 0, 0];

      const option = {
        tooltip: {
          trigger: 'axis',
          backgroundColor: isDark ? '#1e293b' : '#ffffff',
          borderColor: isDark ? '#334155' : '#e2e8f0',
          textStyle: {
            color: isDark ? '#f1f5f9' : '#1e293b'
          },
          axisPointer: {
            type: 'cross',
            crossStyle: { color: '#94a3b8' }
          }
        },
        legend: {
          data: [this.$t('analytics.queries'), this.$t('analytics.tokens')],
          textStyle: { color: textColor },
          top: 0,
          right: 16
        },
        grid: {
          top: 36,
          left: '3%',
          right: '4%',
          bottom: '3%',
          containLabel: true
        },
        xAxis: [
          {
            type: 'category',
            data: dates,
            axisLine: { lineStyle: { color: splitLineColor } },
            axisLabel: { color: textColor }
          }
        ],
        yAxis: [
          {
            type: 'value',
            name: this.$t('analytics.queries'),
            nameTextStyle: { color: textColor },
            splitLine: { lineStyle: { color: splitLineColor } },
            axisLabel: { color: textColor }
          },
          {
            type: 'value',
            name: this.$t('analytics.tokens'),
            nameTextStyle: { color: textColor },
            splitLine: { show: false },
            axisLabel: { color: textColor }
          }
        ],
        series: [
          {
            name: this.$t('analytics.queries'),
            type: 'bar',
            barMaxWidth: 22,
            itemStyle: {
              borderRadius: [4, 4, 0, 0],
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: '#6366f1' },
                { offset: 1, color: '#4338ca' }
              ])
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
            itemStyle: { color: '#10b981' },
            lineStyle: { width: 3, color: '#10b981' },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: 'rgba(16, 185, 129, 0.35)' },
                { offset: 1, color: 'rgba(16, 185, 129, 0.02)' }
              ])
            },
            data: tokens
          }
        ]
      };

      this.chartInstance.setOption(option, true);
    },
  }
}
</script>

<style scoped>
.welcome {
  min-width: 900px;
  min-height: 506px;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #eff4ff;
  background-size: cover;
  /* Ensure background image covers entire element */
  background-position: center;
  /* Align from top center */
  -webkit-background-size: cover;
  /* Compatible with older WebKit browsers */
  -o-background-size: cover;
  /* Compatible with older Opera browsers */
}

.add-device {
  height: 195px;
  border-radius: 15px;
  position: relative;
  background: linear-gradient(269.62deg,
      #e0e6fd 0%,
      #cce7ff 49.69%,
      #d3d3fe 100%);
}

.add-device-bg {
  width: 100%;
  height: 100%;
  text-align: left;
  background-image: url("@/assets/home/main-top-bg.png");
  background-size: cover;
  /* Ensure background image covers entire element */
  background-position: center;
  /* Align from top center */
  -webkit-background-size: cover;
  /* Compatible with older WebKit browsers */
  -o-background-size: cover;
  box-sizing: border-box;

  /* Compatible with older Opera browsers */
  .hellow-text {
    margin-left: 75px;
    color: #3d4566;
    font-size: 33px;
    font-weight: 700;
    letter-spacing: 0;
  }

  .hi-hint {
    font-weight: 400;
    font-size: 12px;
    text-align: left;
    color: #818cae;
    margin-left: 75px;
    margin-top: 5px;
  }
}
.add-device-options {
  display: flex;
  margin-top: 16px;
  margin-left: 75px;
  align-items: center;
}

.add-device-btn {
  color: #fff;
  margin-left: 10px;
  background: #3375fd;
  border-radius: 20px;
}

.search-container {
  width: 360px;
  margin-right: 5px;
}

.search-wrapper {
  position: relative;
}

.custom-search-input {
  &::v-deep .el-input__inner {
    border-radius: 20px;
    border: 1px solid transparent;
    box-shadow: 0 2px 2px 0 #cfe1fb;
  }
  &::v-deep .el-input__suffix {
    right: 10px;
  }
  &::v-deep .el-input__suffix-inner {
    display: flex;
    align-items: center;
    height: 100%;
    cursor: pointer;
  }
  .search-icon {
    font-size: 14px;
  }
}

.search-wrapper {
  position: relative;
}

.search-history-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #e4e6ef;
  border-radius: 4px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  z-index: 1000;
  margin-top: 2px;
}

.search-history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid #f0f0f0;
  font-size: 12px;
  color: #909399;
}

.clear-history-btn {
  color: #909399;
  font-size: 11px;
  padding: 0;
  height: auto;
}

.clear-history-btn:hover {
  color: #606266;
}

.search-history-list {
  max-height: 200px;
  overflow-y: auto;
}

.search-history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 12px;
  color: #606266;
}

.search-history-item:hover {
  background-color: #f5f7fa;
}

.search-wrapper {
  position: relative;
}

.search-history-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #e4e6ef;
  border-radius: 10px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  z-index: 1000;
  margin-top: 6px;
}

.clear-history-btn {
  color: #909399;
  font-size: 12px;
  padding: 0;
  height: auto;
}

.clear-history-btn:hover {
  color: #606266;
}

.search-history-list {
  max-height: 200px;
  overflow-y: auto;
}

.search-history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 12px;
  color: #606266;
}

.search-history-item:hover {
  background-color: #f5f7fa;
}

.search-history-item:hover .clear-item-icon {
  visibility: visible;
}

.clear-item-icon:hover {
  color: #ff4949;
}

.clear-item-icon {
  font-size: 10px;
  color: #909399;
  visibility: hidden;
}

.device-list-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 30px;
  padding: 30px 0;
}

/* In DeviceItem.vue styles */
.device-item {
  margin: 0 !important;
  /* Avoid conflict */
  width: auto !important;
}

.footer {
  font-size: 12px;
  font-weight: 400;
  margin-top: auto;
  padding-top: 30px;
  color: #979db1;
  text-align: center;
  /* Center display */
}

/* Skeleton animation */
@keyframes shimmer {
  100% {
    transform: translateX(100%);
  }
}

.skeleton-item {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  height: 120px;
  position: relative;
  overflow: hidden;
  margin-bottom: 20px;
}

.skeleton-image {
  width: 80px;
  height: 80px;
  background: #f0f2f5;
  border-radius: 4px;
  float: left;
  position: relative;
  overflow: hidden;
}

.skeleton-content {
  margin-left: 100px;
}

.skeleton-line {
  height: 16px;
  background: #f0f2f5;
  border-radius: 4px;
  margin-bottom: 12px;
  width: 70%;
  position: relative;
  overflow: hidden;
}

.skeleton-line-short {
  height: 12px;
  background: #f0f2f5;
  border-radius: 4px;
  width: 50%;
}

.skeleton-item::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 50%;
  height: 100%;
  background: linear-gradient(90deg,
      rgba(255, 255, 255, 0),
      rgba(255, 255, 255, 0.3),
      rgba(255, 255, 255, 0));
  animation: shimmer 1.5s infinite;
}

.delete-agent-content {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.delete-agent-title {
  display: inline-flex;
  align-items: center;
  font-size: 18px;
  font-weight: 500;
  color: #2f3a5f;
}

.delete-agent-title-icon {
  width: 24px;
  height: 24px;
  margin-right: 8px;
}

.delete-agent-warning {
  color: #e6a23c;
  font-size: 24px;
  margin-top: 4px;
}

.delete-agent-message {
  flex: 1;
  color: #606266;
  font-size: 14px;
  line-height: 1.6;
}

.delete-agent-target {
  margin-top: 14px;
  padding: 10px 12px;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  background: #f5f7fa;
  color: #303133;
  font-weight: 600;
  word-break: break-all;
}

.delete-agent-copy-guard {
  user-select: none;
  -webkit-user-select: none;
}

.delete-agent-input {
  margin-top: 16px;
}

.delete-agent-input::v-deep .el-input__inner {
  height: 42px;
  border-color: #d8dce8;
  border-radius: 4px;
  background: #fff;
  color: #303133;
  font-size: 14px;
}

.delete-agent-helper {
  min-height: 18px;
  margin-top: 6px;
  color: #f56c6c;
  font-size: 12px;
}

.delete-agent-footer {
  display: inline-flex;
  gap: 10px;
}

.delete-agent-dialog::v-deep .el-dialog {
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.delete-agent-dialog::v-deep .el-dialog__header {
  padding: 16px 20px 12px;
  background: linear-gradient(135deg, #e2eeff, #edeafe);
  text-align: left;
}

.delete-agent-dialog::v-deep .el-dialog__headerbtn {
  top: 12px;
  right: 16px;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
}

.delete-agent-dialog::v-deep .el-dialog__headerbtn .el-dialog__close {
  font-size: 18px;
  color: #666;
  position: static;
  transform: none;
}

.delete-agent-dialog::v-deep .el-dialog__headerbtn:hover {
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
}

.delete-agent-dialog::v-deep .el-dialog__headerbtn:hover .el-dialog__close {
  color: #333;
}

.delete-agent-dialog::v-deep .el-dialog__body {
  padding: 28px 32px 20px;
}

.delete-agent-dialog::v-deep .el-dialog__footer {
  padding: 12px 32px 24px;
}

.delete-agent-cancel,
.delete-agent-confirm {
  min-width: 92px;
  height: 40px;
  padding: 0 20px;
  border-radius: 6px;
  font-size: 15px;
}

.delete-agent-cancel {
  color: #fff;
  background: #4d94f7;
  border: none;
}

.delete-agent-cancel:hover,
.delete-agent-cancel:focus {
  color: #fff;
  background: #4d94f7;
  opacity: 0.88;
}

.delete-agent-confirm {
  background: linear-gradient(to right, #4a7cfd, #8154fc);
  border: none;
}

.delete-agent-confirm:hover,
.delete-agent-confirm:focus {
  background: linear-gradient(to right, #4a7cfd, #8154fc);
  opacity: 0.88;
}

.delete-agent-confirm.is-disabled,
.delete-agent-confirm.is-disabled:hover,
.delete-agent-confirm.is-disabled:focus {
  background: linear-gradient(to right, #4a7cfd, #8154fc);
  border: none;
  opacity: 0.45;
}

/* ================= Analytics Dashboard ================= */
.analytics-dashboard {
  margin-top: 20px;
  margin-bottom: 24px;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

.kpi-card {
  background: #ffffff;
  border-radius: 12px;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(0, 0, 0, 0.05);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.kpi-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
}

.kpi-icon-wrapper {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  flex-shrink: 0;
}

.kpi-blue {
  background: rgba(59, 130, 246, 0.12);
  color: #3b82f6;
}

.kpi-green {
  background: rgba(16, 185, 129, 0.12);
  color: #10b981;
}

.kpi-purple {
  background: rgba(139, 92, 246, 0.12);
  color: #8b5cf6;
}

.kpi-orange {
  background: rgba(245, 158, 11, 0.12);
  color: #f59e0b;
}

.kpi-info {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.kpi-label {
  font-size: 13px;
  color: #64748b;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.kpi-num {
  font-size: 22px;
  font-weight: 700;
  color: #1e293b;
  margin-top: 4px;
}

/* Analytics Row (Trend chart + Telemetry) */
.analytics-row {
  display: flex;
  gap: 16px;
}

.chart-panel {
  background: #ffffff;
  border-radius: 14px;
  padding: 18px 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.trend-panel {
  flex: 62;
  display: flex;
  flex-direction: column;
}

.telemetry-panel {
  flex: 38;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.panel-title {
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 8px;
}

.title-icon {
  font-size: 16px;
  color: #4f46e5;
}

.panel-sub {
  font-size: 12px;
  color: #94a3b8;
}

.latency-badge {
  background: rgba(79, 70, 229, 0.1);
  color: #4f46e5;
  font-weight: 700;
  font-size: 13px;
  padding: 2px 10px;
  border-radius: 20px;
}

.chart-container {
  width: 100%;
  height: 250px;
}

/* Latency Bars */
.latency-bars {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 16px;
}

.latency-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.latency-header {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
}

.latency-name {
  color: #475569;
  display: flex;
  align-items: center;
  gap: 5px;
}

.latency-val {
  font-weight: 600;
  color: #1e293b;
}

/* Leaderboards */
.leaderboard-row {
  display: flex;
  gap: 12px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  padding-top: 12px;
}

.leaderboard-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.lb-title {
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.lb-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.lb-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.lb-rank {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  background: #f1f5f9;
  color: #64748b;
  flex-shrink: 0;
}

.rank-1 {
  background: #fef3c7;
  color: #d97706;
}

.rank-2 {
  background: #e0e7ff;
  color: #4f46e5;
}

.rank-3 {
  background: #f1f5f9;
  color: #475569;
}

.lb-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #334155;
}

.lb-count {
  font-weight: 600;
  color: #64748b;
  font-size: 11px;
}

.lb-empty {
  font-size: 12px;
  color: #94a3b8;
  font-style: italic;
  padding: 6px 0;
}

/* Dark Mode Overrides */
body.dark .welcome {
  background: #0f172a;
}

body.dark .kpi-card,
body.dark .chart-panel {
  background: #1e293b;
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}

body.dark .kpi-label,
body.dark .lb-title,
body.dark .latency-name {
  color: #94a3b8;
}

body.dark .kpi-num,
body.dark .panel-title,
body.dark .latency-val,
body.dark .lb-name {
  color: #f1f5f9;
}

body.dark .leaderboard-row {
  border-top-color: rgba(255, 255, 255, 0.08);
}

body.dark .lb-count {
  color: #94a3b8;
}

@media (max-width: 1200px) {
  .kpi-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .analytics-row {
    flex-direction: column;
  }
}
</style>
