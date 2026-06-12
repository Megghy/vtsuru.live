<script setup lang="ts">
import { AlertCircleOutline, CheckmarkCircleOutline, TimeOutline, TimerOutline, WifiOutline } from '@vicons/ionicons5'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useWebFetcher } from '@/store/useWebFetcher'

const webfetcher = useWebFetcher()

const uptime = ref<string>('N/A')
const networkStatus = ref<'online' | 'offline'>(navigator.onLine ? 'online' : 'offline')
let uptimeTimer: number | undefined

const isConnected = computed(() => webfetcher.state === 'connected')
const connectionStatusType = computed(() => {
  switch (webfetcher.state) {
    case 'connected': return 'success'
    case 'connecting': return 'info'
    case 'disconnected': return 'error'
    default: return 'default'
  }
})
const connectionStatusText = computed(() => {
  switch (webfetcher.state) {
    case 'connected': return '运行中'
    case 'connecting': return '连接中'
    case 'disconnected': return '已停止'
    default: return '未知'
  }
})
const formattedStartedAt = computed(() =>
  webfetcher.startedAt ? new Date(webfetcher.startedAt).toLocaleString() : 'N/A')

const danmakuClientStateText = computed(() => {
  switch (webfetcher.danmakuClientState) {
    case 'connected': return '已连接'
    case 'connecting': return '连接中'
    case 'stopped': return '已停止'
    default: return '未知'
  }
})
const danmakuClientStateType = computed(() => {
  switch (webfetcher.danmakuClientState) {
    case 'connected': return 'success'
    case 'connecting': return 'info'
    case 'stopped': return 'error'
    default: return 'default'
  }
})
const signalRStateText = computed(() => {
  switch (webfetcher.state) {
    case 'connected': return '已连接'
    case 'connecting': return '连接中'
    case 'disconnected': return '已断开'
    default: return '未知'
  }
})

function updateUptime() {
  if (webfetcher.startedAt) {
    uptime.value = formatDistanceToNow(new Date(webfetcher.startedAt), { addSuffix: true, locale: zhCN })
  } else {
    uptime.value = 'N/A'
    clearInterval(uptimeTimer)
    uptimeTimer = undefined
  }
}

function onNetworkChange() {
  networkStatus.value = navigator.onLine ? 'online' : 'offline'
}

onMounted(() => {
  updateUptime()
  uptimeTimer = window.setInterval(updateUptime, 60 * 1000)
  window.addEventListener('online', onNetworkChange)
  window.addEventListener('offline', onNetworkChange)
})
onUnmounted(() => {
  clearInterval(uptimeTimer)
  window.removeEventListener('online', onNetworkChange)
  window.removeEventListener('offline', onNetworkChange)
})
</script>

<template>
  <NCard
    title="运行状态 & 连接"
    size="small"
    bordered
    style="width: 100%;"
  >
    <template #header-extra>
      <NTag :type="connectionStatusType" size="small">
        <template #icon>
          <NIcon :component="isConnected ? CheckmarkCircleOutline : AlertCircleOutline" />
        </template>
        {{ connectionStatusText }}
      </NTag>
    </template>
    <NDescriptions
      label-placement="top"
      bordered
      :columns="2"
      size="small"
      style="overflow-x: auto;"
    >
      <NDescriptionsItem label="启动时间">
        <NIcon :component="TimeOutline" /> {{ formattedStartedAt }}
      </NDescriptionsItem>
      <NDescriptionsItem label="运行时长">
        <NIcon :component="TimerOutline" /> {{ uptime }}
      </NDescriptionsItem>
      <NDescriptionsItem label="SignalR 服务">
        <NFlex align="center" size="small" :wrap="false">
          <NTag :type="connectionStatusType" size="tiny">
            {{ signalRStateText }}
          </NTag>
          <NEllipsis style="max-width: 150px;">
            {{ webfetcher.signalRId ?? 'N/A' }}
          </NEllipsis>
        </NFlex>
      </NDescriptionsItem>
      <NDescriptionsItem label="弹幕服务器">
        <NFlex align="center" size="small" :wrap="false">
          <NTag :type="danmakuClientStateType" size="tiny">
            {{ danmakuClientStateText }}
          </NTag>
          <NEllipsis style="max-width: 150px;">
            {{ webfetcher.danmakuServerUrl ?? 'N/A' }}
          </NEllipsis>
        </NFlex>
      </NDescriptionsItem>
      <NDescriptionsItem label="网络状态">
        <NFlex align="center" size="small">
          <NTag :type="networkStatus === 'online' ? 'success' : 'error'" size="tiny">
            <template #icon>
              <NIcon :component="WifiOutline" />
            </template>
            {{ networkStatus === 'online' ? '在线' : '离线' }}
          </NTag>
        </NFlex>
      </NDescriptionsItem>
    </NDescriptions>
  </NCard>
</template>
