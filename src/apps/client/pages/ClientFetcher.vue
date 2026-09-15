<script setup lang="ts">
import {
  CloudArchive24Filled,
  DataTrending24Filled,
  Desktop24Filled,
} from '@vicons/fluent'
import {
  NCard,
  NFlex,
  NIcon,
  NTabPane,
  NTabs,
} from 'naive-ui'
import { ref } from 'vue'

import ClientPageHeader from '@/apps/client/components/ClientPageHeader.vue'
import FetcherDailyStatsCard from '@/apps/client/components/fetcher/FetcherDailyStatsCard.vue'
import FetcherLiveInfoCard from '@/apps/client/components/fetcher/FetcherLiveInfoCard.vue'
import FetcherLoginCard from '@/apps/client/components/fetcher/FetcherLoginCard.vue'
import FetcherSettingsCard from '@/apps/client/components/fetcher/FetcherSettingsCard.vue'
import FetcherStatisticsCard from '@/apps/client/components/fetcher/FetcherStatisticsCard.vue'
import FetcherStatusCard from '@/apps/client/components/fetcher/FetcherStatusCard.vue'
import FetcherSystemCard from '@/apps/client/components/fetcher/FetcherSystemCard.vue'
import { useSettings } from '@/apps/client/store/useSettings'

const settings = useSettings()
const activeTab = ref<'connection' | 'stats' | 'system'>('connection')
</script>

<template>
  <NFlex
    vertical
    :size="14"
  >
    <NCard
      size="small"
      bordered
    >
      <ClientPageHeader
        title="EventFetcher"
        description="事件采集引擎、连接状态与运行监控"
      />
    </NCard>

    <NTabs
      v-model:value="activeTab"
      type="segment"
      animated
      class="fetcher-tabs"
    >
      <!-- 连接与凭据 -->
      <NTabPane
        name="connection"
        tab="连接与凭据"
      >
        <template #tab>
          <NFlex
            align="center"
            :size="6"
          >
            <NIcon :component="CloudArchive24Filled" />
            <span>连接与凭据</span>
          </NFlex>
        </template>

        <NFlex
          vertical
          :size="12"
          class="fetcher-tab-content"
        >
          <FetcherSettingsCard class="client-readable" />

          <FetcherStatusCard
            v-if="settings.settings.enableEventFetcher"
            class="client-readable"
          />

          <FetcherLoginCard class="client-readable" />

          <FetcherLiveInfoCard
            v-if="settings.settings.enableEventFetcher && settings.settings.useDanmakuClientType === 'openlive'"
            class="client-readable"
          />
        </NFlex>
      </NTabPane>

      <!-- 实时监控与统计 -->
      <NTabPane
        name="stats"
        tab="监控与统计"
      >
        <template #tab>
          <NFlex
            align="center"
            :size="6"
          >
            <NIcon :component="DataTrending24Filled" />
            <span>监控与统计</span>
          </NFlex>
        </template>

        <NFlex
          vertical
          :size="12"
          class="fetcher-tab-content"
        >
          <FetcherStatisticsCard v-if="settings.settings.enableEventFetcher" />

          <FetcherDailyStatsCard v-if="settings.settings.enableEventFetcher" />
        </NFlex>
      </NTabPane>

      <!-- 系统与诊断 -->
      <NTabPane
        name="system"
        tab="系统与诊断"
      >
        <template #tab>
          <NFlex
            align="center"
            :size="6"
          >
            <NIcon :component="Desktop24Filled" />
            <span>系统与诊断</span>
          </NFlex>
        </template>

        <NFlex
          vertical
          :size="12"
          class="fetcher-tab-content"
        >
          <FetcherSystemCard class="client-readable" />
        </NFlex>
      </NTabPane>
    </NTabs>
  </NFlex>
</template>

<style scoped>
.fetcher-tabs {
  margin-top: 2px;
}

.fetcher-tab-content {
  margin-top: 12px;
  padding-bottom: 24px;
}
</style>
