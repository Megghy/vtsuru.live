<script setup lang="ts">
import { useWebFetcher } from '@/store/useWebFetcher'
import { onMounted, onUnmounted, ref } from 'vue'
import { RPC } from '@mixer/postmessage-rpc'
import DirectClient, { DirectClientAuthInfo } from '@/data/DanmakuClients/DirectClient';
import OpenLiveClient from '@/data/DanmakuClients/OpenLiveClient';

const webFetcher = useWebFetcher()
let rpc: RPC | undefined

type QueryData = {
  url: string;
  headers?: { [key: string]: string };
  body?: any;
}

function onGetDanmaku(data: any) {
  rpc?.call('on-get-danmaku', data, false)
}

let timer: any
onMounted(async () => {
  if (window.parent) { //当是客户端组件时不自动启动, 需要客户端来启动以获取启动响应
    console.log('[web-fetcher-iframe] 当前为客户端组件')

    rpc = new RPC({
      target: window.parent,
      serviceId: 'web-fetcher',
      origin: '*'
    })

    rpc.expose('status', () => {
      return {
        status: webFetcher.isStarted ? 'running' : 'stopped',
        type: webFetcher.client?.type,
        roomId: webFetcher.client instanceof OpenLiveClient ?
          webFetcher.client.roomAuthInfo?.anchor_info.room_id :
          webFetcher.client instanceof DirectClient ?
            webFetcher.client.authInfo.roomId : -1,
        startedAt: webFetcher.startedAt,

      }
    })

    rpc.expose('start', async (data: { type: 'openlive' | 'direct', directAuthInfo?: DirectClientAuthInfo, force: boolean }) => {
      console.log('[web-fetcher-iframe] 接收到 ' + (data.force ? '强制' : '') + '启动请求')
      if (data.force && webFetcher.isStarted) {
        webFetcher.Stop()
      }
      return await webFetcher.Start(data.type, data.directAuthInfo, true).then((result) => {
        webFetcher.client?.on('all', (data) => onGetDanmaku(data))
      })
    })
    rpc.expose('stop', () => {
      console.log('[web-fetcher-iframe] 接收到停止请求')
      webFetcher.Stop()
    })
    rpc.expose('call-hub', (data: {
      name: string;
      args: any[];
    }) => {
      return webFetcher.signalRClient?.invoke(data.name, ...data.args)
    })

    setTimeout(() => {
      rpc?.call('ready', {}, false)
    }, 1000);

    console.log('[web-fetcher-iframe] RPC 初始化完成')
  }
  else {
    await webFetcher.Start()
  }
  setTimeout(() => {
    // @ts-expect-error obs的东西
    if (!webFetcher.isStarted && window.obsstudio) {
      timer = setInterval(() => {
        if (webFetcher.isStarted) {
          return
        }

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
  <div class="web-fetcher-status" :style="{
    backgroundColor: webFetcher.isStarted ? '#6dc56d' : '#e34a4a',
  }"></div>
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
