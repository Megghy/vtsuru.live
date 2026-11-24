<script setup lang="ts">
import { CloudUpload, RotateCcw, TrendingUp, UserCog } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import ClientPageHeader from '@/apps/client/components/ClientPageHeader.vue'
import FetcherDailyStatsCard from '@/apps/client/components/fetcher/FetcherDailyStatsCard.vue'
import FetcherSettingsCard from '@/apps/client/components/fetcher/FetcherSettingsCard.vue'
import FetcherStatisticsCard from '@/apps/client/components/fetcher/FetcherStatisticsCard.vue'
import FetcherStatusCard from '@/apps/client/components/fetcher/FetcherStatusCard.vue'
import { useFetcherControl } from '@/apps/client/composables/useFetcherControl'
import { useBiliCookie } from '@/apps/client/store/useBiliCookie'
import { useSettings } from '@/apps/client/store/useSettings'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Switch } from '@/shared/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { useWebFetcher } from '@/store/useWebFetcher'

type TabKey = 'connection' | 'stats'

const route = useRoute()
const router = useRouter()
const biliCookie = useBiliCookie()
const settings = useSettings()
const webfetcher = useWebFetcher()
const { isBusy, toggleEnabled, forceRestart } = useFetcherControl()

function resolveTab(val: unknown): TabKey {
  return val === 'stats' ? 'stats' : 'connection'
}

const activeTab = ref<TabKey>(resolveTab(route.query.tab))

watch(
  () => route.query.tab,
  (val) => {
    activeTab.value = resolveTab(val)
  },
)

function onTabChange(val: string | number) {
  const next = resolveTab(val)
  activeTab.value = next
  void router.replace({
    query: {
      ...route.query,
      tab: next,
    },
  })
}

const statusBadgeMeta = computed(() => {
  if (!settings.settings.enableEventFetcher) {
    return { variant: 'secondary' as const, label: '已停用', dotClass: 'bg-muted-foreground/60' }
  }
  switch (webfetcher.state) {
    case 'connected':
      return { variant: 'success' as const, label: '运行中', dotClass: 'bg-emerald-500' }
    case 'connecting':
      return { variant: 'warning' as const, label: '连接中', dotClass: 'bg-amber-500 animate-pulse' }
    default:
      return { variant: 'destructive' as const, label: '已断开', dotClass: 'bg-destructive' }
  }
})
</script>

<template>
  <div class="flex flex-col gap-3.5 pb-6">
    <!-- 顶部控制台标头 -->
    <Card class="p-3 client-readable">
      <ClientPageHeader
        title="EventFetcher"
        description="事件采集引擎、连接诊断与运行统计"
      >
        <template #actions>
          <div class="flex items-center gap-2 flex-wrap">
            <Badge
              :variant="statusBadgeMeta.variant"
              size="sm"
              class="gap-1.5"
            >
              <span
                class="size-1.5 rounded-full"
                :class="statusBadgeMeta.dotClass"
              />
              <span>{{ statusBadgeMeta.label }}</span>
            </Badge>

            <Popconfirm
              v-if="settings.settings.enableEventFetcher"
              title="强制重启"
              :disabled="isBusy"
              @positive-click="forceRestart"
            >
              <template #trigger>
                <Button
                  variant="outline"
                  class="gap-1.5"
                  :disabled="isBusy"
                >
                  <RotateCcw
                    class="size-3.5"
                    :class="{ 'animate-spin': isBusy }"
                  />
                  <span>重启连接</span>
                </Button>
              </template>
              确定要强制断开并重新连接弹幕服务器吗？
            </Popconfirm>

            <div class="flex items-center gap-1.5 pl-1 border-l border-border">
              <span class="text-xs text-muted-foreground">采集开关</span>
              <Switch
                :checked="settings.settings.enableEventFetcher"
                :disabled="isBusy"
                @update:checked="toggleEnabled($event)"
              />
            </div>
          </div>
        </template>
      </ClientPageHeader>
    </Card>

    <Alert
      v-if="!settings.settings.enableEventFetcher"
      size="sm"
      variant="warning"
      class="client-readable"
    >
      <AlertDescription class="m-0">
        EventFetcher 功能已禁用，直播间事件数据将不会被收集和上传；历史统计仍可正常查看。
      </AlertDescription>
    </Alert>

    <Alert
      v-else-if="settings.settings.useDanmakuClientType === 'direct' && !biliCookie.isCookieValid"
      size="sm"
      variant="warning"
      class="client-readable"
    >
      <AlertDescription class="m-0 flex-between gap-2 flex-wrap">
        <span>当前处于直接连接模式，但 B 站主凭据未登录或已失效，可能无法获取完整房间密钥。</span>
        <Button
          variant="outline"
          size="xs"
          class="gap-1 shrink-0"
          @click="router.push({ name: 'client-account-manage' })"
        >
          <UserCog class="size-3.5" />
          <span>前往账号与凭据</span>
        </Button>
      </AlertDescription>
    </Alert>

    <Tabs
      :model-value="activeTab"
      class="w-full"
      @update:model-value="onTabChange"
    >
      <div class="client-readable">
        <TabsList class="grid w-full max-w-sm grid-cols-2">
          <TabsTrigger
            value="connection"
            class="gap-1.5"
          >
            <CloudUpload class="size-3.5" />
            <span>连接与诊断</span>
          </TabsTrigger>
          <TabsTrigger
            value="stats"
            class="gap-1.5"
          >
            <TrendingUp class="size-3.5" />
            <span>统计与历史</span>
          </TabsTrigger>
        </TabsList>
      </div>

      <!-- 连接与诊断 -->
      <TabsContent
        value="connection"
        class="pt-3 space-y-3 mt-0 client-readable"
      >
        <FetcherSettingsCard />
        <FetcherStatusCard v-if="settings.settings.enableEventFetcher" />
      </TabsContent>

      <!-- 统计与历史 -->
      <TabsContent
        value="stats"
        class="pt-3 space-y-3 mt-0 client-readable"
      >
        <FetcherStatisticsCard />
        <FetcherDailyStatsCard />
      </TabsContent>
    </Tabs>
  </div>
</template>
