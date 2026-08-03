<script setup lang="ts">
import { showErrorToast } from '@/shared/services/toast'
import { computed, onActivated, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import type { DanmakuModel, ResponseLiveInfoModel } from '@/api/api-models'
import { EventDataTypes } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import DanmakuContainer from '@/apps/manage/components/live/DanmakuContainer.vue'
import LiveTranscriptPanel from '@/apps/manage/components/live/LiveTranscriptPanel.vue'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import { LIVE_API_URL } from '@/shared/config'
import { useVTsuruHub } from '@/store/useVTsuruHub'

interface ResponseLiveDetail {
  live: ResponseLiveInfoModel
  danmakus: DanmakuModel[]
}
const route = useRoute()
const router = useRouter()
const hub = useVTsuruHub()

const isLoading = ref(true)
const loadError = ref<string | null>(null)
const liveInfo = ref<ResponseLiveDetail | undefined>()
const danmakuContainerRef = ref<InstanceType<typeof DanmakuContainer> | null>(null)
const transcriptPanelRef = ref<InstanceType<typeof LiveTranscriptPanel> | null>(null)
const activeTab = ref<'danmaku' | 'transcript'>('danmaku')

const pageTitle = computed(() => liveInfo.value?.live?.title || '直播详情')
const pageSubtitle = computed(() => {
  const id = String(route.params.id ?? '')
  return id ? `LiveID: ${id}` : undefined
})

async function get() {
  isLoading.value = true
  loadError.value = null
  try {
    const data = await QueryGetAPI<ResponseLiveDetail>(`${LIVE_API_URL}get`, {
      id: String(route.params.id ?? ''),
      useEmoji: true,
    })
    if (data.code == 200) {
      return data.data
    } else {
      const msg = `无法获取数据: ${data.message}`
      showErrorToast(msg)
      loadError.value = data.message
      return undefined
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : '无法获取数据'
    showErrorToast(msg)
    loadError.value = msg
  } finally {
    isLoading.value = false
  }
  return undefined
}

async function loadInitialData() {
  const data = await get()
  if (data) {
    liveInfo.value = data
  }
}

function onNewDanmaku(event: DanmakuModel) {
  if (!liveInfo.value) return
  console.log('New Danmaku:', event)

  danmakuContainerRef.value?.InsertDanmakus([event])

  // 更新统计信息
  if (event.price && event.price > 0) {
    liveInfo.value.live.totalIncome += event.price
  }
  if (event.type === EventDataTypes.Message) {
    liveInfo.value.live.danmakusCount++
  }
}

function handleTabChange(tab: string) {
  activeTab.value = tab as 'danmaku' | 'transcript'
  if (tab === 'transcript') {
    nextTick(() => transcriptPanelRef.value?.load())
  }
}

onMounted(async () => {
  await loadInitialData()
  await hub.Init()
  await hub.on('NewDanmaku', onNewDanmaku)
})

onActivated(async () => {
  if (liveInfo.value?.live.liveId != String(route.params.id ?? '')) {
    await loadInitialData()
  }
})

onBeforeUnmount(async () => {
  await hub.off('NewDanmaku', onNewDanmaku)
})
</script>

<template>
  <div :aria-busy="isLoading">
    <template v-if="!isLoading">
      <ManagePageHeader
        :title="pageTitle"
        :subtitle="pageSubtitle"
      >
        <template #action>
          <UButton
            color="neutral"
            variant="soft"
            size="sm"
            @click="router.push({ name: 'manage-live' })"
          >
            返回
          </UButton>
          <span class="receiving-pill"><span class="receiving-dot" />
            实时接收中
          </span>
        </template>
      </ManagePageHeader>
      <UTabs
        v-if="liveInfo"
        v-model="activeTab"
        :items="[{ label: '弹幕记录', value: 'danmaku' }, { label: '语音转写', value: 'transcript' }]"
        :content="false"
        @update:model-value="handleTabChange"
      />
      <section v-if="liveInfo" v-show="activeTab === 'danmaku'">
          <DanmakuContainer
            ref="danmakuContainerRef"
            :current-live="liveInfo.live"
            :current-danmakus="liveInfo.danmakus"
            :height="750"
            show-rank
            show-liver
            show-live-info
            show-tools
            show-name
            to="userDanmakus"
            :item-range="100"
            :item-height="25"
          />
      </section>
      <section v-if="liveInfo" v-show="activeTab === 'transcript'">
          <LiveTranscriptPanel
            ref="transcriptPanelRef"
            :live-id="liveInfo.live.liveId"
          />
      </section>
      <UEmpty
        v-else
        description="无数据"
      >
        <template #extra>
          <UButton
            @click="loadInitialData"
          >
            重试
          </UButton>
        </template>
      </UEmpty>
    </template>
  </div>
</template>

<style scoped>
.receiving-pill { display:inline-flex; align-items:center; padding:4px 12px; color:var(--vtsuru-success); font-size:13px; font-weight:500; background:var(--vtsuru-success-soft); border:1px solid var(--vtsuru-success); border-radius:999px; }.receiving-dot { width:6px; height:6px; margin-right:6px; background:var(--vtsuru-success); border-radius:50%; }
</style>
