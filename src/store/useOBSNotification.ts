import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref } from 'vue'

import { useAccount } from '@/api/account'
import { parsePositiveId } from '@/shared/obs/obsUrl'
import { useRealtimeBus } from '@/shared/realtime'
import { useVTsuruHub } from './useVTsuruHub'

export interface ObsNotificationPayload {
  Type: 'success' | 'failed'
  Title?: string
  Message: string
  Source?: string | null
  UserName?: string | null
  Timestamp?: number
}

const sourceLabelMap: Record<string, string> = {
  'live-request': '点歌',
  'music-request': '点歌',
  queue: '排队',
}

export const useOBSNotification = defineStore('obs-notification', () => {
  const isInited = ref(false)
  const hub = useVTsuruHub()
  const realtimeBus = useRealtimeBus()
  const account = useAccount()
  const listeners = new Map<string, (payload: ObsNotificationPayload) => void>()
  let currentSubscribedTopic = ''

  function resolveMeta(payload: ObsNotificationPayload): string | undefined {
    const userName = payload.UserName?.trim()
    const sourceLabel = payload.Source ? (sourceLabelMap[payload.Source] ?? payload.Source) : undefined

    if (!userName && !sourceLabel) {
      return undefined
    }

    const text = [userName, sourceLabel].filter(Boolean).join(' · ')
    return text || undefined
  }

  function resolveTitle(payload: ObsNotificationPayload): string {
    if (payload.Title?.trim()) {
      return payload.Title
    }
    if (payload.Source && sourceLabelMap[payload.Source]) {
      return sourceLabelMap[payload.Source]
    }
    return payload.Type === 'success' ? '提示' : '警告'
  }

  function showNotification(payload: ObsNotificationPayload) {
    const message = window.$message
    if (!message) {
      console.warn('[OBS] message instance missing')
      return
    }
    console.log('[OBS] 收到通知', payload)

    const method = payload.Type === 'success' ? 'success' : 'error'
    const title = resolveTitle(payload)
    const meta = resolveMeta(payload)
    const prefix = [title, meta].filter(Boolean).join(' · ')
    const description = payload.Message || '未知通知'
    const finalContent = prefix ? `${prefix}\n${description}` : description

    message[method](finalContent, {
      duration: method === 'error' ? 6000 : 4000,
    })
  }

  /**
   * 初始化 OBS 通知系统
   * @param sources 可选的source过滤列表，如果提供则只显示这些类型的通知
   * @param ownerId 可选的目标主播用户 ID（若在 OBS 页面上，默认从路由 ?id= 解析）
   */
  async function init(sources?: string[], ownerId?: number) {
    const listenerId = sources ? [...sources].toSorted().join(',') : 'all'

    // 如果已经为这个过滤器初始化过，直接返回
    if (listeners.has(listenerId)) {
      return
    }

    const listener = (payload: ObsNotificationPayload) => {
      // 如果指定了sources过滤器，检查通知是否匹配
      if (sources && sources.length > 0) {
        if (!payload.Source || !sources.includes(payload.Source)) {
          return // 不匹配，忽略此通知
        }
      }
      showNotification(payload)
    }

    listeners.set(listenerId, listener)

    // 解析目标用户 ID（支持公开 OBS 挂件免密接收）
    const targetId = ownerId ?? parsePositiveId(window.$route?.query?.id) ?? account.value.id

    if (targetId) {
      const topic = `obs:notify:${targetId}`
      if (currentSubscribedTopic !== topic) {
        if (currentSubscribedTopic) {
          void realtimeBus.bus.unsubscribe(currentSubscribedTopic)
        }
        currentSubscribedTopic = topic
        void realtimeBus.bus.subscribe(topic)
        realtimeBus.on(topic, 'ObsNotification', (payload) => {
          if (payload) {
            listener(payload as ObsNotificationPayload)
          }
        })
      }
    }

    if (!isInited.value && account.value.id) {
      isInited.value = true
      try {
        await hub.Init()
        await hub.on('ObsNotification', listener)
      } catch (err) {
        console.warn('[OBSNotification] VTsuruHub 连接失败，已回退至 RealtimeGateway:', err)
      }
    }

    const filterInfo = sources && sources.length > 0 ? `(过滤: ${sources.join(', ')})` : '(所有类型)'
    console.log(`[OBS] OBS 通知模块已初始化 ${filterInfo}`)
  }

  async function publish(payload: ObsNotificationPayload, targetUserId?: number) {
    const message = payload.Message?.trim()
    if (!message) {
      return
    }

    const targetId = targetUserId ?? account.value.id
    if (targetId) {
      const topic = `obs:notify:${targetId}`
      try {
        await realtimeBus.publish(topic, 'PublishObsNotification', {
          ...payload,
          Message: message,
          Timestamp: payload.Timestamp ?? Date.now(),
        })
      } catch {
        // 尝试老 Hub
        try {
          await hub.Init()
          await hub.invoke('PublishObsNotification', {
            ...payload,
            Message: message,
            Timestamp: payload.Timestamp ?? Date.now(),
          })
        } catch {}
      }
    }
  }

  return {
    init,
    publish,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useOBSNotification, import.meta.hot))
}
