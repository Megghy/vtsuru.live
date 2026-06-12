// oxlint-disable no-unused-expressions
<script setup lang="ts">
import { useSettings } from '@/apps/client/store/useSettings'
import ClientPageHeader from '@/apps/client/components/ClientPageHeader.vue'
import FetcherSettingsCard from '@/apps/client/components/fetcher/FetcherSettingsCard.vue'
import FetcherStatusCard from '@/apps/client/components/fetcher/FetcherStatusCard.vue'
import FetcherLoginCard from '@/apps/client/components/fetcher/FetcherLoginCard.vue'
import FetcherLiveInfoCard from '@/apps/client/components/fetcher/FetcherLiveInfoCard.vue'
import FetcherStatisticsCard from '@/apps/client/components/fetcher/FetcherStatisticsCard.vue'
import FetcherDailyStatsCard from '@/apps/client/components/fetcher/FetcherDailyStatsCard.vue'
import FetcherSystemCard from '@/apps/client/components/fetcher/FetcherSystemCard.vue'

const settings = useSettings()
</script>

<template>
  <NFlex vertical :size="12">
    <NCard size="small" bordered>
      <ClientPageHeader
        title="EventFetcher"
        description="事件采集、登录状态与运行监控"
      />
    </NCard>

    <FetcherSettingsCard />

    <FetcherStatusCard v-if="settings.settings.enableEventFetcher" />

    <FetcherLoginCard />

    <FetcherLiveInfoCard
      v-if="settings.settings.enableEventFetcher && settings.settings.useDanmakuClientType === 'openlive'"
    />

    <FetcherStatisticsCard v-if="settings.settings.enableEventFetcher" />

    <FetcherDailyStatsCard v-if="settings.settings.enableEventFetcher" />

    <FetcherSystemCard />
  </NFlex>
</template>
