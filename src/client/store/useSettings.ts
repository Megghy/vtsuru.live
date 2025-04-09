import { useTauriStore } from './useTauriStore';

export type NotificationType = 'question-box' | 'danmaku' | 'goods-buy';
export type NotificationSettings = {
  enableTypes: NotificationType[];
};
export type VTsuruClientSettings = {
  useDanmakuClientType: 'openlive' | 'direct';
  fallbackToOpenLive: boolean;
  bootAsMinimized: boolean;

  danmakuHistorySize: number;
  loginType: 'qrcode' | 'cookiecloud'

  enableNotification: boolean;
  notificationSettings: NotificationSettings;

  dev_disableDanmakuClient: boolean;
};

export const useSettings = defineStore('settings', () => {
  const store = useTauriStore().getTarget<VTsuruClientSettings>('settings');
  const defaultSettings: VTsuruClientSettings = {
    useDanmakuClientType: 'openlive',
    fallbackToOpenLive: true,
    bootAsMinimized: true,

    danmakuHistorySize: 100,
    loginType: 'qrcode',
    enableNotification: true,
    notificationSettings: {
      enableTypes: ['question-box', 'danmaku'],
    },

    dev_disableDanmakuClient: false,
  };
  const settings = ref<VTsuruClientSettings>(Object.assign({}, defaultSettings));

  async function init() {
    settings.value = (await store.get()) || Object.assign({}, defaultSettings);
    settings.value.notificationSettings ??= defaultSettings.notificationSettings;
    settings.value.notificationSettings.enableTypes ??= [ 'question-box', 'danmaku' ];
  }
  async function save() {
    await store.set(settings.value);
  }

  return { init, save, settings };
});

if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useSettings, import.meta.hot));
