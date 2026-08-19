import { acceptHMRUpdate, defineStore } from 'pinia'
import { readonly, ref } from 'vue'
import { useRoute } from 'vue-router'

import { GetSelfAccount, useAccount } from '@/api/account'
import { cookie } from '@/api/auth'
import type { BaseRTCClient } from '@/shared/services/RTCClient'
import { MasterRTCClient, SlaveRTCClient } from '@/shared/services/RTCClient'

export const useWebRTC = defineStore('WebRTC', () => {
  const client = ref<BaseRTCClient>()
  const status = ref<'idle' | 'connecting' | 'ready' | 'error'>('idle')
  const lastError = ref<string>()
  const accountInfo = useAccount()
  let initialization: Promise<void> | undefined

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
  async function Init(type: 'master' | 'slave', options: { timeoutMs?: number } = {}) {
    if (client.value) {
      status.value = 'ready'
      return useWebRTC()
    }
    if (!initialization) {
      status.value = 'connecting'
      lastError.value = undefined
      initialization = (async () => {
        await navigator.locks.request('rtcClientInit', { ifAvailable: true }, async (lock) => {
          if (!lock || client.value) return
          const token = Array.isArray(route.query.token) ? route.query.token[0] : route.query.token
          if (!cookie.value?.cookie && !token) {
            status.value = 'idle'
            return
          }
          if (!accountInfo.value?.id) await GetSelfAccount(token ? String(token) : undefined)
          if (!accountInfo.value?.id) throw new Error('RTC 账号信息不可用')

          client.value =
            type === 'master'
              ? new MasterRTCClient(accountInfo.value.id.toString(), accountInfo.value.token)
              : new SlaveRTCClient(accountInfo.value.id.toString(), accountInfo.value.token)
          await client.value.Init()
          status.value = 'ready'
          lastError.value = undefined
        })
      })().finally(() => {
        initialization = undefined
      })
    }

    const timeoutMs = options.timeoutMs ?? 10000
    let timeoutId: number | undefined
    try {
      await Promise.race([
        initialization,
        new Promise<never>((_, reject) => {
          timeoutId = window.setTimeout(() => reject(new Error(`RTC 初始化超时 (${timeoutMs}ms)`)), timeoutMs)
        }),
      ])
      if (!client.value && status.value === 'connecting') status.value = 'idle'
    } catch (error) {
      status.value = 'error'
      lastError.value = error instanceof Error ? error.message : String(error)
      throw error
    } finally {
      window.clearTimeout(timeoutId)
    }
    return useWebRTC()
  }

  return { Init, send, on, off, status: readonly(status), lastError: readonly(lastError) }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useWebRTC, import.meta.hot))
}
