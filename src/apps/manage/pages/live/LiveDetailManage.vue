<script setup lang="ts">
import {
  ArrowLeft24Regular,
  Chat24Regular,
  DocumentBulletList24Regular,
  Mic24Regular,
  Open24Regular,
  DataPie24Regular,
} from '@vicons/fluent'
import {
  NButton,
  NCard,
  NEmpty,
  NFlex,
  NIcon,
  NSkeleton,
  NSpin,
  NTabPane,
  NTabs,
  NTag,
  NText,
  NTime,
  useMessage,
} from 'naive-ui'
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import type { DanmakuModel, ResponseLiveInfoModel } from '@/api/api-models'
import { EventDataTypes } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import DanmakuContainer from '@/apps/manage/components/live/DanmakuContainer.vue'
import LiveInfoContainer from '@/apps/manage/components/live/LiveInfoContainer.vue'
import LiveOverviewPanel from '@/apps/manage/components/live/LiveOverviewPanel.vue'
import LiveTranscriptPanel from '@/apps/manage/components/live/LiveTranscriptPanel.vue'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import { LIVE_API_URL } from '@/shared/config'
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
  const area = liveInfo.value.live.area ? `${liveInfo.value.live.parentArea ? `${liveInfo.value.live.parentArea} / ` : ''}${liveInfo.value.live.area}` : ''
  return `场次 ID: ${liveInfo.value.live.liveId}${area ? ` · ${area}` : ''}`
})

async function get() {
  isLoading.value = true
  loadError.value = null
  try {
    const data = await QueryGetAPI<ResponseLiveDetail>(`${LIVE_API_URL}get`, {
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

function handleTabChange(tab: string) {
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
  <div class="live-detail-view">
    <ManagePageHeader
      :title="pageTitle"
      :subtitle="pageSubtitle"
      :loading="isLoading"
    >
      <template #action>
        <NButton
          secondary
          size="small"
          @click="router.push({ name: 'manage-live' })"
        >
          <template #icon>
            <NIcon :component="ArrowLeft24Regular" />
          </template>
          返回列表
        </NButton>

        <NTag
          v-if="liveInfo"
          size="small"
          :bordered="false"
          :type="isLiveFinished ? 'default' : 'error'"
        >
          <span
            v-if="!isLiveFinished"
            class="live-status-dot"
          />
          {{ isLiveFinished ? '历史归档' : '实时直播中' }}
        </NTag>
      </template>
    </ManagePageHeader>

    <div
      v-if="isLoading"
      class="loading-skeleton"
    >
      <NCard size="small">
        <NSkeleton height="80px" />
      </NCard>
      <NCard size="small">
        <NSkeleton height="320px" />
      </NCard>
    </div>

    <template v-else-if="liveInfo">
      <!-- 场次简要信息条卡片 -->
      <NCard
        size="small"
        class="live-summary-card"
        :bordered="true"
      >
        <LiveInfoContainer
          :live="liveInfo.live"
          :show-actions="false"
        />
      </NCard>

      <!-- 三大工作台 Tab 切换 -->
      <div class="tabs-container">
        <NTabs
          :value="activeTab"
          type="segment"
          size="small"
          animated
          class="workbench-tabs"
          @update:value="handleTabChange"
        >
          <NTabPane
            name="overview"
            tab="本场复盘"
          >
            <template #tab>
              <NFlex align="center" :size="4">
                <NIcon :component="DataPie24Regular" />
                <span>本场复盘</span>
              </NFlex>
            </template>
            <LiveOverviewPanel
              :live="liveInfo.live"
              :danmakus="liveInfo.danmakus"
            />
          </NTabPane>

          <NTabPane
            name="danmaku"
            tab="弹幕与互动明细"
          >
            <template #tab>
              <NFlex align="center" :size="4">
                <NIcon :component="Chat24Regular" />
                <span>弹幕与互动明细</span>
              </NFlex>
            </template>
            <DanmakuContainer
              ref="danmakuContainerRef"
              :current-live="liveInfo.live"
              :current-danmakus="liveInfo.danmakus ?? []"
              height="640px"
              to="userDanmakus"
            />
          </NTabPane>

          <NTabPane
            name="transcript"
            tab="语音转写与切片"
          >
            <template #tab>
              <NFlex align="center" :size="4">
                <NIcon :component="Mic24Regular" />
                <span>语音转写与切片</span>
              </NFlex>
            </template>
            <LiveTranscriptPanel
              ref="transcriptPanelRef"
              :live-id="liveInfo.live.liveId"
            />
          </NTabPane>
        </NTabs>
      </div>
    </template>

    <div
      v-else
      class="empty-state-box"
    >
      <NCard size="small">
        <NEmpty description="未找到对应场次的直播数据">
          <template #extra>
            <NButton
              type="primary"
              secondary
              @click="loadInitialData"
            >
              重新加载
            </NButton>
          </template>
        </NEmpty>
      </NCard>
    </div>
  </div>
</template>

<style scoped>
.live-detail-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
}

.live-status-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #ef4444;
  margin-right: 6px;
  animation: pulse-red 1.5s infinite;
}

@keyframes pulse-red {
  0% {
    transform: scale(0.9);
    opacity: 0.7;
  }
  50% {
    transform: scale(1.3);
    opacity: 1;
  }
  100% {
    transform: scale(0.9);
    opacity: 0.7;
  }
}

.loading-skeleton {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.live-summary-card {
  border-radius: var(--vtsuru-radius);
  background-color: var(--vtsuru-card);
}

.tabs-container {
  margin-top: 2px;
}

.workbench-tabs {
  margin-bottom: 8px;
}

.empty-state-box {
  padding: 40px 0;
}
</style>
