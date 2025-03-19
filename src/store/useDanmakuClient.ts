import { useAccount } from '@/api/account'
import { OpenLiveInfo } from '@/api/api-models'
import OpenLiveClient, { AuthInfo } from '@/data/DanmakuClients/OpenLiveClient'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export interface BCMessage {
  type: string
  data: string
}

export const useDanmakuClient = defineStore('DanmakuClient', () => {
  const danmakuClient = ref<OpenLiveClient>(new OpenLiveClient())
  let bc: BroadcastChannel
  const isOwnedDanmakuClient = ref(false)
  const status = ref<'waiting' | 'initializing' | 'listening' | 'running'>(
    'waiting'
  )
  const connected = computed(
    () => status.value === 'running' || status.value === 'listening'
  )
  const authInfo = ref<OpenLiveInfo>()
  const accountInfo = useAccount()

  let existOtherClient = false
  let isInitializing = false

  function on(
    eventName: 'danmaku' | 'gift' | 'sc' | 'guard',
    listener: (...args: any[]) => void
  ) {
    if (!danmakuClient.value.events[eventName]) {
      danmakuClient.value.events[eventName] = []
    }
    danmakuClient.value.events[eventName].push(listener)
  }
  function onEvent(
    eventName: 'danmaku' | 'gift' | 'sc' | 'guard' | 'all',
    listener: (...args: any[]) => void
  ) {
    if (!danmakuClient.value.eventsAsModel[eventName]) {
      danmakuClient.value.eventsAsModel[eventName] = []
    }
    danmakuClient.value.eventsAsModel[eventName].push(listener)
  }

  function off(
    eventName: 'danmaku' | 'gift' | 'sc' | 'guard',
    listener: (...args: any[]) => void
  ) {
    if (danmakuClient.value.events[eventName]) {
      const index = danmakuClient.value.events[eventName].indexOf(listener)
      if (index > -1) {
        danmakuClient.value.events[eventName].splice(index, 1)
      }
    }
  }

  function offEvent(
    eventName: 'danmaku' | 'gift' | 'sc' | 'guard' | 'all',
    listener: (...args: any[]) => void
  ) {
    if (danmakuClient.value.eventsAsModel[eventName]) {
      const index =
        danmakuClient.value.eventsAsModel[eventName].indexOf(listener)
      if (index > -1) {
        danmakuClient.value.eventsAsModel[eventName].splice(index, 1)
      }
    }
  }

  async function initClient(auth?: AuthInfo) {
    if (!isInitializing && !connected.value) {
      isInitializing = true
      navigator.locks.request(
        'danmakuClientInit',
        { ifAvailable: true },
        async (lock) => {
          if (lock) {
            status.value = 'initializing'
            bc = new BroadcastChannel(
              'vtsuru.danmaku.open-live' + accountInfo.value?.id
            )
            console.log('[DanmakuClient] 创建 BroadcastChannel: ' + bc.name)
            bc.onmessage = (event) => {
              const message: BCMessage = event.data as BCMessage
              const data = message.data ? JSON.parse(message.data) : {}
              switch (message.type) {
                case 'check-client':
                  sendBCMessage('response-client-status', {
                    status: status.value,
                    auth: authInfo.value
                  })
                  break
                case 'response-client-status':
                  switch (
                    data.status //如果存在已经在运行或者正在启动的客户端, 状态设为 listening
                  ) {
                    case 'running':
                    case 'initializing':
                      status.value = 'listening'
                      existOtherClient = true
                      authInfo.value = data.auth
                      break
                  }
                  break
                case 'on-danmaku':
                  const danmaku = typeof data === 'string' ? JSON.parse(data) : data
                  switch (danmaku.cmd) {
                    case 'LIVE_OPEN_PLATFORM_DM':
                      danmakuClient.value.onDanmaku(danmaku)
                      break
                    case 'LIVE_OPEN_PLATFORM_SEND_GIFT':
                      danmakuClient.value.onGift(danmaku)
                      break
                    case 'LIVE_OPEN_PLATFORM_SUPER_CHAT':
                      danmakuClient.value.onSC(danmaku)
                      break
                    case 'LIVE_OPEN_PLATFORM_GUARD':
                      danmakuClient.value.onGuard(danmaku)
                      break
                    default:
                      danmakuClient.value.onRawMessage(danmaku)
                      break
                  }
                  break
              }
            }
            console.log('[DanmakuClient] 正在检查客户端状态...')
            sendBCMessage('check-client')
            setTimeout(() => {
              if (!connected.value) {
                isOwnedDanmakuClient.value = true
                initClientInternal(auth)
              } else {
                console.log(
                  '[DanmakuClient] 已存在其他页面弹幕客户端, 开始监听 BroadcastChannel...'
                )
              }

              setInterval(checkClientStatus, 500)
            }, 1000)
          }
        }
      )
    }
    isInitializing = false
    return useDanmakuClient()
  }
  function sendBCMessage(type: string, data?: any) {
    bc.postMessage({
      type,
      data: JSON.stringify(data)
    })
  }
  function checkClientStatus() {
    if (!existOtherClient && !isOwnedDanmakuClient.value) {
      //当不存在其他客户端, 且自己不是弹幕客户端
      //则自己成为新的弹幕客户端
      if (status.value != 'initializing') {
        console.log('[DanmakuClient] 其他 Client 离线, 开始初始化...')
        initClientInternal()
      }
    } else {
      existOtherClient = false //假设其他客户端不存在
      sendBCMessage('check-client') //检查其他客户端是否存在
    }
  }

  async function initClientInternal(auth?: AuthInfo) {
    status.value = 'initializing'
    await navigator.locks.request(
      'danmakuClientInitInternal',
      {
        ifAvailable: true
      },
      async (lock) => {
        if (lock) {
          // 有锁
          isOwnedDanmakuClient.value = true
          const events = danmakuClient.value.events
          const eventsAsModel = danmakuClient.value.eventsAsModel

          danmakuClient.value = new OpenLiveClient(auth)

          danmakuClient.value.events = events
          danmakuClient.value.eventsAsModel = eventsAsModel
          const init = async () => {
            const result = await danmakuClient.value.Start()
            if (result.success) {
              authInfo.value = danmakuClient.value.roomAuthInfo
              status.value = 'running'
              console.log('[DanmakuClient] 初始化成功')
              sendBCMessage('response-client-status', {
                status: 'running',
                auth: authInfo.value
              })
              danmakuClient.value.on('all', (data) => {
                sendBCMessage('on-danmaku', data)
              })
              return true
            } else {
              console.log(
                '[DanmakuClient] 初始化失败, 5秒后重试: ' + result.message
              )
              return false
            }
          }
          while (!(await init())) {
            await new Promise((resolve) => {
              setTimeout(() => {
                resolve(true)
              }, 5000)
            })
          }
        } else {
          // 无锁
          console.log('[DanmakuClient] 正在等待其他页面弹幕客户端初始化...')
          status.value = 'listening'
          isOwnedDanmakuClient.value = false
        }
      }
    )
  }

  return {
    danmakuClient,
    isOwnedDanmakuClient,
    status,
    connected,
    authInfo,
    on,
    off,
    onEvent,
    offEvent,
    initClient
  }
})
