import DanmakuClient from '@/data/DanmakuClient'
import { BASE_HUB_URL } from '@/data/constants'
import * as signalR from '@microsoft/signalr'
import * as msgpack from '@microsoft/signalr-protocol-msgpack'
import { useLocalStorage } from '@vueuse/core'
import { format } from 'date-fns'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useRoute } from 'vue-router'

export const useWebFetcher = defineStore('WebFetcher', () => {
  const cookie = useLocalStorage('JWT_Token', '')
  const route = useRoute()

  const client = new DanmakuClient(null)

  const events: string[] = []
  const isStarted = ref(false)
  let timer: any
  let signalRClient: signalR.HubConnection | null = null
  let disconnectedByServer = false

  async function Start() {
    if (isStarted.value) {
      return
    }
    while (!(await connectSignalR())) {
      console.log('[WEB-FETCHER] 连接失败, 5秒后重试')
      await new Promise((resolve) => setTimeout(resolve, 5000))
    }
  }
  function Stop() {
    if (!isStarted.value) {
      return
    }
    isStarted.value = false
    client.Stop()
    if (timer) {
      clearInterval(timer)
      timer = undefined
    }
    signalRClient?.stop()
    signalRClient = null
  }
  async function connectDanmakuClient() {
    console.log('[WEB-FETCHER] 正在连接弹幕客户端...')
    const result = await client.Start()
    if (result.success) {
      console.log('[WEB-FETCHER] 加载完成, 开始监听弹幕')
      client.onEvent('all', onGetDanmakus)
      timer ??= setInterval(() => {
        sendEvents()
      }, 1500)
    } else {
      console.log('[WEB-FETCHER] 弹幕客户端启动失败: ' + result.message)
    }
    return result
  }
  async function connectSignalR() {
    console.log('[WEB-FETCHER] 正在连接到 vtsuru 服务器...')
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(BASE_HUB_URL + 'web-fetcher?token=' + route.query.token, {
        headers: {
          Authorization: `Bearer ${cookie.value}`,
        },
        skipNegotiation: true,
        transport: signalR.HttpTransportType.WebSockets,
      })
      .withAutomaticReconnect([0, 2000, 10000, 30000])
      .withHubProtocol(new msgpack.MessagePackHubProtocol())
      .build()
    connection.on('Disconnect', (reason: unknown) => {
      console.log('[WEB-FETCHER] 被服务器断开连接: ' + reason)
      disconnectedByServer = true
      connection.stop()
      signalRClient = null
    })
    connection.on('ConnectClient', async () => {
      if (client.isRunning) {
        return
      }
      let result = await connectDanmakuClient()
      while (!result.success) {
        console.log('[WEB-FETCHER] 弹幕客户端启动失败, 5秒后重试')
        await new Promise((resolve) => setTimeout(resolve, 5000))
        result = await connectDanmakuClient()
      }
      isStarted.value = true
    })

    connection.onclose(reconnect)
    try {
      await connection.start()
      console.log('[WEB-FETCHER] 已连接到 vtsuru 服务器')
      signalRClient = connection
      return true
    } catch (e) {
      console.log('[WEB-FETCHER] 无法连接到 vtsuru 服务器: ' + e)
      return false
    }
  }
  async function reconnect() {
    if (disconnectedByServer) {
      return
    }
    try {
      await signalRClient?.start()
      console.log('[WEB-FETCHER] 已重新连接')
    } catch (err) {
      console.log(err)
      setTimeout(reconnect, 5000) // 如果连接失败，则每5秒尝试一次重新启动连接
    }
  }
  function onGetDanmakus(command: any) {
    events.push(command)
  }
  async function sendEvents() {
    if (signalRClient?.state !== 'Connected') {
      return
    }
    let tempEvents: string[] = []
    let count = events.length
    if (events.length > 20) {
      tempEvents = events.slice(0, 20)
      count = 20
    } else {
      tempEvents = events
      count = events.length
    }
    if (tempEvents.length > 0) {
      const result = await signalRClient?.invoke<{
        Success: boolean
        Message: string
      }>('UploadEvents', tempEvents, false)
      if (result?.Success) {
        events.splice(0, count)
        console.log(`[WEB-FETCHER] <${format(new Date(), 'HH:mm:ss')}> 上传了 ${count} 条弹幕`)
      } else {
        console.error('[WEB-FETCHER] 上传弹幕失败: ' + result?.Message)
      }
    }
  }

  return {
    Start,
    Stop,
    client,
    isStarted,
  }
})
