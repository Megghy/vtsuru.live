import { BASE_HUB_URL } from '@/data/constants'
import BaseDanmakuClient from '@/data/DanmakuClients/BaseDanmakuClient'
import DirectClient, {
  DirectClientAuthInfo
} from '@/data/DanmakuClients/DirectClient'
import OpenLiveClient from '@/data/DanmakuClients/OpenLiveClient'
import * as signalR from '@microsoft/signalr'
import * as msgpack from '@microsoft/signalr-protocol-msgpack'
import { useLocalStorage } from '@vueuse/core'
import { format } from 'date-fns'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { compress } from 'brotli-compress'

export const useWebFetcher = defineStore('WebFetcher', () => {
  const cookie = useLocalStorage('JWT_Token', '')
  const route = useRoute()
  const startedAt = ref<Date>()

  const client = ref<BaseDanmakuClient>()
  const signalRClient = ref<signalR.HubConnection>()

  const events: string[] = []
  const isStarted = ref(false)
  let timer: any
  let disconnectedByServer = false
  let useCookie = false
  /**
   * 是否来自Tauri客户端
   */
  let isFromClient = false
  const prefix = computed(() => {
    if (isFromClient) {
      return '[web-fetcher-iframe] '
    }
    return '[web-fetcher] '
  })
  async function restartDanmakuClient(
    type: 'openlive' | 'direct',
    directAuthInfo?: DirectClientAuthInfo
  ) {
    console.log(prefix.value + '正在重启弹幕客户端...')
    if (
      client.value?.state === 'connected' ||
      client.value?.state === 'connecting'
    ) {
      client.value.Stop()
    }
    return await connectDanmakuClient(type, directAuthInfo)
  }
  async function Start(
    type: 'openlive' | 'direct' = 'openlive',
    directAuthInfo?: DirectClientAuthInfo,
    _isFromClient: boolean = false
  ): Promise<{ success: boolean; message: string }> {
    if (isStarted.value) {
      startedAt.value = new Date()
      return { success: true, message: '已启动' }
    }
    const result = await navigator.locks.request(
      'webFetcherStart',
      async () => {
        isFromClient = _isFromClient
        while (!(await connectSignalR())) {
          console.log(prefix.value + '连接失败, 5秒后重试')
          await new Promise((resolve) => setTimeout(resolve, 5000))
        }
        let result = await connectDanmakuClient(type, directAuthInfo)
        while (!result?.success) {
          console.log(prefix.value + '弹幕客户端启动失败, 5秒后重试')
          await new Promise((resolve) => setTimeout(resolve, 5000))
          result = await connectDanmakuClient(type, directAuthInfo)
        }
        isStarted.value = true
        disconnectedByServer = false
        return result
      }
    )
    return result
  }
  function Stop() {
    if (!isStarted.value) {
      return
    }
    isStarted.value = false
    client.value?.Stop()
    client.value = undefined
    if (timer) {
      clearInterval(timer)
      timer = undefined
    }
    signalRClient.value?.stop()
    signalRClient.value = undefined
    startedAt.value = undefined
  }
  /*************  ✨ Codeium Command ⭐  *************/
  /**
   * Connects to the danmaku client based on the specified type.
   *
   * @param type - The type of danmaku client to connect, either 'openlive' or 'direct'.
   * @param directConnectInfo - Optional authentication information required when connecting to a 'direct' type client.
   *                            It should include a token, roomId, tokenUserId, and buvid.
   *
   * @returns A promise that resolves to an object containing a success flag and a message.
   *          If the connection and client start are successful, the client starts listening to danmaku events.
   *          If the connection fails or the authentication information is not provided for a 'direct' type client,
   *          the function returns with a failure message.
   */
  /******  3431380f-29f6-41b0-801a-7f081b59b4ff  *******/
  async function connectDanmakuClient(
    type: 'openlive' | 'direct',
    directConnectInfo?: {
      token: string
      roomId: number
      tokenUserId: number
      buvid: string
    }
  ) {
    if (
      client.value?.state === 'connected' ||
      client.value?.state === 'connecting'
    ) {
      return { success: true, message: '弹幕客户端已启动' }
    }
    console.log(prefix.value + '正在连接弹幕客户端...')
    if (!client.value) {
      //只有在没有客户端的时候才创建, 并添加事件
      if (type == 'openlive') {
        client.value = new OpenLiveClient()
      } else {
        if (!directConnectInfo) {
          return { success: false, message: '未提供弹幕客户端认证信息' }
        }
        client.value = new DirectClient(directConnectInfo)
      }

      client.value?.on('all', (data) => onGetDanmakus(data))
    }

    const result = await client.value?.Start()
    if (result?.success) {
      console.log(prefix.value + '加载完成, 开始监听弹幕')
      timer ??= setInterval(() => {
        sendEvents()
      }, 1500)
    } else {
      console.log(prefix.value + '弹幕客户端启动失败: ' + result?.message)
    }
    return result
  }
  async function connectSignalR() {
    console.log(prefix.value + '正在连接到 vtsuru 服务器...')
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(BASE_HUB_URL + 'web-fetcher?token=' + route.query.token, {
        headers: {
          Authorization: `Bearer ${cookie.value}`
        },
        skipNegotiation: true,
        transport: signalR.HttpTransportType.WebSockets
      })
      .withAutomaticReconnect([0, 2000, 10000, 30000])
      .withHubProtocol(new msgpack.MessagePackHubProtocol())
      .build()
    connection.on('Disconnect', (reason: unknown) => {
      console.log(prefix.value + '被服务器断开连接: ' + reason)
      disconnectedByServer = true
      connection.stop()
      signalRClient.value = undefined
    })
    /*connection.on('ConnectClient', async () => {
      if (client?.state === 'connected') {
        return
      }
      let result = await connectDanmakuClient()
      while (!result?.success) {
        console.log(prefix.value + '弹幕客户端启动失败, 5秒后重试')
        await new Promise((resolve) => setTimeout(resolve, 5000))
        result = await connectDanmakuClient()
      }
      isStarted.value = true
      disconnectedByServer = false
    })*/

    connection.onclose(reconnect)
    try {
      await connection.start()
      console.log(prefix.value + '已连接到 vtsuru 服务器')
      await connection.send('Finished')
      if (isFromClient) {
        // 如果来自Tauri客户端，设置自己为VTsuru客户端
        await connection.send('SetAsVTsuruClient')
      }
      signalRClient.value = connection
      return true
    } catch (e) {
      console.log(prefix.value + '无法连接到 vtsuru 服务器: ' + e)
      return false
    }
  }
  async function reconnect() {
    if (disconnectedByServer) {
      return
    }
    try {
      await signalRClient.value?.start()
      await signalRClient.value?.send('Reconnected')
      if (isFromClient) {
        await signalRClient.value?.send('SetAsVTsuruClient')
      }
      console.log(prefix.value + '已重新连接')
    } catch (err) {
      console.log(err)
      setTimeout(reconnect, 5000) // 如果连接失败，则每5秒尝试一次重新启动连接
    }
  }
  function onGetDanmakus(command: any) {
    events.push(command)
  }
  async function sendEvents() {
    if (signalRClient.value?.state !== 'Connected') {
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
      const compressed = await compress(
        new TextEncoder().encode(
          JSON.stringify({
            Events: tempEvents.map((e) =>
              typeof e === 'string' ? e : JSON.stringify(e)
            ),
            Version: '1.0.0',
            OSInfo: navigator.userAgent,
            UseCookie: useCookie
          })
        )
      )
      const result = await signalRClient.value?.invoke<{
        Success: boolean
        Message: string
      }>('UploadEventsCompressed', compressed)
      if (result?.Success) {
        events.splice(0, count)
        console.log(
          `[WEB-FETCHER] <${format(new Date(), 'HH:mm:ss')}> 上传了 ${count} 条弹幕`
        )
      } else {
        console.error(prefix.value + '上传弹幕失败: ' + result?.Message)
      }
    }
  }

  return {
    Start,
    Stop,
    restartDanmakuClient,
    client,
    signalRClient,
    isStarted,
    startedAt
  }
})
