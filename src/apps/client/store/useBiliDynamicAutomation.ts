import { acceptHMRUpdate, defineStore } from 'pinia'
import { toast } from 'vue-sonner'

import { useAccount } from '@/api/account'
import { usePersistedStorage } from '@/shared/storage/persist'

import {
  deleteBiliDynamic,
  publishBiliDynamic,
  removeTopBiliDynamic,
  setTopBiliDynamic,
} from '../api/bili-dynamic'

export interface LiveDynamicAutomationConfig {
  autoPublishOnLiveStart: boolean
  liveStartTemplate: string
  pinLiveStartDynamic: boolean
  autoDeleteOnLiveEnd: boolean
  restoreTopDynamicId: string
  lastLiveDynamicId: string
  lastLiveDynamicPublishedAt: number
}

const DEFAULT_CONFIG: LiveDynamicAutomationConfig = {
  autoPublishOnLiveStart: false,
  liveStartTemplate: '开播啦！今天直播：{title}\n直播间传送门：https://live.bilibili.com/{roomId}',
  pinLiveStartDynamic: false,
  autoDeleteOnLiveEnd: false,
  restoreTopDynamicId: '',
  lastLiveDynamicId: '',
  lastLiveDynamicPublishedAt: 0,
}

export const useBiliDynamicAutomation = defineStore('biliDynamicAutomation', () => {
  const config = usePersistedStorage<LiveDynamicAutomationConfig>('Client.BiliDynamicAutomation', { ...DEFAULT_CONFIG })
  const account = useAccount()

  function renderTemplate(template: string, vars?: { title?: string; roomId?: number }) {
    const roomId = vars?.roomId ?? account.value?.biliRoomId ?? 0
    const title = vars?.title || account.value?.name || '直播中'
    return template
      .replace(/\{title\}/g, title)
      .replace(/\{roomId\}/g, String(roomId))
      .replace(/\{uname\}/g, account.value?.name || '')
  }

  async function publishLiveDynamic(
    customText?: string,
    options?: { pin?: boolean; recordAsLivePost?: boolean; title?: string; roomId?: number },
  ): Promise<string> {
    const content = customText?.trim() || renderTemplate(config.value.liveStartTemplate, options)
    const dynId = await publishBiliDynamic(content)
    const shouldPin = options?.pin ?? config.value.pinLiveStartDynamic
    const shouldRecord = options?.recordAsLivePost ?? true

    if (shouldRecord) {
      config.value.lastLiveDynamicId = dynId
      config.value.lastLiveDynamicPublishedAt = Date.now()
    }
    if (shouldPin) {
      try {
        await setTopBiliDynamic(dynId)
      } catch (err) {
        console.warn('[DynamicAutomation] 自动置顶动态失败:', err)
      }
    }
    return dynId
  }

  async function cleanupLastLiveDynamic(): Promise<{ deleted: boolean; restoredTop: boolean; dynId: string }> {
    const targetId = config.value.lastLiveDynamicId
    if (!targetId) {
      return { deleted: false, restoredTop: false, dynId: '' }
    }
    try {
      await removeTopBiliDynamic(targetId)
    } catch {
      // 未置顶时忽略
    }
    await deleteBiliDynamic(targetId)
    config.value.lastLiveDynamicId = ''

    let restoredTop = false
    const restoreId = config.value.restoreTopDynamicId.trim()
    if (restoreId) {
      try {
        await setTopBiliDynamic(restoreId)
        restoredTop = true
      } catch (err) {
        console.warn('[DynamicAutomation] 恢复原置顶动态失败:', err)
      }
    }
    return { deleted: true, restoredTop, dynId: targetId }
  }

  async function handleLiveStarted(title?: string, roomId?: number) {
    if (!config.value.autoPublishOnLiveStart) return
    try {
      const dynId = await publishLiveDynamic(undefined, {
        title,
        roomId,
        pin: config.value.pinLiveStartDynamic,
        recordAsLivePost: true,
      })
      toast.success('已自动发布开播动态', { description: `动态 ID: ${dynId}` })
    } catch (err) {
      toast.error('自动发布开播动态失败', { description: err instanceof Error ? err.message : String(err) })
    }
  }

  async function handleLiveEnded() {
    if (!config.value.autoDeleteOnLiveEnd || !config.value.lastLiveDynamicId) return
    try {
      const res = await cleanupLastLiveDynamic()
      if (res.deleted) {
        toast.success('下播已自动清理开播动态', {
          description: res.restoredTop ? '并已恢复原置顶动态' : undefined,
        })
      }
    } catch (err) {
      toast.error('自动清理开播动态失败', { description: err instanceof Error ? err.message : String(err) })
    }
  }

  return {
    config,
    renderTemplate,
    publishLiveDynamic,
    cleanupLastLiveDynamic,
    handleLiveStarted,
    handleLiveEnded,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useBiliDynamicAutomation, import.meta.hot))
}
