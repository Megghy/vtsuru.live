<script setup lang="ts">
import {
  CloudArchive24Filled,
  DataTrending24Filled,
  Desktop24Filled,
  PersonAccounts24Filled,
} from '@vicons/fluent'
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import ClientPageHeader from '@/apps/client/components/ClientPageHeader.vue'
import FetcherDailyStatsCard from '@/apps/client/components/fetcher/FetcherDailyStatsCard.vue'
import FetcherLiveInfoCard from '@/apps/client/components/fetcher/FetcherLiveInfoCard.vue'
import FetcherSettingsCard from '@/apps/client/components/fetcher/FetcherSettingsCard.vue'
import FetcherStatisticsCard from '@/apps/client/components/fetcher/FetcherStatisticsCard.vue'
import FetcherStatusCard from '@/apps/client/components/fetcher/FetcherStatusCard.vue'
import FetcherSystemCard from '@/apps/client/components/fetcher/FetcherSystemCard.vue'
import { useBiliCookie } from '@/apps/client/store/useBiliCookie'
import { useSettings } from '@/apps/client/store/useSettings'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'

const router = useRouter()
const biliCookie = useBiliCookie()
const settings = useSettings()
const activeTab = ref<'connection' | 'stats' | 'system'>('connection')
</script>

<template>
  <div class="flex flex-col gap-3.5">
    <Card>
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
        <TabsTrigger value="connection" class="gap-1.5" >
          <CloudArchive24Filled class="size-3.5" />
          连接设置
        </TabsTrigger>
        <TabsTrigger value="stats" class="gap-1.5" >
          <DataTrending24Filled class="size-3.5" />
          监控与统计
        </TabsTrigger>
        <TabsTrigger value="system" class="gap-1.5" >
          <Desktop24Filled class="size-3.5" />
          系统与诊断
        </TabsTrigger>
      </TabsList>

      <!-- 连接设置 -->
      <TabsContent
        value="connection"
        class="pt-3 space-y-3 mt-3 pb-6"
      >
        <!-- B 站账号凭据统一入口提示卡片 -->
        <Card class="p-3">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2.5">
              <div class="size-8 rounded-md flex-center text-primary bg-primary/10 shrink-0">
                <PersonAccounts24Filled class="size-4.5" />
              </div>
              <div>
                <div class="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <span>B 站账号与主凭据</span>
                  <Badge
                    variant="outline"
                    size="xs"
                    :class="biliCookie.isCookieValid ? 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10' : 'border-amber-500/40 text-amber-600 bg-amber-500/10'"
                  >
                    {{ biliCookie.isCookieValid ? (biliCookie.userInfo?.name || '已登录') : '未登录 / 需重新验证' }}
                  </Badge>
                </div>
                <div class="text-[11px] text-muted-foreground mt-0.5">
                  主播主凭据登录、有效性监控与多账号池
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="xs"
              class="gap-1 shrink-0"
              @click="router.push({ name: 'client-account-manage' })"
            >
              <span>前往账号与凭据</span>
              <span class="text-[10px]">&rarr;</span>
            </Button>
          </div>
        </Card>

        <FetcherSettingsCard class="client-readable" />

        <FetcherStatusCard
          v-if="settings.settings.enableEventFetcher"
          class="client-readable"
        />

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
