import { EventDataTypes, EventModel } from "@/api/api-models";
import { useDanmakuClient } from "@/store/useDanmakuClient";
import { PhysicalPosition, PhysicalSize } from "@tauri-apps/api/dpi";
import { getAllWebviewWindows, WebviewWindow } from "@tauri-apps/api/webviewWindow";

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
} | {
  type: 'window-ready';
};

export const useDanmakuWindow = defineStore('danmakuWindow', () => {
  const danmakuWindow = ref<WebviewWindow>();
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
  const isWindowOpened = ref(false);
  let bc: BroadcastChannel | undefined = undefined;

  function closeWindow() {
    danmakuWindow.value?.hide();
    isWindowOpened.value = false;
  }
  function openWindow() {
    if (!isInited) {
      init();
    }
    danmakuWindow.value?.show();
    isWindowOpened.value = true;
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
  function updateWindowPosition() {
    danmakuWindow.value?.setPosition(new PhysicalPosition(danmakuWindowSetting.value.x, danmakuWindowSetting.value.y));
  }
  let isInited = false;

  async function init() {
    if (isInited) return;
    danmakuWindow.value = (await getAllWebviewWindows()).find((win) => win.label === 'danmaku-window');
    if (!danmakuWindow.value) {
      window.$message.error('弹幕窗口不存在，请先打开弹幕窗口。');
      return;
    }
    console.log('打开弹幕窗口', danmakuWindow.value.label, danmakuWindowSetting.value);
    danmakuWindow.value.onCloseRequested(() => {
      danmakuWindow.value = undefined;
      bc?.close();
      bc = undefined;
    });

    await danmakuWindow.value.setIgnoreCursorEvents(false);
    await danmakuWindow.value.show();
    danmakuWindow.value.onCloseRequested(() => {
      closeWindow();
      console.log('弹幕窗口关闭');
    });
    danmakuWindow.value.onMoved(({
      payload: position
    }) => {
      danmakuWindowSetting.value.x = position.x;
      danmakuWindowSetting.value.y = position.y;
    });

    isWindowOpened.value = true;

    bc = new BroadcastChannel(DANMAKU_WINDOW_BROADCAST_CHANNEL);
    bc.onmessage = (event: MessageEvent<DanmakuWindowBCData>) => {
      if (event.data.type === 'window-ready') {
        console.log(`[danmaku-window] 窗口已就绪`);
        bc?.postMessage({
          type: 'update-setting',
          data: toRaw(danmakuWindowSetting.value),
        });
      }
    };
    bc.postMessage({
      type: 'window-ready',
    });
    bc.postMessage({
      type: 'update-setting',
      data: toRaw(danmakuWindowSetting.value),
    });

    bc?.postMessage({
      type: 'danmaku',
      data: {
        type: EventDataTypes.Message,
        msg: '弹幕窗口已打开',
      } as Partial<EventModel>,
    });

    danmakuClient.onEvent('danmaku', (event) => onGetDanmakus(event));
    danmakuClient.onEvent('gift', (event) => onGetDanmakus(event));
    danmakuClient.onEvent('sc', (event) => onGetDanmakus(event));
    danmakuClient.onEvent('guard', (event) => onGetDanmakus(event));
    danmakuClient.onEvent('enter', (event) => onGetDanmakus(event));
    danmakuClient.onEvent('scDel', (event) => onGetDanmakus(event));

    watch(() => danmakuWindowSetting, async (newValue) => {
      if (danmakuWindow.value) {
        bc?.postMessage({
          type: 'update-setting',
          data: toRaw(newValue.value),
        });
        if (newValue.value.alwaysOnTop) {
          await danmakuWindow.value.setAlwaysOnTop(true);
        }
        else {
          await danmakuWindow.value.setAlwaysOnTop(false);
        }
        if (newValue.value.interactive) {
          await danmakuWindow.value.setIgnoreCursorEvents(true);
        } else {
          await danmakuWindow.value.setIgnoreCursorEvents(false);
        }
      }
    }, { deep: true });

    isInited = true;
  }

  function onGetDanmakus(data: EventModel) {
    bc?.postMessage({
      type: 'danmaku',
      data,
    });
  }



  return {
    danmakuWindow,
    danmakuWindowSetting,
    setDanmakuWindowSize,
    setDanmakuWindowPosition,
    updateWindowPosition,
    isDanmakuWindowOpen: isWindowOpened,
    openWindow,
    closeWindow,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useDanmakuWindow, import.meta.hot));
}