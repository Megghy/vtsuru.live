import { persistedSetJson, usePersistedStorage, whenPersistedReady } from '@/shared/storage/persist'

export type NotificationType =
  | 'question-box'
  | 'danmaku'
  | 'goods-buy'
  | 'message-failed'
  | 'live-danmaku-failed'
  | 'cookie-invalid'
  | 'live-status'
  | 'update'

export type CloseWindowAction = 'minimize-to-tray' | 'exit'

export interface NotificationSettings {
  enableTypes: NotificationType[]
  onlyWhenHidden: boolean
  enableSound: boolean
  soundVolume: number
}

export interface ClientBackupSettings {
  directory: string
  scheduleEnabled: boolean
  presetHours: number
  customHours: number | null
  keepCount: number
  includeSensitiveCredentials: boolean
  lastBackupAt: number | null
  lastBackupFile: string | null
}

export interface VTsuruClientSettings {
  useDanmakuClientType: 'openlive' | 'direct'
  fallbackToOpenLive: boolean
  bootAsMinimized: boolean
  closeWindowAction: CloseWindowAction

  loginType: 'qrcode' | 'cookiecloud'

  enableNotification: boolean
  notificationSettings: NotificationSettings

  // 消息队列间隔设置
  danmakuInterval: number
  pmInterval: number

  // EventFetcher 功能开关
  enableEventFetcher: boolean
  // 看门狗心跳超时自动重载主界面
  watchdogAutoReload?: boolean

  dev_disableDanmakuClient: boolean
  backup: ClientBackupSettings
}

export const useSettings = defineStore('settings', () => {
  const defaultSettings: VTsuruClientSettings = {
    useDanmakuClientType: 'openlive',
    fallbackToOpenLive: true,
    bootAsMinimized: false,
    closeWindowAction: 'minimize-to-tray',

    loginType: 'qrcode',
    enableNotification: true,
    notificationSettings: {
      enableTypes: [
        'question-box',
        'goods-buy',
        'danmaku',
        'message-failed',
        'live-danmaku-failed',
        'cookie-invalid',
        'update',
      ],
      onlyWhenHidden: false,
      enableSound: true,
      soundVolume: 0.5,
    },

    // 默认间隔为2秒
    danmakuInterval: 2000,
    pmInterval: 2000,

    // 默认启用 EventFetcher
    enableEventFetcher: true,
    watchdogAutoReload: false,

    dev_disableDanmakuClient: false,

    backup: {
      directory: '',
      scheduleEnabled: false,
      presetHours: 24,
      customHours: null,
      keepCount: 10,
      includeSensitiveCredentials: false,
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
