<script setup lang="ts">
import { ArrowLeft24Regular, Chat24Regular, DataPie24Regular, Mic24Regular } from '@vicons/fluent'
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import type { DanmakuModel } from '@/api/client-types'
import { getApiLiveGet } from '@/api/generated/live/live'
import type { ResponseLiveInfoModel } from '@/api/generated/model'
import { EventDataTypes } from '@/api/generated/model'
import DanmakuContainer from '@/apps/manage/components/live/DanmakuContainer.vue'
import LiveInfoContainer from '@/apps/manage/components/live/LiveInfoContainer.vue'
import LiveOverviewPanel from '@/apps/manage/components/live/LiveOverviewPanel.vue'
import LiveTranscriptPanel from '@/apps/manage/components/live/LiveTranscriptPanel.vue'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Skeleton } from '@/shared/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { useMessage } from '@/shared/utils'
import { useVTsuruHub } from '@/store/useVTsuruHub'

interface ResponseLiveDetail {
  live: ResponseLiveInfoModel
  danmakus: DanmakuModel[]
}

const message = useMessage()
const route = useRoute()
const router = useRouter()
const hub = useVTsuruHub()

const isLoading = ref(true)
const loadError = ref<string | null>(null)
const liveInfo = ref<ResponseLiveDetail | undefined>()
const danmakuContainerRef = ref<InstanceType<typeof DanmakuContainer> | null>(null)
const transcriptPanelRef = ref<InstanceType<typeof LiveTranscriptPanel> | null>(null)

const activeTab = ref<'overview' | 'danmaku' | 'transcript'>('overview')

const isLiveFinished = computed(() => liveInfo.value?.live?.isFinish === true)

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
    const data = (await getApiLiveGet({
      id: String(route.params.id ?? ''),
      useEmoji: true,
      includeDanmakus: true,
    })) as unknown as {
      code: number
      message?: string
      data?: ResponseLiveDetail
    }
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
  activeTab.value = tab as 'overview' | 'danmaku' | 'transcript'
  if (tab === 'transcript') {
    nextTick(() => transcriptPanelRef.value?.load())
  }
}

onMounted(async () => {
  await loadInitialData()
  await hub.Init()
  await hub.on('NewDanmaku', onNewDanmaku)
})

onBeforeUnmount(async () => {
  await hub.off('NewDanmaku', onNewDanmaku)
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
            class="text-[10px] px-1.5 py-0 h-5"
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
        <TabsList class="grid grid-cols-3 w-full sm:w-96">
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
  </div>
</template>
