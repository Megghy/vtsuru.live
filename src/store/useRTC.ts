import { cookie, useAccount } from '@/api/account'
import {
  BaseRTCClient,
  MasterRTCClient,
  SlaveRTCClient
} from '@/data/RTCClient'
import { useStorage } from '@vueuse/core'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref } from 'vue'
import { useRoute } from 'vue-router'

export const useWebRTC = defineStore('WebRTC', () => {
  const client = ref<BaseRTCClient>()
  const accountInfo = useAccount()
  let isInitializing = false

  function on(event: string, callback: (...args: any[]) => void) {
    client.value?.on(event, callback)
  }

  function off(event: string, callback: (...args: any[]) => void) {
    client.value?.off(event, callback)
  }

  function send(event: string, data: any) {
    client.value?.send(event, data)
  }
  const route = useRoute()
  async function Init(type: 'master' | 'slave') {
    if (isInitializing) {
      return useWebRTC()
    }
    try {
      isInitializing = true
      await navigator.locks.request(
        'rtcClientInit',
        { ifAvailable: true },
        async (lock) => {
          if (lock) {
            if (!cookie.value.cookie && !route.query.token) {
              console.log('[RTC] 未登录, 跳过RTC初始化')
              return
            }
            while (!accountInfo.value.id) {
              await new Promise((resolve) => setTimeout(resolve, 500))
            }
            if (client.value) {
              return client.value
            }
            if (type == 'master') {
              client.value = new MasterRTCClient(
                accountInfo.value.id.toString(),
                accountInfo.value.token
              )
            } else {
              client.value = new SlaveRTCClient(
                accountInfo.value.id?.toString(),
                accountInfo.value.token
              )
            }
            await client.value.Init()
            return useWebRTC()
          } else {
            return useWebRTC()
          }
        }
      )
      return useWebRTC()
    } catch (e) {
      console.error(e)
      throw e
    } finally {
      isInitializing = false
    }
  }

  return { Init, send, on, off }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useWebRTC, import.meta.hot))
}
