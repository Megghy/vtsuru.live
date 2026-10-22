import { persistedSetJson, usePersistedStorage, whenPersistedReady } from '@/shared/storage/persist'

export type NotificationType = 'question-box' | 'danmaku' | 'goods-buy' | 'message-failed' | 'live-danmaku-failed'
export interface NotificationSettings {
  enableTypes: NotificationType[]
}
export interface ClientBackupSettings {
  directory: string
  scheduleEnabled: boolean
  presetHours: number
  customHours: number | null
  keepCount: number
  lastBackupAt: number | null
  lastBackupFile: string | null
}
export interface VTsuruClientSettings {
  useDanmakuClientType: 'openlive' | 'direct'
  fallbackToOpenLive: boolean
  bootAsMinimized: boolean

  danmakuHistorySize: number
  loginType: 'qrcode' | 'cookiecloud'

  enableNotification: boolean
  notificationSettings: NotificationSettings

  // 消息队列间隔设置
  danmakuInterval: number
  pmInterval: number

  // EventFetcher 功能开关
  enableEventFetcher: boolean

  // 机器人小号独立自动操作
  enableBotAccount: boolean
  botAccountFallbackToMain: boolean

  dev_disableDanmakuClient: boolean
  backup: ClientBackupSettings
}

export const useSettings = defineStore('settings', () => {
  const defaultSettings: VTsuruClientSettings = {
    useDanmakuClientType: 'openlive',
    fallbackToOpenLive: true,
    bootAsMinimized: false,

    danmakuHistorySize: 100,
    loginType: 'qrcode',
    enableNotification: true,
    notificationSettings: {
      enableTypes: ['question-box', 'danmaku', 'message-failed'],
    },

    // 默认间隔为2秒
    danmakuInterval: 2000,
    pmInterval: 2000,

    // 默认启用 EventFetcher
    enableEventFetcher: true,

    // 机器人小号设置
    enableBotAccount: false,
    botAccountFallbackToMain: true,

    dev_disableDanmakuClient: false,

    backup: {
      directory: '',
      scheduleEnabled: false,
      presetHours: 24,
      customHours: null,
      keepCount: 10,
      lastBackupAt: null,
      lastBackupFile: null,
    },
  }
  const settings = usePersistedStorage<VTsuruClientSettings>('settings', defaultSettings, {
    mergeDefaults: (stored, defaults) => ({
      ...defaults,
      ...stored,
      notificationSettings: {
        ...defaults.notificationSettings,
        ...stored.notificationSettings,
        enableTypes: stored.notificationSettings?.enableTypes ?? defaults.notificationSettings.enableTypes,
      },
      backup: {
        ...defaults.backup,
        ...stored.backup,
      },
    }),
  })

  async function init() {
    await whenPersistedReady(settings)
  }
  async function save() {
    await persistedSetJson('settings', settings.value)
  }

  return { init, save, settings }
})

if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useSettings, import.meta.hot))
