<script setup lang="ts">
import type { DanmakuModel, ResponseLiveInfoModel } from '@/api/api-models'
import { EventDataTypes } from '@/api/api-models'
import { NButton, NEmpty, NSpin, useMessage, useThemeVars } from 'naive-ui'
import { computed, onActivated, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { QueryGetAPI } from '@/api/query'
import DanmakuContainer from '@/apps/manage/components/live/DanmakuContainer.vue'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import { useVTsuruHub } from '@/store/useVTsuruHub'
import { LIVE_API_URL } from '@/shared/config'

interface ResponseLiveDetail {
  live: ResponseLiveInfoModel
  danmakus: DanmakuModel[]
}

const message = useMessage()
const themeVars = useThemeVars()
const route = useRoute()
const router = useRouter()
const hub = useVTsuruHub()

const isLoading = ref(true)
const loadError = ref<string | null>(null)
const liveInfo = ref<ResponseLiveDetail | undefined>()
const danmakuContainerRef = ref<InstanceType<typeof DanmakuContainer> | null>(null)

const pageTitle = computed(() => liveInfo.value?.live?.title || '直播详情')
const pageSubtitle = computed(() => {
  const id = String(route.params.id ?? '')
  return id ? `LiveID: ${id}` : undefined
})

const receivingPillStyle = computed(() => ({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '4px 12px',
  background: themeVars.value.successColorSuppl,
  border: `1px solid ${themeVars.value.successColor}`,
  borderRadius: '9999px',
  color: themeVars.value.successColor,
  fontSize: '13px',
  fontWeight: 500,
}))

const receivingDotStyle = computed(() => ({
  display: 'inline-block',
  width: '6px',
  height: '6px',
  background: themeVars.value.successColor,
  borderRadius: '50%',
  marginRight: '6px',
}))

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
  <NSpin :show="isLoading">
    <template v-if="!isLoading">
      <ManagePageHeader :title="pageTitle" :subtitle="pageSubtitle">
        <template #action>
          <NButton secondary size="small" @click="router.push({ name: 'manage-live' })">
            返回
          </NButton>
          <span :style="receivingPillStyle">
            <span :style="receivingDotStyle" />
            实时接收中
          </span>
        </template>
      </ManagePageHeader>
      <DanmakuContainer
        v-if="liveInfo"
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
      <NEmpty
        v-else
        description="无数据"
      >
        <template #extra>
          <NButton type="primary" @click="loadInitialData">
            重试
          </NButton>
        </template>
      </NEmpty>
    </template>
  </NSpin>
</template>

