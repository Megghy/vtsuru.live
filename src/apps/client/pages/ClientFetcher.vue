<script setup lang="ts">
import { CloudArchive24Filled, DataTrending24Filled, Desktop24Filled } from '@vicons/fluent'
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
import { Card } from '@/shared/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'

const settings = useSettings()
const activeTab = ref<'connection' | 'stats' | 'system'>('connection')
</script>

<template>
  <div class="flex flex-col gap-3.5">
    <Card class="border bg-card">
      <div class="p-3">
        <ClientPageHeader
          title="EventFetcher"
          description="事件采集引擎、连接状态与运行监控"
        />
      </div>
    </Card>

    <Tabs
      v-model="activeTab"
      class="w-full mt-0.5"
    >
      <TabsList class="grid w-full max-w-md grid-cols-3">
        <TabsTrigger
          value="connection"
          class="text-xs gap-1.5"
        >
          <CloudArchive24Filled class="size-3.5" />
          连接与凭据
        </TabsTrigger>
        <TabsTrigger
          value="stats"
          class="text-xs gap-1.5"
        >
          <DataTrending24Filled class="size-3.5" />
          监控与统计
        </TabsTrigger>
        <TabsTrigger
          value="system"
          class="text-xs gap-1.5"
        >
          <Desktop24Filled class="size-3.5" />
          系统与诊断
        </TabsTrigger>
      </TabsList>

      <!-- 连接与凭据 -->
      <TabsContent
        value="connection"
        class="pt-3 space-y-3 mt-3 pb-6"
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
      </TabsContent>

      <!-- 实时监控与统计 -->
      <TabsContent
        value="stats"
        class="pt-3 space-y-3 mt-3 pb-6"
      >
        <FetcherStatisticsCard v-if="settings.settings.enableEventFetcher" />
        <FetcherDailyStatsCard v-if="settings.settings.enableEventFetcher" />
      </TabsContent>

      <!-- 系统与诊断 -->
      <TabsContent
        value="system"
        class="pt-3 space-y-3 mt-3 pb-6"
      >
        <FetcherSystemCard class="client-readable" />
      </TabsContent>
    </Tabs>
  </div>
</template>
