import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref } from 'vue'
import { useVTsuruHub } from './useVTsuruHub'

interface ObsNotificationPayload {
  Type: 'success' | 'failed'
  Title?: string
  Message: string
  Source?: string | null
  UserName?: string | null
  Timestamp?: number
}

const sourceLabelMap: Record<string, string> = {
  'live-request': '点歌',
  'queue': '排队',
}

export const useOBSNotification = defineStore('obs-notification', () => {
  const isInited = ref(false)
  const hub = useVTsuruHub()
  const listeners = new Map<string, (payload: ObsNotificationPayload) => void>()

  function resolveMeta(payload: ObsNotificationPayload): string | undefined {
    const userName = payload.UserName?.trim()
    const sourceLabel = payload.Source ? sourceLabelMap[payload.Source] ?? payload.Source : undefined

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
    const notification = window.$notification
    if (!notification) {
      console.warn('[OBS] notification instance missing')
      return
    }
    console.log('[OBS] 收到通知', payload)

    const method = payload.Type === 'success' ? 'success' : 'error'
    const title = resolveTitle(payload)
    const description = payload.Message || '未知通知'
    const meta = resolveMeta(payload)

    if (typeof notification[method] === 'function') {
      notification[method]({
        title: payload.Type === 'success' ? '成功' : `失败`,
        description,
        duration: method === 'error' ? 8000 : 5000,
        keepAliveOnHover: true,
      })
    } else {
      notification.create({
        title: payload.Type === 'success' ? '成功' : `失败`,
        content: description,
        duration: method === 'error' ? 8000 : 5000,
        keepAliveOnHover: true,
        type: method,
      })
    }
  }

  /**
   * 初始化 OBS 通知系统
   * @param sources 可选的source过滤列表，如果提供则只显示这些类型的通知
   */
  async function init(sources?: string[]) {
    const listenerId = sources ? sources.sort().join(',') : 'all'

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

    if (!isInited.value) {
      isInited.value = true
      await hub.Init()
    }

    await hub.on('ObsNotification', listener)

    const filterInfo = sources && sources.length > 0
      ? `(过滤: ${sources.join(', ')})`
      : '(所有类型)'
    console.log(`[OBS] OBS 通知模块已初始化 ${filterInfo}`)
  }

  return {
    init,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useOBSNotification, import.meta.hot))
}
