<script setup lang="ts">
import ArrowLeft24Regular from '@vicons/fluent/es/ArrowLeft24Regular'
import Chat24Regular from '@vicons/fluent/es/Chat24Regular'
import DataPie24Regular from '@vicons/fluent/es/DataPie24Regular'
import Mic24Regular from '@vicons/fluent/es/Mic24Regular'
import { Check, Film, Loader2, Sparkles, UserRoundSearch } from 'lucide-vue-next'
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAccount } from '@/api/account'
import { useLiveEmoji } from '@/store/useLiveEmoji'
import type { DanmakuModel } from '@/api/client-types'
import {
  extractLiveFanFacts,
  type ExtractLiveFactsResponse,
  resolveFanCandidateFact,
} from '@/api/fanProfile'
import { getApiLiveGet } from '@/api/generated/live/live'
import type { ResponseLiveInfoModel } from '@/api/generated/model'
import { EventDataTypes } from '@/api/generated/model'
import DanmakuContainer from '@/apps/manage/components/live/DanmakuContainer.vue'
import LiveInfoContainer from '@/apps/manage/components/live/LiveInfoContainer.vue'
import LiveOverviewPanel from '@/apps/manage/components/live/LiveOverviewPanel.vue'
import LiveReplayPanel from '@/apps/manage/components/live/LiveReplayPanel.vue'
import LiveTranscriptPanel from '@/apps/manage/components/live/LiveTranscriptPanel.vue'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import { useRealtimeTopic } from '@/shared/realtime'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Skeleton } from '@/shared/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { useMessage } from '@/shared/utils'

interface ResponseLiveDetail {
  live: ResponseLiveInfoModel
  danmakus: DanmakuModel[]
}

const message = useMessage()
const route = useRoute()
const router = useRouter()
const account = useAccount()
const userEventsTopic = computed(() => (account.value.id > 0 ? `user:events:${account.value.id}` : ''))
const { on: onUserEvent } = useRealtimeTopic(userEventsTopic)

const isLoading = ref(true)
const loadError = ref<string | null>(null)
const liveInfo = ref<ResponseLiveDetail | undefined>()
const danmakuContainerRef = ref<InstanceType<typeof DanmakuContainer> | null>(null)
const transcriptPanelRef = ref<InstanceType<typeof LiveTranscriptPanel> | null>(null)

const activeTab = ref<'overview' | 'danmaku' | 'transcript' | 'replay'>('overview')

const isLiveFinished = computed(() => liveInfo.value?.live?.isFinish === true)

// 本场 AI 粉丝情报挖掘
const extractingFacts = ref(false)
const extractDialogOpen = ref(false)
const extractResult = ref<ExtractLiveFactsResponse | null>(null)

async function handleExtractFanFacts() {
  if (!liveInfo.value || extractingFacts.value) return
  extractingFacts.value = true
  extractDialogOpen.value = true
  try {
    const res = await extractLiveFanFacts(liveInfo.value.live.liveId)
    if (res.code === 200 && res.data) {
      extractResult.value = res.data
      if (res.data.newFactsCount > 0) {
        message.success(`从本场 ${res.data.scannedMessages} 条样本中挖掘出 ${res.data.newFactsCount} 条新线索`)
      } else {
        message.info(`已扫描 ${res.data.scannedMessages} 条互动，本场暂无新的个人情报`)
      }
    } else {
      message.error(res.message || '情报挖掘失败')
    }
  } finally {
    extractingFacts.value = false
  }
}

async function handleResolveExtractedFact(ouid: string, factId: string, accept: boolean) {
  const res = await resolveFanCandidateFact({ oUId: ouid, factId, accept })
  if (res.code === 200) {
    if (extractResult.value) {
      extractResult.value.items = extractResult.value.items.filter((i) => i.fact.id !== factId)
    }
    message.success(accept ? '已采纳写入粉丝档案' : '已忽略该线索')
  } else {
    message.error(res.message || '操作失败')
  }
}

const pageTitle = computed(() => liveInfo.value?.live?.title || '直播详情')
const pageSubtitle = computed(() => {
  if (!liveInfo.value) return undefined
  const area = liveInfo.value.live.area
    ? `${liveInfo.value.live.parentArea ? `${liveInfo.value.live.parentArea} / ` : ''}${liveInfo.value.live.area}`
    : ''
  return `场次 ID: ${liveInfo.value.live.liveId}${area ? ` · ${area}` : ''}`
})

async function get() {
  isLoading.value = true
  loadError.value = null
  try {
    const data = await getApiLiveGet({
      id: String(route.params.id ?? ''),
      useEmoji: true,
      includeDanmakus: true,
    })
    if (data.code === 200 && data.data) {
      return data.data
    } else {
      const msg = `无法获取数据: ${data.message}`
      message.error(msg)
      loadError.value = data.message
      return undefined
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : '无法获取数据'
    message.error(msg)
    loadError.value = msg
  } finally {
    isLoading.value = false
  }
  return undefined
}

let loadingId = ''

async function loadInitialData() {
  const id = String(route.params.id ?? '')
  if (isLoading.value && loadingId === id) return
  if (liveInfo.value?.live.liveId === id) return
  loadingId = id
  const data = await get()
  if (data) {
    liveInfo.value = data
  }
}

function onNewDanmaku(event: DanmakuModel) {
  if (!liveInfo.value || liveInfo.value.live.isFinish) return

  danmakuContainerRef.value?.InsertDanmakus([event])

  if (event.price && event.price > 0) {
    liveInfo.value.live.totalIncome += event.price
  }
  if (event.type === EventDataTypes.Message) {
    liveInfo.value.live.danmakusCount++
  }
}

function handleTabChange(tab: string | number) {
  activeTab.value = tab as 'overview' | 'danmaku' | 'transcript' | 'replay'
  if (tab === 'transcript') {
    nextTick(() => transcriptPanelRef.value?.load())
  }
}

onUserEvent<DanmakuModel>('NewDanmaku', onNewDanmaku)

onMounted(async () => {
  if (account.value.biliRoomId > 0) {
    void useLiveEmoji().ensureRoomEmojis(account.value.biliRoomId)
  }
  await loadInitialData()
})
</script>

<template>
  <div class="space-y-4 w-full">
    <ManagePageHeader
      :title="pageTitle"
      :subtitle="pageSubtitle"
    >
      <template #action>
        <div class="flex items-center gap-2">
          <Button
            v-if="liveInfo && isLiveFinished && liveInfo.live.danmakusCount > 0"
            size="xs"
            variant="outline"
            :disabled="extractingFacts"
            @click="handleExtractFanFacts"
          >
            <Loader2
              v-if="extractingFacts"
              class="h-3.5 w-3.5 mr-1 animate-spin"
            />
            <Sparkles
              v-else
              class="h-3.5 w-3.5 mr-1"
            />
            AI 挖掘粉丝情报
          </Button>

          <Button
            size="xs"
            variant="outline"
            @click="router.push({ name: 'manage-live' })"
          >
            <component
              :is="ArrowLeft24Regular"
              class="h-3.5 w-3.5 mr-1"
            />
            返回列表
          </Button>

          <Badge
            v-if="liveInfo"
            :variant="isLiveFinished ? 'secondary' : 'destructive'"
            size="xs"
            class="h-5"
          >
            <span
              v-if="!isLiveFinished"
              class="w-1.5 h-1.5 rounded-full bg-white mr-1 animate-pulse"
            />
            {{ isLiveFinished ? '历史归档' : '实时直播中' }}
          </Badge>
        </div>
      </template>
    </ManagePageHeader>

    <div
      v-if="isLoading"
      class="space-y-3"
    >
      <Skeleton class="h-24 rounded-lg" />
      <Skeleton class="h-80 rounded-lg" />
    </div>

    <template v-else-if="liveInfo">
      <!-- 场次简要信息条卡片 -->
      <LiveInfoContainer
        :live="liveInfo.live"
        :show-actions="false"
      />

      <!-- 三大工作台 Tab 切换 -->
      <Tabs
        :model-value="activeTab"
        class="w-full space-y-4"
        @update:model-value="handleTabChange"
      >
        <TabsList class="grid grid-cols-4 w-full sm:w-[460px]">
          <TabsTrigger value="overview">
            <component
              :is="DataPie24Regular"
              class="h-3.5 w-3.5 mr-1"
            />
            本场复盘
          </TabsTrigger>
          <TabsTrigger value="danmaku">
            <component
              :is="Chat24Regular"
              class="h-3.5 w-3.5 mr-1"
            />
            弹幕互动
          </TabsTrigger>
          <TabsTrigger value="transcript">
            <component
              :is="Mic24Regular"
              class="h-3.5 w-3.5 mr-1"
            />
            语音转写
          </TabsTrigger>
          <TabsTrigger value="replay">
            <Film class="size-3.5 mr-1" />
            录播与空降
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="overview"
          class="space-y-4"
        >
          <LiveOverviewPanel
            :live="liveInfo.live"
            :danmakus="liveInfo.danmakus"
          />
        </TabsContent>

        <TabsContent
          value="danmaku"
          class="space-y-4"
        >
          <DanmakuContainer
            ref="danmakuContainerRef"
            :current-live="liveInfo.live"
            :current-danmakus="liveInfo.danmakus ?? []"
            height="640px"
            to="userDanmakus"
          />
        </TabsContent>

        <TabsContent
          value="transcript"
          class="space-y-4"
        >
          <LiveTranscriptPanel
            ref="transcriptPanelRef"
            :live-id="liveInfo.live.liveId"
          />
        </TabsContent>

        <TabsContent
          value="replay"
          class="space-y-4"
        >
          <LiveReplayPanel :live-id="liveInfo.live.liveId" />
        </TabsContent>
      </Tabs>
    </template>

    <Card
      v-else
      class="p-12 text-center"
    >
      <div class="text-muted-foreground text-sm">未找到对应场次的直播数据</div>
      <div class="mt-3">
        <Button
          size="xs"
          variant="brand"
          @click="loadInitialData"
        >
          重新加载
        </Button>
      </div>
    </Card>

    <Dialog v-model:open="extractDialogOpen">
      <DialogContent class="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-1.5">
            <Sparkles class="size-4 text-primary" />
            本场 AI 粉丝情报挖掘
          </DialogTitle>
          <DialogDescription>
            自动扫描本场 SC、高价值互动与长弹幕，提取粉丝生日、考试、职业、喜好等候选事实；采纳后写入对应粉丝档案。
          </DialogDescription>
        </DialogHeader>

        <div
          v-if="extractingFacts"
          class="py-8 flex-center gap-2 text-xs text-muted-foreground"
        >
          <Loader2 class="size-4 animate-spin" />
          正在分析本场互动记录…
        </div>

        <div
          v-else-if="extractResult"
          class="space-y-2.5 max-h-[380px] overflow-y-auto scrollbar-thin"
        >
          <div class="text-[11px] text-muted-foreground tabular-nums">
            已扫描 {{ extractResult.scannedMessages }} 条样本，待审核线索 {{ extractResult.items.length }} 条
          </div>

          <div
            v-if="extractResult.items.length === 0"
            class="py-6 text-center text-xs text-muted-foreground"
          >
            暂无待审核线索
          </div>

          <div
            v-for="item in extractResult.items"
            :key="item.fact.id"
            class="rounded-md border border-border bg-card p-2.5 space-y-1.5"
          >
            <div class="flex-between gap-2">
              <div class="flex items-center gap-1.5 min-w-0">
                <span class="text-xs font-semibold truncate">{{ item.fanName }}</span>
                <Badge
                  variant="outline"
                  class="text-[10px]"
                  >{{ item.fact.label }}</Badge
                >
                <span class="text-xs text-foreground truncate">{{ item.fact.value }}</span>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <Button
                  size="xs"
                  variant="ghost"
                  @click="router.push({ name: 'manage-fans', query: { ouid: item.canonicalOUId } })"
                >
                  <UserRoundSearch class="size-3" />
                </Button>
                <Button
                  size="xs"
                  variant="secondary"
                  @click="handleResolveExtractedFact(item.canonicalOUId, item.fact.id, true)"
                >
                  <Check class="size-3 mr-0.5" />
                  采纳
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  class="text-muted-foreground"
                  @click="handleResolveExtractedFact(item.canonicalOUId, item.fact.id, false)"
                >
                  忽略
                </Button>
              </div>
            </div>
            <p
              v-if="item.fact.evidence"
              class="text-[11px] text-muted-foreground wrap-anywhere"
            >
              「{{ item.fact.evidence }}」
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
