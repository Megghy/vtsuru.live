import {
  HttpTransportType,
  HubConnectionBuilder,
  LogLevel,
} from '@microsoft/signalr'
import type { HubConnection } from '@microsoft/signalr'
import { MessagePackHubProtocol } from '@microsoft/signalr-protocol-msgpack'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref } from 'vue'
import { useAccount } from '@/api/account'
import { BASE_HUB_URL } from '@/data/constants'

export const useVTsuruHub = defineStore('VTsuruHub', () => {
  const signalRClient = ref<HubConnection>()
  const isInited = ref(false)
  const isIniting = ref(false)
  const accountInfo = useAccount()

  async function connectSignalR() {
    if (isIniting.value) return
    isIniting.value = true

    let currentAccount = accountInfo.value
    while (!currentAccount || !currentAccount.id || currentAccount.id < 1) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      currentAccount = accountInfo.value
    }
    // console.log('[Components-Event] 正在连接到 VTsuru 服务器...')
    const connection = new HubConnectionBuilder()
      .withUrl(`${BASE_HUB_URL}main?token=${currentAccount.token}`, {
        skipNegotiation: true,
        transport: HttpTransportType.WebSockets,
        logger: LogLevel.Error,
      })
      .withAutomaticReconnect([0, 2000, 10000, 30000])
      .withHubProtocol(new MessagePackHubProtocol())
      .build()
    connection.on('Finished', async () => {
      connection.send('Finished')
    })
    connection.on('Disconnect', (reason: unknown) => {
      console.log(`[Hub] 被 VTsuru 服务器断开连接: ${reason}`)
    })

    connection.onclose(reconnect)
    try {
      await connection.start()
      console.log('[Hub] 已连接到 VTsuru 服务器')
      signalRClient.value = connection
      isInited.value = true
      return true
    } catch (e) {
      console.log(`[Hub] 无法连接到 VTsuru 服务器: ${e}`)
      return false
    } finally {
      isIniting.value = false
    }
  }
  async function reconnect() {
    try {
      await signalRClient.value?.start()
      signalRClient.value?.send('Reconnected')
      console.log('[Hub] 已重新连接')
    } catch (err) {
      console.log(err)
      setTimeout(reconnect, 5000) // 如果连接失败，则每5秒尝试一次重新启动连接
    }
  }

  async function send(methodName: string, ...args: unknown[]) {
    if (!isInited.value) {
      await connectSignalR()
    }
    signalRClient.value?.send(methodName, ...args)
  }
  async function invoke<T>(methodName: string, ...args: unknown[]) {
    if (!isInited.value) {
      await connectSignalR()
    }
    return signalRClient.value?.invoke<T>(methodName, ...args)
  }
  async function on(eventName: string, listener: (...args: unknown[]) => void) {
    if (!isInited.value) {
      await connectSignalR()
    }
    signalRClient.value?.on(eventName, listener)
  }
  async function off(eventName: string, listener: (...args: unknown[]) => void) {
    if (!isInited.value) {
      await connectSignalR()
    }
    signalRClient.value?.off(eventName, listener)
  }
  async function onreconnected(listener: (connectionId?: string) => void) {
    if (!isInited.value) {
      await connectSignalR()
    }
    signalRClient.value?.onreconnected(listener)
  }

  async function Init() {
    if (!isInited.value && !isIniting.value) {
      await connectSignalR()
    }
    return useVTsuruHub()
  }

  return { signalRClient, Init, send, invoke, on, off, onreconnected }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useVTsuruHub, import.meta.hot))
}
