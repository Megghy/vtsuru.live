<script setup lang="ts">
import { RPC } from '@mixer/postmessage-rpc'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import type { DirectClientAuthInfo } from '@/shared/services/DanmakuClients/DirectClient'
import DirectClient from '@/shared/services/DanmakuClients/DirectClient'
import OpenLiveClient from '@/shared/services/DanmakuClients/OpenLiveClient'
import { useWebFetcher } from '@/store/useWebFetcher'

const route = useRoute()
const webFetcher = useWebFetcher()
const reconnectCount = ref(0)
let rpc: RPC | undefined

const showHud = computed(() => {
  const raw = route.query.hud ?? route.query.debug
  return raw === '1' || raw === 'true'
})

const roomId = computed(() => {
  if (webFetcher.client instanceof OpenLiveClient) return webFetcher.client.roomAuthInfo?.anchor_info.room_id
  if (webFetcher.client instanceof DirectClient) return webFetcher.client.authInfo.roomId
  return undefined
})

const statusLabel = computed(() => {
  switch (webFetcher.state) {
    case 'connected':
      return '已连接'
    case 'connecting':
      return '连接中'
    default:
      return '未连接'
  }
})

function onGetDanmaku(data: any) {
  rpc?.call('on-get-danmaku', data, false)
}

let timer: any
onMounted(async () => {
  if (window.frameElement) {
    // 当是客户端组件时不自动启动, 需要客户端来启动以获取启动响应
    console.log('[web-fetcher-iframe] 当前为客户端组件')

    rpc = new RPC({
      target: window.parent,
      serviceId: 'web-fetcher',
      origin: '*',
    })

    rpc.expose('status', () => {
      return {
        status: webFetcher.state,
        type: webFetcher.webfetcherType,
        roomId:
          webFetcher.client instanceof OpenLiveClient
            ? webFetcher.client.roomAuthInfo?.anchor_info.room_id
            : webFetcher.client instanceof DirectClient
              ? webFetcher.client.authInfo.roomId
              : -1,
        startedAt: webFetcher.startedAt,
      }
    })

    rpc.expose(
      'start',
      async (data: { type: 'openlive' | 'direct'; directAuthInfo?: DirectClientAuthInfo; force: boolean }) => {
        console.log(`[web-fetcher-iframe] 接收到 ${data.force ? '强制' : ''}启动请求`)
        if (data.force && webFetcher.state === 'connected') {
          console.log('[web-fetcher-iframe] 强制启动, 停止当前实例')
          webFetcher.Stop()
        }
        const result = await webFetcher.Start(data.type, data.directAuthInfo, true)
        webFetcher.client?.on('all', onGetDanmaku)
        return result
      },
    )
    rpc.expose('stop', () => {
      console.log('[web-fetcher-iframe] 接收到停止请求')
      webFetcher.Stop()
    })
    rpc.expose('call-hub', (data: { name: string; args: any[] }) => {
      return webFetcher.signalRClient?.invoke(data.name, ...data.args)
    })

    setTimeout(() => {
      rpc?.call('ready', {}, false)
    }, 1000)

    console.log('[web-fetcher-iframe] RPC 初始化完成')
  } else {
    await webFetcher.Start()
  }
  setTimeout(() => {
    if (webFetcher.state !== 'connected' && window.obsstudio) {
      timer = setInterval(() => {
        if (webFetcher.state === 'connected') {
          return
        }

        reconnectCount.value += 1
        webFetcher.Stop()
        webFetcher.Start()
      }, 20000)
    }
  }, 10000)
})
onUnmounted(() => {
  clearInterval(timer)
  if (window.parent) {
    webFetcher.client?.off('all', onGetDanmaku)

    rpc?.destroy()
  }
})
</script>

<template>
  <div
    v-if="showHud"
    class="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/75 px-3 py-1.5 text-xs text-white backdrop-blur-sm shadow"
  >
    <span
      class="size-2.5 rounded-full shrink-0"
      :style="{
        backgroundColor: webFetcher.state === 'connected' ? '#6dc56d' : '#e34a4a',
      }"
    />
    <span class="font-medium">{{ statusLabel }}</span>
    <span
      v-if="roomId"
      class="text-white/70 font-mono"
    >
      #{{ roomId }}
    </span>
    <span
      v-if="reconnectCount > 0"
      class="text-amber-300 font-mono"
    >
      重连 {{ reconnectCount }}
    </span>
  </div>
  <div
    v-else
    class="web-fetcher-status"
    :title="`WebFetcher: ${statusLabel}${roomId ? ` (#${roomId})` : ''}`"
    :style="{
      backgroundColor: webFetcher.state === 'connected' ? '#6dc56d' : '#e34a4a',
    }"
  />
</template>

<style scoped>
.web-fetcher-status {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  box-shadow: 0 0 5px 1px rgba(0, 0, 0, 0.2);
  border: 3px solid #00000033;
  animation: animated-border 3s infinite;
  transition: background-color 0.5s;
}

@keyframes animated-border {
  0% {
    box-shadow: 0 0 0px #589580;
  }

  100% {
    box-shadow: 0 0 0 6px rgba(255, 255, 255, 0);
  }
}
</style>
