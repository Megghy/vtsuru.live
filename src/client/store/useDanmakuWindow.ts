import { EventDataTypes, EventModel } from "@/api/api-models";
import { CURRENT_HOST } from "@/data/constants";
import { useDanmakuClient } from "@/store/useDanmakuClient";
import { useWebFetcher } from "@/store/useWebFetcher";
import { PhysicalPosition, PhysicalSize } from "@tauri-apps/api/dpi";
import { Webview } from "@tauri-apps/api/webview";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { Window } from "@tauri-apps/api/window";

export type DanmakuWindowSettings = {
  width: number;
  height: number;
  x: number;
  y: number;
  opacity: number; // 窗口透明度
  showAvatar: boolean; // 是否显示头像
  showUsername: boolean; // 是否显示用户名
  showFansMedal: boolean; // 是否显示粉丝牌
  showGuardIcon: boolean; // 是否显示舰长图标
  fontSize: number; // 弹幕字体大小
  maxDanmakuCount: number; // 最大显示的弹幕数量
  reverseOrder: boolean; // 是否倒序显示（从下往上）
  filterTypes: string[]; // 要显示的弹幕类型
  animationDuration: number; // 动画持续时间
  backgroundColor: string; // 背景色
  textColor: string; // 文字颜色
  alwaysOnTop: boolean; // 是否总在最前
  interactive: boolean; // 是否可交互(穿透鼠标点击)
  borderRadius: number; // 边框圆角
  itemSpacing: number; // 项目间距
  enableShadow: boolean; // 是否启用阴影
  shadowColor: string; // 阴影颜色
};

export const DANMAKU_WINDOW_BROADCAST_CHANNEL = 'channel.danmaku.window';
export type DanmakuWindowBCData = {
  type: 'danmaku',
  data: EventModel;
} | {
  type: 'update-setting',
  data: DanmakuWindowSettings;
};

export const useDanmakuWindow = defineStore('danmakuWindow', () => {
  const danmakuWindow = ref<Webview>();
  const danmakuWindowSetting = useStorage<DanmakuWindowSettings>('Setting.DanmakuWindow', {
    width: 400,
    height: 600,
    x: 100,
    y: 100,
    opacity: 0.9,
    showAvatar: true,
    showUsername: true,
    showFansMedal: true,
    showGuardIcon: true,
    fontSize: 14,
    maxDanmakuCount: 50,
    reverseOrder: false,
    filterTypes: ["Message", "Gift", "SC", "Guard"],
    animationDuration: 300,
    backgroundColor: 'rgba(0,0,0,0.6)',
    textColor: '#ffffff',
    alwaysOnTop: true,
    interactive: false,
    borderRadius: 8,
    itemSpacing: 5,
    enableShadow: true,
    shadowColor: 'rgba(0,0,0,0.5)'
  });
  const danmakuClient = useDanmakuClient();
  let bc: BroadcastChannel | undefined = undefined;

  function hideWindow() {
    danmakuWindow.value?.window.hide();
    danmakuWindow.value = undefined;
  }
  function closeWindow() {
    danmakuWindow.value?.close();
    danmakuWindow.value = undefined;
  }

  function setDanmakuWindowSize(width: number, height: number) {
    danmakuWindowSetting.value.width = width;
    danmakuWindowSetting.value.height = height;
    danmakuWindow.value?.setSize(new PhysicalSize(width, height));
  }

  function setDanmakuWindowPosition(x: number, y: number) {
    danmakuWindowSetting.value.x = x;
    danmakuWindowSetting.value.y = y;
    danmakuWindow.value?.setPosition(new PhysicalPosition(x, y));
  }

  function updateSetting<K extends keyof DanmakuWindowSettings>(key: K, value: DanmakuWindowSettings[K]) {
    danmakuWindowSetting.value[key] = value;
    // 特定设置需要直接应用到窗口
    if (key === 'alwaysOnTop' && danmakuWindow.value) {
      danmakuWindow.value.window.setAlwaysOnTop(value as boolean);
    }
    if (key === 'interactive' && danmakuWindow.value) {
      danmakuWindow.value.window.setIgnoreCursorEvents(value as boolean);
    }
  }

  async function createWindow() {
    const appWindow = new Window('uniqueLabel', {
      decorations: true,
      resizable: true,
      transparent: true,
      fullscreen: false,
      alwaysOnTop: danmakuWindowSetting.value.alwaysOnTop,
      title: "VTsuru 弹幕窗口",
    });

    // loading embedded asset:
    danmakuWindow.value = new Webview(appWindow, 'theUniqueLabel', {
      url: `${CURRENT_HOST}/client/danaku-window-manage`,
      width: danmakuWindowSetting.value.width,
      height: danmakuWindowSetting.value.height,
      x: danmakuWindowSetting.value.x,
      y: danmakuWindowSetting.value.y,
    });

    appWindow.onCloseRequested(() => {
      danmakuWindow.value = undefined;
      bc?.close();
      bc = undefined;
    });

    danmakuWindow.value.once('tauri://window-created', async () => {
      console.log('弹幕窗口已创建');
      await danmakuWindow.value?.window.setIgnoreCursorEvents(true);
    });
    bc?.postMessage({
      type: 'danmaku',
      data: {
        type: EventDataTypes.Message,
        msg: '弹幕窗口已打开',
      } as Partial<EventModel>,
    });

    bc = new BroadcastChannel(DANMAKU_WINDOW_BROADCAST_CHANNEL);

    if (danmakuClient.connected) {
      danmakuClient.onEvent('danmaku', (event) => onGetDanmakus(event));
      danmakuClient.onEvent('gift', (event) => onGetDanmakus(event));
      danmakuClient.onEvent('sc', (event) => onGetDanmakus(event));
      danmakuClient.onEvent('guard', (event) => onGetDanmakus(event));
      danmakuClient.onEvent('enter', (event) => onGetDanmakus(event));
      danmakuClient.onEvent('scDel', (event) => onGetDanmakus(event));
    }
  }

  function onGetDanmakus(data: EventModel) {
    bc?.postMessage({
      type: 'danmaku',
      data,
    });
  }

  watch(danmakuWindowSetting, async (newValue) => {
    if (danmakuWindow.value) {
      if (await danmakuWindow.value.window.isVisible()) {
        danmakuWindow.value.setSize(new PhysicalSize(newValue.width, newValue.height));
        danmakuWindow.value.setPosition(new PhysicalPosition(newValue.x, newValue.y));
      }
      bc?.postMessage({
        type: 'update-setting',
        data: newValue,
      });
    }
  }, { deep: true });

  return {
    danmakuWindow,
    danmakuWindowSetting,
    setDanmakuWindowSize,
    setDanmakuWindowPosition,
    updateSetting,
    isDanmakuWindowOpen: computed(() => !!danmakuWindow.value),
    createWindow,
    closeWindow,
    hideWindow
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useDanmakuWindow, import.meta.hot));
}