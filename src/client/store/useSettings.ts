import { useTauriStore } from './useTauriStore'

export type NotificationType = 'question-box' | 'danmaku' | 'goods-buy' | 'message-failed' | 'live-danmaku-failed'
export interface NotificationSettings {
  enableTypes: NotificationType[]
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

  dev_disableDanmakuClient: boolean
}

export const useSettings = defineStore('settings', () => {
  const store = useTauriStore().getTarget<VTsuruClientSettings>('settings')
  const defaultSettings: VTsuruClientSettings = {
    useDanmakuClientType: 'openlive',
    fallbackToOpenLive: true,
    bootAsMinimized: true,

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

    dev_disableDanmakuClient: false,
  }
  const settings = ref<VTsuruClientSettings>(Object.assign({}, defaultSettings))

  async function init() {
    settings.value = (await store.get()) || Object.assign({}, defaultSettings)
    settings.value.notificationSettings ??= defaultSettings.notificationSettings
    settings.value.notificationSettings.enableTypes ??= ['question-box', 'danmaku', 'message-failed']
    // 初始化消息队列间隔设置
    settings.value.danmakuInterval ??= defaultSettings.danmakuInterval
    settings.value.pmInterval ??= defaultSettings.pmInterval
    // 初始化 EventFetcher 开关
    settings.value.enableEventFetcher ??= defaultSettings.enableEventFetcher
  }
  async function save() {
    await store.set(settings.value)
  }

  return { init, save, settings }
})

if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useSettings, import.meta.hot))
