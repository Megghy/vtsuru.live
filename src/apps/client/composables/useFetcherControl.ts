import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import { callStartDanmakuClient, resetDanmakuClientInitState } from '@/apps/client/data/initialize'
import { useSettings } from '@/apps/client/store/useSettings'
import { useWebFetcher } from '@/store/useWebFetcher'

const isSwitching = ref(false)

/**
 * 统一封装 EventFetcher 启停、模式切换与强制重启逻辑，避免多处状态不同步与假成功提示
 */
export function useFetcherControl() {
  const webfetcher = useWebFetcher()
  const settings = useSettings()

  const isBusy = computed(() => webfetcher.state === 'connecting' || isSwitching.value)

  async function toggleEnabled(enabled: boolean): Promise<boolean> {
    if (isSwitching.value) return false
    isSwitching.value = true
    const noticeId = 'webfetcher-toggle'
    try {
      settings.settings.enableEventFetcher = enabled
      await settings.save()

      if (enabled) {
        toast.loading('正在启动 EventFetcher...', { id: noticeId, duration: Infinity })
        const result = await callStartDanmakuClient()
        if (result.success) {
          toast.success('EventFetcher 已启动', { id: noticeId, duration: 3000 })
          return true
        }
        toast.error(`EventFetcher 启动失败: ${result.message || '未知错误'}`, { id: noticeId, duration: 5000 })
        return false
      }

      if (webfetcher.state !== 'disconnected') {
        await webfetcher.Stop()
      }
      resetDanmakuClientInitState()
      toast.info('EventFetcher 已停止', { id: noticeId, duration: 3000 })
      return true
    } finally {
      isSwitching.value = false
    }
  }

  async function switchMode(type: 'openlive' | 'direct', force = false): Promise<boolean> {
    if (isSwitching.value) return false
    if (webfetcher.webfetcherType === type && !force && webfetcher.state === 'connected') {
      toast.info('当前已是该模式')
      return true
    }

    settings.settings.useDanmakuClientType = type
    await settings.save()

    if (!settings.settings.enableEventFetcher) {
      toast.info(`已切换默认模式为${type === 'direct' ? '直接连接' : '开放平台'}`)
      return true
    }

    isSwitching.value = true
    const noticeId = 'webfetcher-switch'
    try {
      toast.loading(force ? '正在重启弹幕客户端...' : '正在关闭当前弹幕连接...', {
        id: noticeId,
        duration: Infinity,
      })
      await webfetcher.Stop()
      resetDanmakuClientInitState()

      toast.loading('正在连接弹幕服务器...', {
        id: noticeId,
        duration: Infinity,
      })
      const result = await callStartDanmakuClient()
      if (result.success) {
        const modeLabel = webfetcher.webfetcherType === 'direct' ? '直接连接' : '开放平台'
        toast.success(force ? '弹幕客户端已重启' : `已切换至${modeLabel}模式`, {
          id: noticeId,
          duration: 3000,
        })
        return true
      }

      toast.error(`弹幕服务器连接失败: ${result.message || '未知错误'}`, {
        id: noticeId,
        duration: 5000,
      })
      return false
    } finally {
      isSwitching.value = false
    }
  }

  async function forceRestart(): Promise<boolean> {
    return switchMode(settings.settings.useDanmakuClientType, true)
  }

  return {
    isBusy,
    isSwitching,
    toggleEnabled,
    switchMode,
    forceRestart,
  }
}
