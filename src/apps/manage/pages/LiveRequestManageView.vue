<script setup lang="ts">
import CheckmarkCircle24Regular from '@vicons/fluent/es/CheckmarkCircle24Regular'
import Desktop24Regular from '@vicons/fluent/es/Desktop24Regular'
import History24Regular from '@vicons/fluent/es/History24Regular'
import MusicNote224Regular from '@vicons/fluent/es/MusicNote224Regular'
import Settings24Regular from '@vicons/fluent/es/Settings24Regular'
import Video24Regular from '@vicons/fluent/es/Video24Regular'
import { format, isSameDay } from 'date-fns'
import { computed, onActivated, onDeactivated, onMounted, onUnmounted, ref } from 'vue'

import { useAccount } from '@/api/account'
import type { AppStartData } from '@/api/generated/model'
import { FunctionTypes, SongRequestStatus } from '@/api/generated/model'
import LiveRequestOBS from '@/apps/obs/pages/request/LiveRequestOBS.vue'
import LiveRequestProcessedOBS from '@/apps/obs/pages/request/LiveRequestProcessedOBS.vue'
import SongRequestHistory from '@/apps/open-live/components/request/SongRequestHistory.vue'
import SongRequestList from '@/apps/open-live/components/request/SongRequestList.vue'
import SongRequestSettings from '@/apps/open-live/components/request/SongRequestSettings.vue'
import LiveConsoleCockpit from '@/apps/open-live/components/shared/LiveConsoleCockpit.vue'
import LiveConsolePageShell, {
  type LiveConsoleHeaderLink,
  type LiveConsoleTabItem,
} from '@/apps/open-live/components/shared/LiveConsolePageShell.vue'
import LiveSideCard from '@/apps/open-live/components/shared/LiveSideCard.vue'
import ObsStagePreview from '@/apps/open-live/components/shared/ObsStagePreview.vue'
import SongPlayer from '@/components/SongPlayer.vue'
import { useLiveRequest } from '@/composables/useLiveRequest'
import { CURRENT_HOST } from '@/shared/config'
import { buildObsSourceUrl } from '@/shared/obs/obsUrl'
import { Badge } from '@/shared/ui/badge'
import { Card, CardContent } from '@/shared/ui/card'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { normalizeTimestampMs } from '@/shared/utils/queue'
import { useDanmakuClient } from '@/store/useDanmakuClient'

defineProps<{
  roomInfo?: AppStartData
  code?: string | undefined
  isOpenLive?: boolean
}>()

const accountInfo = useAccount()
const client = await useDanmakuClient().initOpenlive()

const activeMainTab = ref<'requests' | 'history' | 'preview' | 'settings'>('requests')
const obsPreviewMode = ref<'live-request' | 'live-request-today'>('live-request')

const obsUrl = computed(() =>
  buildObsSourceUrl({
    path: 'obs/live-request',
    host: CURRENT_HOST,
    credential: 'public-id',
    userId: accountInfo.value?.id,
    params: { style: 'glass' },
  }),
)

const todayObsUrl = computed(() =>
  buildObsSourceUrl({
    path: 'obs/live-request-today',
    host: CURRENT_HOST,
    credential: 'public-id',
    userId: accountInfo.value?.id,
    params: { style: 'glass' },
  }),
)

const headerLinks = computed<LiveConsoleHeaderLink[]>(() => [
  {
    label: '当前待唱 OBS 源',
    value: obsUrl.value,
    description: '在 OBS 中添加为浏览器源，展示正在演唱与等待队列',
  },
  {
    label: '今日已唱 OBS 源',
    value: todayObsUrl.value,
    description: '在 OBS 中展示今日已完成点播的曲目列表',
  },
])

const liveRequest = useLiveRequest()

const tabs = computed<LiveConsoleTabItem[]>(() => [
  {
    value: 'requests',
    label: '当前点播',
    icon: Video24Regular,
    badge: liveRequest.unfilteredActiveSongs.length,
  },
  { value: 'history', label: '历史与统计', icon: History24Regular },
  { value: 'preview', label: 'OBS 舞台预览', icon: Desktop24Regular },
  { value: 'settings', label: '规则设置', icon: Settings24Regular, keepMounted: true },
])

const todayFinishedSongs = computed(() =>
  liveRequest.songs
    .filter((s) => s.status === SongRequestStatus.Finish && isSameDay(normalizeTimestampMs(s.finishAt), Date.now()))
    .toSorted(
      (a, b) =>
        (normalizeTimestampMs(b.finishAt) || normalizeTimestampMs(b.createAt)) -
        (normalizeTimestampMs(a.finishAt) || normalizeTimestampMs(a.createAt)),
    ),
)

const ruleSummary = computed(() => accountInfo.value?.settings?.songRequest)

onMounted(() => {
  client.onEvent('danmaku', liveRequest.onGetDanmaku)
  client.onEvent('sc', liveRequest.onGetSC)
  void liveRequest.init()
})

onActivated(() => {
  void liveRequest.init()
})

onDeactivated(() => {
  liveRequest.dispose()
})

onUnmounted(() => {
  client.offEvent('danmaku', liveRequest.onGetDanmaku)
  client.offEvent('sc', liveRequest.onGetSC)
  liveRequest.dispose()
})
</script>

<template>
  <LiveConsolePageShell
    v-model="activeMainTab"
    title="弹幕点播"
    subtitle="观众发送点播弹幕、醒目留言或从公开歌单页点播，支持主播手动调序、积分退回、OBS 实时队列与今日已唱展示"
    :function-type="FunctionTypes.SongRequest"
    :links="headerLinks"
    :tabs="tabs"
  >
    <template #requests>
      <LiveConsoleCockpit>
        <template #main>
          <SongRequestList />
        </template>

        <template #aside>
          <SongPlayer
            v-if="liveRequest.selectedSong"
            v-model:is-lrc-loading="liveRequest.isLrcLoading"
            :song="liveRequest.selectedSong"
          />
          <Card v-else>
            <CardContent class="p-3.5 flex items-center gap-2.5 text-xs text-muted-foreground">
              <MusicNote224Regular class="size-4 shrink-0 text-primary" />
              <span>点击列表中的「试听」图标即可在此播放伴奏与双语歌词。</span>
            </CardContent>
          </Card>

          <LiveSideCard
            title="今日已唱"
            :icon="CheckmarkCircle24Regular"
            icon-class="text-emerald-600"
            :badge="todayFinishedSongs.length"
            action-label="历史统计"
            @action="activeMainTab = 'history'"
          >
            <div
              v-if="todayFinishedSongs.length > 0"
              class="divide-y divide-border"
            >
              <div
                v-for="item in todayFinishedSongs.slice(0, 8)"
                :key="item.id"
                class="flex-between gap-2 py-1.5 text-xs"
              >
                <div class="flex items-center gap-1.5 min-w-0">
                  <span class="font-medium text-foreground truncate">{{ item.songName }}</span>
                  <span class="text-muted-foreground truncate shrink-0"> · {{ item.user?.name || '主播添加' }} </span>
                </div>
                <span class="font-mono tabular-nums text-muted-foreground shrink-0">
                  {{ item.finishAt ? format(normalizeTimestampMs(item.finishAt), 'HH:mm') : '' }}
                </span>
              </div>
            </div>
            <div
              v-else
              class="py-4 text-center text-xs text-muted-foreground"
            >
              今日暂未完成演唱曲目
            </div>
          </LiveSideCard>

          <LiveSideCard
            title="点播规则概况"
            action-label="调整规则"
            @action="activeMainTab = 'settings'"
          >
            <div class="space-y-2 text-xs">
              <div class="flex-between">
                <span class="text-muted-foreground">触发前缀 / 范围</span>
                <Badge
                  variant="outline"
                  size="xs"
                >
                  {{ ruleSummary?.orderPrefix || '点歌' }} ·
                  {{ ruleSummary?.onlyAllowSongList ? '仅限歌单' : '不限曲目' }}
                </Badge>
              </div>
              <div class="flex-between">
                <span class="text-muted-foreground">网页歌单点播</span>
                <Badge
                  :variant="ruleSummary?.allowFromWeb ? 'success' : 'secondary'"
                  size="xs"
                >
                  {{ ruleSummary?.allowFromWeb ? '允许' : '已关闭' }}
                </Badge>
              </div>
              <div class="flex-between">
                <span class="text-muted-foreground">积分点歌 / 插队</span>
                <span class="font-mono text-foreground">
                  {{ ruleSummary?.enablePointRequest ? `${ruleSummary.pointRequestCost ?? 0} 积分` : '免费' }}
                  /
                  {{ ruleSummary?.allowPointPriority ? `${ruleSummary.pointPriorityCost ?? 0} 积分插队` : '未开启' }}
                </span>
              </div>
            </div>
          </LiveSideCard>
        </template>
      </LiveConsoleCockpit>
    </template>

    <template #history>
      <SongRequestHistory />
    </template>

    <template #preview>
      <ObsStagePreview
        :obs-path="obsPreviewMode === 'live-request' ? 'obs/live-request' : 'obs/live-request-today'"
        :user-id="accountInfo?.id"
        :title="obsPreviewMode === 'live-request' ? '当前点播 OBS 预览' : '今日已唱 OBS 预览'"
        recommended-size="推荐 OBS 来源尺寸：宽 380px ~ 440px，高 540px ~ 680px。"
      >
        <template #toolbar>
          <ToggleGroup
            v-model="obsPreviewMode"
            type="single"
            size="xs"
          >
            <ToggleGroupItem value="live-request">待唱队列</ToggleGroupItem>
            <ToggleGroupItem value="live-request-today">今日已唱</ToggleGroupItem>
          </ToggleGroup>
        </template>

        <template #default="{ styleType, speedMultiplier }">
          <LiveRequestOBS
            v-if="obsPreviewMode === 'live-request'"
            :id="accountInfo?.id"
            :key="`lr-${accountInfo?.id}-${styleType}-${speedMultiplier}`"
            :theme-style="styleType"
            :speed-multiplier="speedMultiplier"
          />
          <LiveRequestProcessedOBS
            v-else
            :id="accountInfo?.id"
            :key="`lr-today-${accountInfo?.id}-${styleType}-${speedMultiplier}`"
            :theme-style="styleType"
            :speed-multiplier="speedMultiplier"
          />
        </template>
      </ObsStagePreview>
    </template>

    <template #settings>
      <SongRequestSettings />
    </template>
  </LiveConsolePageShell>
</template>
