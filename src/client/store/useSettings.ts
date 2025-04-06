import { useTauriStore } from './useTauriStore';

export type NotificationType = 'question-box' | 'danmaku';
export type NotificationSettings = {
  enableTypes: NotificationType[];
};
export type VTsuruClientSettings = {
  useDanmakuClientType: 'openlive' | 'direct';
  fallbackToOpenLive: boolean;

  danmakuHistorySize: number;
  loginType: 'qrcode' | 'cookiecloud'

  enableNotification: boolean;
  notificationSettings: NotificationSettings;
};

export const useSettings = defineStore('settings', () => {
  const store = useTauriStore().getTarget<VTsuruClientSettings>('settings');
  const defaultSettings: VTsuruClientSettings = {
    useDanmakuClientType: 'openlive',
    fallbackToOpenLive: true,

    danmakuHistorySize: 100,
    loginType: 'qrcode',
    enableNotification: true,
    notificationSettings: {
      enableTypes: ['question-box', 'danmaku'],
    },
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
