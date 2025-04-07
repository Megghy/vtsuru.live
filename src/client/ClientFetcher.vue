<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted, watch, nextTick, shallowRef } from 'vue';


  // ECharts
  import { use } from 'echarts/core';
  import { CanvasRenderer } from 'echarts/renderers';
  import { LineChart, BarChart, PieChart, GaugeChart } from 'echarts/charts';
  import {
    TitleComponent, TooltipComponent, GridComponent, LegendComponent,
    ToolboxComponent, MarkLineComponent, MarkPointComponent, DataZoomComponent
  } from 'echarts/components';
  import VChart, { THEME_KEY } from 'vue-echarts';

  // Naive UI & Icons
  import {
    NCard, NFlex, NTag, NText, NStatistic, NSpin, NGrid, NGi, NEmpty,
    NScrollbar, NDescriptions, NDescriptionsItem, NEllipsis, NIcon, NButton,
    NRadioGroup, NRadioButton, NTooltip, NAlert, NQrCode, NInput, NDivider, NSpace, useMessage,
    NInputGroup,
    NInputGroupLabel,
    NTabs,
    NTabPane
  } from 'naive-ui';
  import {
    CheckmarkCircleOutline, CloseCircleOutline, AlertCircleOutline, WifiOutline, TimeOutline, BarChartOutline, PieChartOutline, HardwareChipOutline, CodeSlashOutline, InformationCircleOutline, PersonCircleOutline, LogInOutline, LogOutOutline, TvOutline, PeopleOutline, LinkOutline, CloudOutline, ServerOutline, FlashOutline, DownloadOutline, TimerOutline, HelpCircle, TrendingUpOutline
  } from '@vicons/ionicons5';

  // Date & Formatters
  import { formatDistanceToNow, intervalToDuration, format } from 'date-fns';
  import { zhCN } from 'date-fns/locale';

  // Tauri APIs (Optional - Remove if not using Tauri)
  import { platform, OsType, type, version } from '@tauri-apps/plugin-os';
  import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
  import { openUrl } from '@tauri-apps/plugin-opener';
  import { info as logInfo, error as logError } from '@tauri-apps/plugin-log';
  import { useWebFetcher } from '@/store/useWebFetcher';
  import { COOKIE_CLOUD_KEY, CookieCloudConfig, useBiliCookie } from './store/useBiliCookie';
  import { useSettings } from './store/useSettings';
  import { FetcherStatisticData } from './data/models';
  import { currentStatistic, getHistoricalStatistics, streamingInfo } from './data/info';
  import { invoke } from '@tauri-apps/api/core';
  import { getLoginInfoAsync, getLoginUrlDataAsync } from './data/biliLogin';
  import { QueryBiliAPI } from './data/utils';
  import { useAccount } from '@/api/account';
  import { useTauriStore } from './store/useTauriStore';
  import { callStartDanmakuClient } from './data/initialize';

  // --- ECharts Setup ---
  use([
    CanvasRenderer, LineChart, BarChart, PieChart, GaugeChart, TitleComponent,
    TooltipComponent, GridComponent, LegendComponent, ToolboxComponent,
    MarkLineComponent, MarkPointComponent, DataZoomComponent
  ]);

  // --- Store Access ---
  const webfetcher = useWebFetcher();
  const biliCookie = useBiliCookie();
  const settings = useSettings();
  const message = useMessage();
  const accountInfo = useAccount();
  // currentStatistic and streamingInfo are directly imported refs

  // --- Component State ---
  const uptime = ref<string>('N/A');
  const eventsPerSecond = ref<number>(0);
  const historicalData = ref<FetcherStatisticData[]>([]);
  const isLoadingHistory = ref(false);
  const showCharts = ref(false); // Delay rendering charts until connected

  // 添加图表实例引用
  const gaugeChart = shallowRef();
  const historyChart = shallowRef();
  const typeDistributionChart = shallowRef();

  // Chart Options
  const gaugeOption = ref({});
  const historyOption = ref({});
  const typeDistributionOption = ref({});

  // System & Network Info (Tauri / Browser Fallback)
  const osInfo = ref<string>('未知');
  const memoryInfo = ref<{ total?: number, free?: number, used?: number; }>({}); // More detailed for Tauri
  const networkStatus = ref<'online' | 'offline'>('online');

  // Login State (Copied from original snippet)
  const isQRCodeLogining = ref(false);
  const loginUrl = ref('');
  const loginKey = ref('');
  const cookie = ref<string>(); // Local ref for display
  const timer = ref(0);
  const expiredTimer = ref(0);
  const countdownTimer = ref(0);
  const countdownKey = ref(0);
  const loginStatus = ref<'expired' | 'unknown' | 'scanned' | 'waiting' | 'confirmed'>();
  const startAt = ref(Date.now());


  const cookieCloud = useTauriStore().getTarget<CookieCloudConfig>(COOKIE_CLOUD_KEY, {
    host: 'https://cookie.vtsuru.live',
    key: '',
    password: ''
  });
  // 新增 Cookie Cloud 配置字段
  const cookieCloudData = ref((await cookieCloud.get())!);
  const isLoadingCookiecloud = ref(false);

  async function setCookieCloud() {
    try {
      isLoadingCookiecloud.value = true;
      await biliCookie.setCookieCloudConfig(cookieCloudData.value);
      message.success("Cookie Cloud 配置已保存");
    } catch (err: any) {
      message.error(err.message);
    } finally {
      isLoadingCookiecloud.value = false;
    }
  }

  // --- Timers ---
  let uptimeTimer: number | undefined;
  let epsTimer: number | undefined;
  let lastEventCount = 0;
  let networkPollTimer: number | undefined;

  // --- Computed Properties ---
  const isConnected = computed(() => webfetcher.state === 'connected');
  const connectionStatusType = computed(() => {
    switch (webfetcher.state) {
      case 'connected': return 'success';
      case 'connecting': return 'info';
      case 'disconnected': return 'error';
      default: return 'default';
    }
  });
  const connectionStatusText = computed(() => {
    switch (webfetcher.state) {
      case 'connected': return '运行中';
      case 'connecting': return '连接中';
      case 'disconnected': return '已停止';
      default: return '未知';
    }
  });
  const formattedStartedAt = computed(() => {
    return webfetcher.startedAt ? new Date(webfetcher.startedAt).toLocaleString() : 'N/A';
  });

  const danmakuClientStateText = computed(() => {
    // Assuming webfetcher exposes danmakuClient.state as danmakuClientState
    switch (webfetcher.danmakuClientState) { // Replace with actual exposed state
      case 'connected': return '已连接';
      case 'connecting': return '连接中';
      case 'stopped': return '已停止';
      default: return '未知';
    }
  });
  const danmakuClientStateType = computed(() => {
    switch (webfetcher.danmakuClientState) { // Replace with actual exposed state
      case 'connected': return 'success';
      case 'connecting': 'info';
      case 'stopped': 'error';
      default: return 'default';
    }
  });

  const signalRStateText = computed(() => {
    // Assuming webfetcher exposes signalRClient.state (it likely does via webfetcher.state)
    switch (webfetcher.state) {
      case 'connected': return '已连接';
      case 'connecting': return '连接中';
      case 'disconnected': return '已断开';
      default: return '未知';
    }
  });
  const signalRStateType = computed(() => connectionStatusType.value); // Same as overall

  const isStreaming = computed(() => streamingInfo.value?.status === 'streaming');
  const streamingDuration = computed(() => {
    if (isStreaming.value && streamingInfo.value?.streamAt) {
      // Assuming live_time is a Unix timestamp (seconds)
      return formatDistanceToNow(streamingInfo.value.streamAt, { locale: zhCN, addSuffix: true });
    }
    return '未开播';
  });

  const sortedTodayTypes = computed(() => {
    // ... same as before ...
    if (!currentStatistic.value || !currentStatistic.value.eventTypeCounts) return [];
    return Object.entries(currentStatistic.value.eventTypeCounts)
      .sort(([, countA], [, countB]) => countB - countA);
  });

  // Login Status (Computed from original snippet)
  const loginStatusString = computed(() => {
    switch (loginStatus.value) {
      case 'expired': return '过期';
      case 'unknown': return '未知';
      case 'scanned': return '已扫描, 等待确认';
      case 'waiting': return '等待扫描';
      case 'confirmed': return '已登录';
      default: return undefined;
    }
  });

  // --- Functions ---

  // Chart Updates (Keep existing: updateGaugeChart, updateHistoryChart, updateTypeDistributionChart)
  function updateGaugeChart() {
    const option = {
      tooltip: { formatter: '{a} <br/>{b} : {c}/s' },
      series: [{
        name: '实时速率', type: 'gauge', min: 0, max: 20, splitNumber: 5,
        progress: { show: true, width: 12 }, axisLine: { lineStyle: { width: 12 } },
        axisTick: { show: false }, splitLine: { length: 8, lineStyle: { width: 2, color: '#999' } },
        axisLabel: { distance: 15, color: '#999', fontSize: 12 },
        anchor: { show: true, showAbove: true, size: 15, itemStyle: { borderWidth: 8 } },
        title: { show: false }, detail: { valueAnimation: true, fontSize: 24, offsetCenter: [0, '60%'], formatter: '{value}/s' },
        data: [{ value: eventsPerSecond.value, name: '事件/秒' }]
      }]
    };
    gaugeOption.value ??= option; // 保留原始option用于初始化
    if (gaugeChart.value) {
      gaugeChart.value.setOption(option, false);
    }
  }

  function updateHistoryChart() {
    const option = {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: '3%', right: '5%', bottom: '10%', containLabel: true }, // Adjust grid
      xAxis: [{ type: 'category', data: historicalData.value.map(d => d.date.substring(5)), axisTick: { alignWithLabel: true } }],
      yAxis: [{ type: 'value', name: '事件总数' }],
      dataZoom: [{ type: 'inside', start: 0, end: 100 }, { type: 'slider', start: 0, end: 100, bottom: 5 }], // Add zoom
      series: [{
        name: '每日事件数', type: 'bar', barWidth: '60%', data: historicalData.value.map(d => d.count),
        itemStyle: { borderRadius: [4, 4, 0, 0] }, emphasis: { focus: 'series' },
        markPoint: { data: [{ type: 'max', name: '最大值' }, { type: 'min', name: '最小值' }] },
        markLine: { data: [{ type: 'average', name: '平均值' }] }
      }]
    };
    historyOption.value ??= option; // 保留原始option用于初始化
    if (historyChart.value) {
      historyChart.value.setOption(option, false);
    }
  }

  function updateTypeDistributionChart() {
    const typeData = Object.entries(webfetcher.sessionEventTypeCounts || {})
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    const option = {
      tooltip: { trigger: 'item', formatter: '{a} <br/>{b}: {c} ({d}%)' },
      legend: { type: 'scroll', orient: 'vertical', right: 10, top: 20, bottom: 20, data: typeData.map(d => d.name) }, // Scrollable legend
      series: [{
        name: '事件类型分布 (本次)', type: 'pie', radius: ['40%', '70%'], center: ['40%', '50%'], // Adjust center for legend
        avoidLabelOverlap: true, itemStyle: { borderRadius: 5, borderColor: '#fff', borderWidth: 1 },
        label: { show: false, position: 'center' }, emphasis: { label: { show: true, fontSize: '16', fontWeight: 'bold' } },
        labelLine: { show: false }, data: typeData
      }]
    };
    typeDistributionOption.value ??= option; // 保留原始option用于初始化
    if (typeDistributionChart.value) {
      typeDistributionChart.value.setOption(option, false);
    }
  }

  // Data Fetching
  async function loadHistoricalData() { /* ... same as before ... */
    isLoadingHistory.value = true;
    try {
      historicalData.value = await getHistoricalStatistics(30); // Fetch more days?
      updateHistoryChart();
    } catch (error) { console.error("Failed to load historical statistics:", error); }
    finally { isLoadingHistory.value = false; }
  }

  async function fetchSystemInfo() {
    // Tauri specific (replace with browser fallbacks if needed)
    try {
      const os = type();
      const plat = platform();
      const ver = version();
      osInfo.value = `${os} (${plat} ${ver})`;
    } catch (e) {
      logError("Failed to get OS info: " + e);
      // Fallback (Browser)
      osInfo.value = navigator.userAgent; // Less specific
    }

    try {
      // Assumes a Tauri plugin or command `get_memory_info` returning { total: number, free: number } in KB/MB/GB
      // Adjust the command name and response structure as needed
      const mem: { total: number, free: number; } = await invoke('get_memory_info'); // Example command
      memoryInfo.value = {
        total: mem.total,
        free: mem.free,
        used: mem.total - mem.free
      };
    } catch (e) {
      logError("Failed to get Memory info: " + e);
      // Fallback (Browser - Limited)
      if ('memory' in performance && (performance as any).memory.totalJSHeapSize) {
        memoryInfo.value = { total: (performance as any).memory.totalJSHeapSize }; // Only JS Heap
      }
    }
  }

  // Uptime & EPS (Keep existing: updateUptime, calculateEPS)
  function updateUptime() { /* ... same logic ... */
    if (webfetcher.startedAt) { uptime.value = formatDistanceToNow(new Date(webfetcher.startedAt), { addSuffix: true, locale: zhCN }); }
    else { uptime.value = 'N/A'; clearInterval(uptimeTimer); uptimeTimer = undefined; }
  }
  function calculateEPS() { /* ... same logic ... */
    const currentCount = webfetcher.sessionEventCount;
    eventsPerSecond.value = currentCount - lastEventCount;
    lastEventCount = currentCount;
  }

  async function startLogin() { /* ... same logic ... */
    if (isQRCodeLogining.value) return;
    isQRCodeLogining.value = true;
    try {
      const data = await getLoginUrlDataAsync(); // Assumes this function exists
      loginUrl.value = data.url;
      loginKey.value = data.qrcode_key;
      loginStatus.value = 'waiting';
      startAt.value = Date.now();
      expiredTimer.value = window.setTimeout(() => { loginStatus.value = 'expired'; clearInterval(timer.value); }, 3 * 60 * 1000);
      countdownTimer.value = window.setInterval(() => { countdownKey.value++; }, 500);
      timer.value = window.setInterval(async () => {
        const login = await getLoginInfoAsync(loginKey.value); // Assumes this exists
        loginStatus.value = login.status;
        if (login.status === 'confirmed') {
          biliCookie.setBiliCookie(login.cookie, login.refresh_token);
          cookie.value = login.cookie; // Update local display ref
          logInfo(`扫码登录成功`);
          message.success('登录成功');
          finishLogin();
          await biliCookie.check();
        } else if (login.status === 'expired') {
          finishLogin(); message.error('二维码已过期');
        } else { /* console.log(`Scan status: ${login.status}`) */ }
      }, 2000);
    } catch (err: any) {
      logError(err.toString()); message.error('获取登录二维码失败');
      isQRCodeLogining.value = false; loginStatus.value = undefined;
    }
  }
  function finishLogin() { /* ... same logic ... */
    clearInterval(timer.value); clearTimeout(expiredTimer.value); clearInterval(countdownTimer.value);
    isQRCodeLogining.value = false; loginStatus.value = undefined;
    loginUrl.value = ''; loginKey.value = ''; cookie.value = ''; // Clear local display ref
  }
  function formatTimeDifference(startUnix: number, endUnix: number) { /* ... same logic ... */
    const duration = intervalToDuration({ start: new Date(startUnix), end: new Date(endUnix) });
    const minutes = duration.minutes || 0; const seconds = duration.seconds || 0;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  async function onSwitchDanmakuClientMode(type: 'openlive' | 'direct', force: boolean = false) {
    if (webfetcher.webfetcherType === type && !force) {
      message.info('当前已是该模式'); return;
    }
    const noticeRef = window.$notification.info({
      title: 'WebEventFetcher',
      content: '正在关闭弹幕服务器...',
      closable: false,
    });
    settings.settings.useDanmakuClientType = type;
    settings.save();
    webfetcher.Stop();
    noticeRef.content = '正在连接弹幕服务器...';
    const result = await callStartDanmakuClient();
    noticeRef.destroy();
    if (result.success) {
      window.$notification.success({
        title: 'WebEventFetcher',
        content: webfetcher.webfetcherType + ' 弹幕客户端连接成功',
        closable: true,
        duration: 3000,
      });
    } else {
      window.$notification.error({
        title: 'WebEventFetcher',
        content: '弹幕服务器连接失败: ' + result.message,
        closable: true,
      });
    }
  }
  async function logout() {
    await biliCookie.logout();
    message.info('已退出登录');
  }

  // --- Watchers ---
  watch(() => webfetcher.state, (newState) => {
    if (newState === 'connected') {
      if (!uptimeTimer) { updateUptime(); uptimeTimer = window.setInterval(updateUptime, 60 * 1000); }
      if (!epsTimer) { lastEventCount = webfetcher.sessionEventCount; epsTimer = window.setInterval(() => { calculateEPS(); updateGaugeChart(); }, 1000); }
      loadHistoricalData(); // Load history on connect
      showCharts.value = true;
      fetchSystemInfo(); // Fetch system info on connect
      nextTick(() => { updateGaugeChart(); updateTypeDistributionChart(); });
    } else {
      clearInterval(uptimeTimer); clearInterval(epsTimer);
      uptimeTimer = undefined; epsTimer = undefined;
      uptime.value = 'N/A'; eventsPerSecond.value = 0;
      showCharts.value = false;
    }
  });

  watch(() => webfetcher.sessionEventTypeCounts, () => {
    if (isConnected.value) { updateTypeDistributionChart(); }
  }, { deep: true });

  watch(currentStatistic, (newDailyStat) => {
    if (newDailyStat && historicalData.value.length > 0) {
      const todayIndex = historicalData.value.findIndex(d => d.date === newDailyStat.date);
      if (todayIndex !== -1) {
        historicalData.value[todayIndex].count = newDailyStat.count;
        // Maybe debounce history chart update if daily stats update frequently
        updateHistoryChart();
      } else {
        // Add today if missing (e.g., after midnight)
        historicalData.value.push(JSON.parse(JSON.stringify(newDailyStat))); // Add copy
        historicalData.value.sort((a, b) => a.date.localeCompare(b.date)); // Keep sorted
        updateHistoryChart();
      }
    } else if (newDailyStat && historicalData.value.length === 0) {
      // Handle first data point case
      historicalData.value = [JSON.parse(JSON.stringify(newDailyStat))];
      updateHistoryChart();
    }
  }, { deep: true });

  // --- Lifecycle Hooks ---
  onMounted(async () => {
    // Initial setup based on current state
    if (webfetcher.state === 'connected') {
      updateUptime();
      uptimeTimer = window.setInterval(updateUptime, 60 * 1000);
      lastEventCount = webfetcher.sessionEventCount; epsTimer = window.setInterval(() => { calculateEPS(); updateGaugeChart(); }, 1000);
      loadHistoricalData(); showCharts.value = true;
      fetchSystemInfo();
      nextTick(() => { updateGaugeChart(); updateTypeDistributionChart(); });
    }

    // Fetch initial Bili cookie for display
    cookie.value = await biliCookie.getBiliCookie();
    // Initial Bili user info fetch handled by watcher

    // Initialize statistics logic (ensure it runs)
    // initInfo(); // Assuming this is called elsewhere or on app startup
  });

  onUnmounted(() => {
    clearInterval(uptimeTimer);
    clearInterval(epsTimer);
    clearInterval(networkPollTimer);
    // Clean up login timers if component unmounts during login
    clearInterval(timer.value);
    clearTimeout(expiredTimer.value);
    clearInterval(countdownTimer.value);
  });

</script>

<template>
  <NFlex
    vertical
    align="center"
    gap="large"
    style="padding: 1rem;"
  >
    <!-- Header -->
    <NFlex
      align="center"
      justify="center"
    >
      <p style="font-size: 2.25rem; font-weight: bold;">
        VTsuruEventFetcher
      </p>
      <NTag
        style="margin-left: 0.75rem; height: 1.5rem; color: rgb(148 163 184);"
        :bordered="false"
      >
        Client
      </NTag>
    </NFlex>

    <!-- Settings -->
    <NCard
      title="设置"
      embedded
      style="width: 100%; max-width: 800px;"
    >
      <NFlex vertical>
        <NRadioGroup
          v-model:value="settings.settings.useDanmakuClientType"
          :disabled="webfetcher.state === 'connecting'"
          @update-value="v => onSwitchDanmakuClientMode(v)"
        >
          <NRadioButton value="openlive">
            开放平台
          </NRadioButton>
          <NRadioButton
            value="direct"
            :disabled="!biliCookie.isCookieValid"
          >
            <NTooltip v-if="!biliCookie.isCookieValid">
              <template #trigger>
                直接连接
              </template>
              请先登录 B 站账号以使用直接连接模式
            </NTooltip>
            <NText v-else>
              直接连接
            </NText>
          </NRadioButton>
        </NRadioGroup>
        <NPopconfirm
          type="info"
          :disabled="webfetcher.state === 'connecting'"
          @positive-click="async () => {
            await onSwitchDanmakuClientMode(settings.settings.useDanmakuClientType, true);
            message.success('已重启弹幕服务器');
          }"
        >
          <template #trigger>
            <NButton
              type="error"
              style="max-width: 150px;"
              :disabled="webfetcher.state === 'connecting'"
            >
              强制重启弹幕客户端
            </NButton>
          </template>
          <template #default>
            确定要强制重启弹幕服务器吗？
          </template>
        </NPopconfirm>
      </NFlex>
    </NCard>

    <!-- Credentials & Account -->
    <NCard
      title="凭据 & 账户"
      embedded
      style="width: 100%; max-width: 800px;"
    >
      <template #header-extra>
        <NTag
          v-if="biliCookie.isCookieValid"
          type="success"
          size="small"
        >
          <template #icon>
            <NIcon :component="CheckmarkCircleOutline" />
          </template>
          已登录
        </NTag>
        <NTag
          v-else
          type="error"
          size="small"
        >
          <template #icon>
            <NIcon :component="CloseCircleOutline" />
          </template>
          未登录
        </NTag>
      </template>
      <NFlex vertical>
        <NDescriptions
          label-placement="left"
          bordered
          size="small"
          :columns="1"
        >
          <NDescriptionsItem
            v-if="biliCookie.isCookieValid"
            label="B站用户名"
          >
            <NSpin
              :show="biliCookie.isCookieValid && !biliCookie.userInfo"
              size="small"
              style="display: inline-block; width: 100%;"
            >
              <NText>{{ biliCookie.userInfo?.name ?? '未登录或加载中...' }}</NText>
            </NSpin>
          </NDescriptionsItem>
          <NDescriptionsItem
            v-if="biliCookie.isCookieValid"
            label="用户UID"
          >
            <NSpin
              :show="biliCookie.isCookieValid && !biliCookie.userInfo"
              size="small"
              style="display: inline-block;"
            >
              <NText>{{ biliCookie.userInfo?.mid ?? 'N/A' }}</NText>
            </NSpin>
          </NDescriptionsItem>
          <NDescriptionsItem label="登录状态">
            {{ loginStatusString ?? (biliCookie.isCookieValid ? '已登录' : '未登录') }}
            <NTag
              v-if="loginStatus === 'waiting' || loginStatus === 'scanned'"
              :key="countdownKey"
              class="ml-1"
              :bordered="false"
              type="info"
              size="small"
            >
              {{ formatTimeDifference(Date.now(), 1000 * 180 + startAt) }}
            </NTag>
          </NDescriptionsItem>
        </NDescriptions>

        <div v-if="biliCookie.isCookieValid">
          <NText
            small
            depth="3"
          >
            登录凭据 (Cookie - 敏感信息)
          </NText>
          <NInput
            type="textarea"
            :value="cookie"
            placeholder="已登录"
            readonly
            autosize
            :min-rows="1"
            :max-rows="3"
            style="margin-top: 4px; max-height: 150px;"
          />
          <NButton
            type="error"
            ghost
            size="small"
            style="margin-top: 8px;"
            @click="logout"
          >
            <template #icon>
              <NIcon :component="LogOutOutline" />
            </template>
            退出登录
          </NButton>
        </div>
        <NDivider style="margin: 0;">
          登录方式
        </NDivider>
        <NTabs
          v-model:value="settings.settings.loginType"
          type="segment"
          size="small"
          @update-value="settings.save()"
        >
          <NTabPane
            name="qrcode"
            tab="扫码登录"
          >
            <NFlex
              v-if="!isQRCodeLogining || loginStatus === 'expired'"
              align="center"
              gap="small"
            >
              <NButton
                id="bilibili-login"
                @click="startLogin"
              >
                <!-- Keep disabled for now -->
                <template #icon>
                  <NIcon :component="LogInOutline" />
                </template>
                {{ loginStatus === 'expired' ? '重新获取二维码' : '获取二维码' }}
              </NButton>
              <NTooltip trigger="hover">
                <template #trigger>
                  <NIcon :component="HelpCircle" />
                </template>
                <div>
                  <p>所有关于Cookie的操作都将在本地进行, 不会上传到任何服务器。</p>
                  <p>
                    相关代码开源于 <NButton
                      text
                      type="info"
                      @click="openUrl('https://github.com/Megghy/vtsuru.live/tree/master/src/client')"
                    >
                      GitHub
                    </NButton>
                  </p>
                </div>
              </NTooltip>
            </NFlex>
            <div
              v-else
              style="display: flex; align-items: center; justify-content: center; gap: 1rem;"
            >
              <NSpin v-if="!loginUrl" />
              <NQrCode
                v-else
                type="image/png"
                :value="loginUrl"
                error-level="H"
                :size="180"
              />
            </div>
          </NTabPane>
          <NTabPane
            name="cookiecloud"
            tab="Cookie Cloud"
          >
            <NCard
              title="Cookie Cloud 配置"
              embedded
              style="width: 100%; max-width: 800px; margin-bottom: 1rem;"
            >
              <template #header-extra>
                <NTag>
                  {{ }}
                </NTag>
              </template>
              <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                <NAlert type="info">
                  设置 CookieCloud 后扫码登陆的登陆信息将被覆盖
                </NAlert>
                <br>
                <NInputGroup>
                  <NInputGroupLabel>
                    Key
                  </NInputGroupLabel>
                  <NInput
                    v-model:value="cookieCloudData.key"
                    placeholder="请输入 Key"
                  />
                </NInputGroup>
                <NInputGroup>
                  <NInputGroupLabel>
                    Password
                  </NInputGroupLabel>
                  <NInput
                    v-model:value="cookieCloudData.password"
                    placeholder="请输入 Password"
                    type="password"
                    show-password-on="click"
                  />
                </NInputGroup>
                <NInputGroup>
                  <NInputGroupLabel>
                    Host (可选)
                  </NInputGroupLabel>
                  <NInput
                    v-model:value="cookieCloudData.host"
                    default-value="https://cookie.vtsuru.live"
                    clearable
                    placeholder="请输入 Host (可选)"
                  />
                </NInputGroup>
                <NButton
                  v-if="biliCookie.cookieCloudState === 'invalid' || biliCookie.cookieCloudState === 'unset'"
                  type="primary"
                  :loading="isLoadingCookiecloud"
                  @click="setCookieCloud"
                >
                  保存配置
                </NButton>
                <NPopconfirm
                  v-else
                  type="error"
                  @positive-click="async () => {
                    await biliCookie.clearCookieCloudConfig();
                    cookieCloudData = { key: '', password: '' };
                    message.success('配置已清除');
                  }"
                >
                  <template #trigger>
                    <NButton type="error">
                      清除配置
                    </NButton>
                  </template>
                  确定要清除配置吗？
                </NPopconfirm>
              </div>
            </NCard>
          </NTabPane>
        </NTabs>
      </NFlex>
    </NCard>

    <!-- Overall Status & Connection Details -->
    <NCard
      title="运行状态 & 连接"
      embedded
      style="width: 100%; max-width: 800px;"
    >
      <template #header-extra>
        <NTag
          :type="connectionStatusType"
          size="small"
        >
          <template #icon>
            <NIcon :component="isConnected ? CheckmarkCircleOutline : AlertCircleOutline" />
          </template>
          {{ connectionStatusText }}
        </NTag>
      </template>
      <NDescriptions
        label-placement="top"
        bordered
        :columns="2"
        size="small"
        style="overflow-x: auto;"
      >
        <NDescriptionsItem label="启动时间">
          <NIcon :component="TimeOutline" /> {{ formattedStartedAt }}
        </NDescriptionsItem>
        <NDescriptionsItem label="运行时长">
          <NIcon :component="TimerOutline" /> {{ uptime }}
        </NDescriptionsItem>
        <NDescriptionsItem label="SignalR 服务">
          <NFlex
            align="center"
            size="small"
            :wrap="false"
          >
            <NTag
              :type="signalRStateType"
              size="tiny"
            >
              {{ signalRStateText }}
            </NTag>
            <NEllipsis style="max-width: 150px;">
              {{ webfetcher.signalRId ?? 'N/A' }}
            </NEllipsis>
          </NFlex>
        </NDescriptionsItem>
        <NDescriptionsItem label="弹幕服务器">
          <NFlex
            align="center"
            size="small"
            :wrap="false"
          >
            <NTag
              :type="danmakuClientStateType"
              size="tiny"
            >
              {{ danmakuClientStateText }}
            </NTag>
            <NEllipsis style="max-width: 150px;">
              {{ webfetcher.danmakuServerUrl ?? 'N/A' }}
            </NEllipsis> <!-- Assuming this is exposed -->
          </NFlex>
        </NDescriptionsItem>
        <NDescriptionsItem label="网络状态">
          <NFlex
            align="center"
            size="small"
          >
            <NTag
              :type="networkStatus === 'online' ? 'success' : 'error'"
              size="tiny"
            >
              <template #icon>
                <NIcon :component="WifiOutline" />
              </template>
              {{ networkStatus === 'online' ? '在线' : '离线' }}
            </NTag>
          </NFlex>
        </NDescriptionsItem>
      </NDescriptions>
    </NCard>

    <!-- Live Stream Info -->
    <NCard
      v-if="settings.settings.useDanmakuClientType === 'openlive'"
      title="直播间信息"
      embedded
      style="width: 100%; max-width: 800px;"
    >
      <template #header-extra>
        <NTag
          v-if="isStreaming"
          type="success"
          size="small"
        >
          <template #icon>
            <NIcon :component="TvOutline" />
          </template>
          直播中
        </NTag>
        <NTag
          v-else
          type="default"
          size="small"
        >
          未开播
        </NTag>
      </template>
      <NSpin :show="!streamingInfo">
        <!-- Show loading if no info yet -->
        <NDescriptions
          v-if="streamingInfo"
          label-placement="top"
          bordered
          :columns="2"
          size="small"
        >
          <NDescriptionsItem label="直播间标题">
            <NEllipsis :line-clamp="2">
              {{ streamingInfo.title ?? 'N/A' }}
            </NEllipsis>
          </NDescriptionsItem>
          <NDescriptionsItem label="主播">
            <NIcon :component="PersonCircleOutline" /> {{ accountInfo.streamerInfo?.name ?? 'N/A' }}
          </NDescriptionsItem>
          <NDescriptionsItem label="人气">
            <NIcon :component="PeopleOutline" /> {{ streamingInfo.online?.toLocaleString() ?? 'N/A' }}
          </NDescriptionsItem>
          <NDescriptionsItem label="开播时间">
            <NIcon :component="TimeOutline" /> {{ streamingDuration }}
          </NDescriptionsItem>
          <!-- Add more fields from BiliStreamingInfo/BiliRoomInfo if needed -->
        </NDescriptions>
        <NEmpty
          v-else
          description="未获取到直播间信息"
          style="padding: 20px 0;"
        />
      </NSpin>
    </NCard>

    <!-- Session Statistics -->
    <NCard
      title="会话实时统计"
      embedded
      style="width: 100%; max-width: 800px;"
    >
      <div v-if="isConnected && showCharts">
        <NGrid
          :x-gap="16"
          :y-gap="16"
          cols="1 s:2 l:3"
          responsive="screen"
        >
          <NGi>
            <NCard
              title="实时速率"
              size="small"
              embedded
              :segmented="{ content: true }"
            >
              <div style="height: 180px;">
                <VChart
                  ref="gaugeChart"
                  :option="gaugeOption"
                  autoresize
                />
              </div>
            </NCard>
          </NGi>
          <NGi>
            <NCard
              title="事件类型分布"
              size="small"
              embedded
              :segmented="{ content: true }"
            >
              <div style="height: 180px;">
                <VChart
                  ref="typeDistributionChart"
                  :option="typeDistributionOption"
                  autoresize
                />
              </div>
            </NCard>
          </NGi>
          <NGi span="1 s:2 l:1">
            <!-- Adjust span -->
            <NCard
              title="会话摘要"
              size="small"
              embedded
              :segmented="{ content: true }"
              style="height: 100%;"
            >
              <NFlex
                vertical
                justify="space-around"
                style="height: 100%;"
              >
                <NStatistic label="会话事件总数">
                  <NIcon :component="BarChartOutline" /> {{ webfetcher.sessionEventCount?.toLocaleString() ?? 0 }}
                </NStatistic>
                <NStatistic label="已发送">
                  {{ ((webfetcher.bytesSentSession ?? 0) / 1024).toFixed(2) }} KB <!-- Assuming exposed -->
                </NStatistic>
              </NFlex>
            </NCard>
          </NGi>
        </NGrid>
      </div>
      <NEmpty
        v-else-if="!isConnected"
        description="WebFetcher 未连接"
      />
      <NSpin v-else /> <!-- Connecting state -->
    </NCard>

    <!-- Daily Statistics -->
    <NCard
      title="今日统计"
      embedded
      style="width: 100%; max-width: 800px;"
    >
      <template #header-extra>
        <NText depth="3">
          {{ currentStatistic?.date ?? 'N/A' }}
        </NText>
      </template>
      <div v-if="currentStatistic">
        <NGrid
          x-gap="12"
          y-gap="16"
          cols="1 s:2"
        >
          <NGi>
            <NStatistic label="今日接收总数">
              <template #prefix>
                <NIcon :component="TrendingUpOutline" />
              </template>
              <span
                style="font-size: 1.8em; font-weight: 500;"
              >{{ currentStatistic.count?.toLocaleString() ?? 0 }}</span>
            </NStatistic>
          </NGi>
          <NGi>
            <NText strong>
              类型明细:
            </NText>
            <NScrollbar style="max-height: 200px; margin-top: 8px;">
              <div v-if="sortedTodayTypes.length > 0">
                <NFlex
                  vertical
                  spacing="small"
                >
                  <NFlex
                    v-for="[type, count] in sortedTodayTypes"
                    :key="type"
                    justify="space-between"
                    align="center"
                  >
                    <NTag
                      size="small"
                      :bordered="false"
                      type="info"
                      style="max-width: 70%;"
                    >
                      <NEllipsis>{{ type }}</NEllipsis>
                    </NTag>
                    <NText>{{ count.toLocaleString() }}</NText>
                  </NFlex>
                </NFlex>
              </div>
              <NEmpty
                v-else
                description="今日暂无数据"
                size="small"
              />
            </NScrollbar>
          </NGi>
        </NGrid>
      </div>
      <NEmpty
        v-else
        description="正在加载今日统计..."
      />
    </NCard>

    <!-- Historical Statistics -->
    <NCard
      title="历史事件量 (近30日)"
      embedded
      style="width: 100%; max-width: 800px;"
    >
      <NSpin :show="isLoadingHistory">
        <div style="height: 280px;">
          <VChart
            v-if="historicalData.length > 0"
            ref="historyChart"
            :option="historyOption"
            autoresize
          />
          <NEmpty
            v-else
            description="无历史数据"
            style="height: 100%; display: flex; align-items: center; justify-content: center;"
          />
        </div>
      </NSpin>
    </NCard>

    <!-- System Info (Optional) -->
    <NCard
      title="系统信息"
      embedded
      style="width: 100%; max-width: 800px;"
    >
      <template #header-extra>
        <NIcon :component="HardwareChipOutline" />
      </template>
      <NDescriptions
        label-placement="left"
        bordered
        size="small"
        :columns="1"
      >
        <NDescriptionsItem label="操作系统">
          {{ osInfo }}
        </NDescriptionsItem>
        <NDescriptionsItem label="内存 (近似)">
          <span v-if="memoryInfo?.total">
            已用: {{ ((memoryInfo.used ?? 0) / 1024 / 1024 / 1024).toFixed(2) }} GB /
            可用: {{ ((memoryInfo.free ?? 0) / 1024 / 1024 / 1024).toFixed(2) }} GB /
            总计: {{ (memoryInfo.total / 1024 / 1024 / 1024).toFixed(2) }} GB
          </span>
          <span v-else> N/A </span>
        </NDescriptionsItem>
        <!-- Add CPU info here if fetchable via Tauri -->
      </NDescriptions>
    </NCard>
  </NFlex>
</template>