<script setup lang="ts">
import Checkmark12Regular from '@vicons/fluent/es/Checkmark12Regular'
import CheckmarkCircle24Regular from '@vicons/fluent/es/CheckmarkCircle24Regular'
import Desktop24Regular from '@vicons/fluent/es/Desktop24Regular'
import Flash24Regular from '@vicons/fluent/es/Flash24Regular'
import History24Regular from '@vicons/fluent/es/History24Regular'
import PeopleQueue24Regular from '@vicons/fluent/es/PeopleQueue24Regular'
import PersonAdd24Regular from '@vicons/fluent/es/PersonAdd24Regular'
import Settings24Regular from '@vicons/fluent/es/Settings24Regular'
import { format, isSameDay } from 'date-fns'
import { computed, onActivated, onDeactivated, onMounted, onUnmounted, ref } from 'vue'

import { useAccount } from '@/api/account'
import type { AppStartData } from '@/api/generated/model'
import { FunctionTypes, QueueStatus } from '@/api/generated/model'
import QueueOBS from '@/apps/obs/pages/QueueOBS.vue'
import { useObsRealtimeSync } from '@/apps/obs/composables/useObsRealtimeSync'
import QueueHistoryPanel from '@/apps/open-live/components/queue/QueueHistoryPanel.vue'
import QueueListPanel from '@/apps/open-live/components/queue/QueueListPanel.vue'
import QueueSettingsTab from '@/apps/open-live/components/queue/QueueSettingsTab.vue'
import LiveConsoleCockpit from '@/apps/open-live/components/shared/LiveConsoleCockpit.vue'
import LiveConsolePageShell, {
  type LiveConsoleHeaderLink,
  type LiveConsoleTabItem,
} from '@/apps/open-live/components/shared/LiveConsolePageShell.vue'
import LiveDashboardEntryCard from '@/apps/open-live/components/shared/LiveDashboardEntryCard.vue'
import LiveSideCard from '@/apps/open-live/components/shared/LiveSideCard.vue'
import ObsStagePreview from '@/apps/open-live/components/shared/ObsStagePreview.vue'
import { useQueue } from '@/composables/useQueue'
import { CURRENT_HOST } from '@/shared/config'
import { buildObsSourceUrl } from '@/shared/obs/obsUrl'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { useMessage } from '@/shared/utils'
import { normalizeTimestampMs } from '@/shared/utils/queue'
import { useDanmakuClient } from '@/store/useDanmakuClient'

defineProps<{
  roomInfo?: AppStartData
  code?: string | undefined
  isOpenLive?: boolean
}>()

const message = useMessage()
const accountInfo = useAccount()
const client = await useDanmakuClient().initOpenlive()
const store = useQueue()

const activeMainTab = ref<'queue' | 'history' | 'preview' | 'settings'>('queue')

const todayFinishedQueues = computed(() =>
  store.historySongs
    .filter((q) => q.status === QueueStatus.Finish && isSameDay(normalizeTimestampMs(q.finishAt), Date.now()))
    .toSorted(
      (a, b) =>
        (normalizeTimestampMs(b.finishAt) || normalizeTimestampMs(b.createAt)) -
        (normalizeTimestampMs(a.finishAt) || normalizeTimestampMs(a.createAt)),
    ),
)

const eligibilitySummary = computed(() => {
  const s = store.settings
  const guards: string[] = []
  if (s.needJianzhang) guards.push('舰长')
  if (s.needTidu) guards.push('提督')
  if (s.needZongdu) guards.push('总督')
  const parts: string[] = []
  if (guards.length) parts.push(guards.join('/'))
  if ((s.fanMedalMinLevel ?? 0) > 0) parts.push(`粉丝牌≥${s.fanMedalMinLevel}级`)
  return parts.length > 0 ? parts.join(' · ') : '无门槛'
})

const obsUrl = computed(() =>
  buildObsSourceUrl({
    path: 'obs/queue',
    host: CURRENT_HOST,
    credential: 'public-id',
    userId: accountInfo.value?.id,
    params: { style: 'glass' },
  }),
)

const publicQueueUrl = computed(() => {
  const handle = accountInfo.value?.name || accountInfo.value?.id
  if (!handle) return ''
  return `${CURRENT_HOST}@${handle}/queue`
})

const headerLinks = computed<LiveConsoleHeaderLink[]>(() => {
  const links: LiveConsoleHeaderLink[] = [
    {
      label: 'OBS 浏览器源地址',
      value: obsUrl.value,
      description: '将此链接作为 OBS 浏览器源添加，建议分辨率 400x600 或按需调整',
    },
  ]
  if (publicQueueUrl.value) {
    links.push({
      label: '观众网页自助排队页',
      value: publicQueueUrl.value,
      description: '观众可在浏览器登录 B 站直接加入排队或积分插队',
    })
  }
  return links
})

const tabs = computed<LiveConsoleTabItem[]>(() => [
  {
    value: 'queue',
    label: '当前排队',
    icon: PeopleQueue24Regular,
    badge: store.unfilteredQueue.length,
  },
  { value: 'history', label: '历史与统计', icon: History24Regular },
  { value: 'preview', label: 'OBS 舞台预览', icon: Desktop24Regular },
  { value: 'settings', label: '规则设置', icon: Settings24Regular, keepMounted: true },
])

const sampleNames = ['小鱼干爱好者', '星尘远航者', '魔法少女喵', '橘子汽水', '秋风扫落叶', '可乐要加冰', '月下漫步']
const sampleNotes = ['艾欧尼亚 #2333', '黑色玫瑰 #1024', '瓦罗兰特 ID: Nova#CN1', '祖安大区', '上单/打野补位']
async function injectMockUser() {
  const mockName = `${sampleNames[Math.floor(Math.random() * sampleNames.length)]} #${Math.floor(Math.random() * 100)}`
  const mockNote = sampleNotes[Math.floor(Math.random() * sampleNotes.length)]
  const added = await store.addManual(mockName, mockNote)
  if (added) {
    message.success(`已注入模拟排队观众「${mockName}」`)
  }
}

const isViewActive = ref(true)
const { on: onQueueRealtime } = useObsRealtimeSync({
  topic: () => (accountInfo.value?.id ? `obs:display:queue:${accountInfo.value.id}` : ''),
  active: () => isViewActive.value,
  visible: () => isViewActive.value,
  onSync: () => {
    void store.updateActive()
  },
})
onQueueRealtime('Changed', () => {
  void store.updateActive()
})

onMounted(() => {
  isViewActive.value = true
  client.onEvent('danmaku', store.onGetDanmaku)
  client.onEvent('gift', store.onGetGift)
  client.onEvent('sc', store.onGetSC)
  void store.init()
})

onActivated(() => {
  isViewActive.value = true
  void store.init()
})

onDeactivated(() => {
  isViewActive.value = false
  store.dispose()
})

onUnmounted(() => {
  isViewActive.value = false
  client.offEvent('danmaku', store.onGetDanmaku)
  client.offEvent('gift', store.onGetGift)
  client.offEvent('sc', store.onGetSC)
  store.dispose()
})
</script>

<template>
  <LiveConsolePageShell
    v-model="activeMainTab"
    title="弹幕排队系统"
    subtitle="观众通过弹幕指令、赠送礼物或公开排队页面加入等待队列，支持多策略排序、手动调序、积分退回与 OBS 动态呈现"
    :function-type="FunctionTypes.Queue"
    :links="headerLinks"
    :tabs="tabs"
  >
    <template #queue>
      <LiveConsoleCockpit>
        <template #main>
          <QueueListPanel />
        </template>

        <template #aside>
          <LiveSideCard
            title="今日已完成"
            :icon="CheckmarkCircle24Regular"
            icon-class="text-emerald-600"
            :badge="todayFinishedQueues.length"
            action-label="历史统计"
            @action="activeMainTab = 'history'"
          >
            <div
              v-if="todayFinishedQueues.length > 0"
              class="divide-y divide-border"
            >
              <div
                v-for="item in todayFinishedQueues.slice(0, 8)"
                :key="item.id"
                class="flex-between gap-2 py-1.5 text-xs"
              >
                <div class="flex items-center gap-1.5 min-w-0">
                  <span class="font-medium text-foreground truncate">{{ item.user?.name || '未知用户' }}</span>
                  <span
                    v-if="item.content"
                    class="text-muted-foreground truncate"
                  >
                    · {{ item.content }}
                  </span>
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
              今日暂无已完成排队记录
            </div>
          </LiveSideCard>

          <LiveSideCard
            title="排队规则概况"
            action-label="调整规则"
            @action="activeMainTab = 'settings'"
          >
            <div class="space-y-2 text-xs">
              <div class="flex-between">
                <span class="text-muted-foreground">消队模式</span>
                <Badge
                  :variant="store.teamSize > 1 ? 'default' : 'secondary'"
                  size="xs"
                >
                  {{ store.teamSize > 1 ? `每车 ${store.teamSize} 人组队` : '单人模式' }}
                </Badge>
              </div>
              <div class="flex-between">
                <span class="text-muted-foreground">弹幕 / 礼物触发</span>
                <Badge
                  :variant="store.settings.keyword?.trim() ? 'success' : 'secondary'"
                  size="xs"
                >
                  {{
                    store.settings.keyword?.trim()
                      ? `关键词「${store.settings.keyword.trim()}」`
                      : store.settings.allowGift
                        ? '仅礼物触发'
                        : '仅手动'
                  }}
                </Badge>
              </div>
              <div
                v-if="store.settings.allowSC"
                class="flex-between"
              >
                <span class="text-muted-foreground">SC 排队</span>
                <Badge
                  variant="warning"
                  size="xs"
                >
                  {{ (store.settings.minSCPrice ?? 0) > 0 ? `≥ ¥${store.settings.minSCPrice}` : '任意 SC' }}
                </Badge>
              </div>
              <div class="flex-between">
                <span class="text-muted-foreground">网页自助排队</span>
                <Badge
                  :variant="store.settings.allowFromWeb ? 'success' : 'secondary'"
                  size="xs"
                >
                  {{ store.settings.allowFromWeb ? '开启' : '未开启' }}
                </Badge>
              </div>
              <div class="flex-between">
                <span class="text-muted-foreground">准入门槛</span>
                <span class="text-foreground font-medium">{{ eligibilitySummary }}</span>
              </div>
              <div class="flex-between">
                <span class="text-muted-foreground">积分入队 / 插队</span>
                <span class="font-mono text-foreground">
                  {{ store.settings.enablePointJoin ? `${store.settings.pointJoinCost ?? 0} 积分` : '免费' }}
                  /
                  {{
                    store.settings.allowPointPriority ? `${store.settings.pointPriorityCost ?? 0} 积分插队` : '未开启'
                  }}
                </span>
              </div>
            </div>
          </LiveSideCard>

          <LiveDashboardEntryCard
            panel-id="queue"
            panel-name="排队"
            shortcut="Alt + 6"
            description="在直播中控台可与弹幕、SC、礼物同屏管理本局车队，直接切下一队、补位顺延及单击复制游戏 ID。"
          />

          <LiveSideCard
            title="快捷测试"
            :icon="Flash24Regular"
          >
            <Button
              variant="outline"
              class="w-full justify-center"
              @click="injectMockUser"
            >
              <PersonAdd24Regular class="size-4 mr-1" />
              注入测试观众 (+1)
            </Button>
          </LiveSideCard>
        </template>
      </LiveConsoleCockpit>
    </template>

    <template #history>
      <QueueHistoryPanel />
    </template>

    <template #preview>
      <ObsStagePreview
        obs-path="obs/queue"
        :user-id="accountInfo?.id"
        recommended-size="推荐 OBS 来源尺寸：宽 360px ~ 420px，高 540px ~ 680px。"
      >
        <template #default="{ styleType, speedMultiplier }">
          <QueueOBS
            :id="accountInfo?.id"
            :key="`${accountInfo?.id}-${styleType}-${speedMultiplier}`"
            :theme-style="styleType"
            :speed-multiplier="speedMultiplier"
          />
        </template>

        <template #extra>
          <Card>
            <CardHeader class="p-3.5">
              <div class="flex items-center gap-2">
                <Flash24Regular class="size-4 text-muted-foreground" />
                <CardTitle class="text-sm">舞台仿真调试</CardTitle>
              </div>
            </CardHeader>
            <CardContent class="space-y-2">
              <Button
                variant="outline"
                class="w-full justify-center"
                @click="injectMockUser"
              >
                <PersonAdd24Regular class="size-4 mr-1" />
                注入测试观众 (+1)
              </Button>

              <Button
                v-if="store.unfilteredQueue.length > 0"
                variant="default"
                class="w-full justify-center"
                :disabled="store.isBatchLoading"
                @click="store.finishAndNextBatch()"
              >
                <Checkmark12Regular class="size-4 mr-1" />
                {{ store.teamSize > 1 ? `完成本局并拉下一队 (${store.teamSize}人)` : '完成并切换下一位' }}
              </Button>
            </CardContent>
          </Card>
        </template>
      </ObsStagePreview>
    </template>

    <template #settings>
      <QueueSettingsTab />
    </template>
  </LiveConsolePageShell>
</template>
