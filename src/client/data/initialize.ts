import { isLoggedIn, useAccount } from "@/api/account";
import { attachConsole, info, warn } from "@tauri-apps/plugin-log";
import { useSettings } from "../store/useSettings";
import { useWebFetcher } from "@/store/useWebFetcher";
import { useBiliCookie } from "../store/useBiliCookie";
import { getBuvid, getRoomKey } from "./utils";
import { initInfo } from "./info";
import { TrayIcon, TrayIconOptions } from '@tauri-apps/api/tray';
import { Menu } from "@tauri-apps/api/menu";
import { getCurrentWindow, PhysicalSize } from "@tauri-apps/api/window";
import {
  isPermissionGranted,
  onAction,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import { openUrl } from "@tauri-apps/plugin-opener";
import { CN_HOST, isDev } from "@/data/constants";
import { invoke } from "@tauri-apps/api/core";
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { useDanmakuWindow } from "../store/useDanmakuWindow";
import { getAllWebviewWindows } from "@tauri-apps/api/webviewWindow";

const accountInfo = useAccount();

export const clientInited = ref(false);
let tray: TrayIcon;
export async function initAll(isOnBoot: boolean) {
  const setting = useSettings();
  if (clientInited.value) {
    return;
  }
  checkUpdate();
  const appWindow = getCurrentWindow();
  let permissionGranted = await isPermissionGranted();

  // If not we need to request it
  if (!permissionGranted) {
    const permission = await requestPermission();
    permissionGranted = permission === 'granted';
    if (permissionGranted) {
      info('Notification permission granted');
    }
  }

  if (isOnBoot) {
    if (setting.settings.bootAsMinimized && !isDev && await appWindow.isVisible()) {
      appWindow.hide();
      sendNotification({
        title: "VTsuru.Client",
        body: '已启动并最小化到托盘'
      });
    }
  }
  initNotificationHandler();
  const detach = await attachConsole();
  const settings = useSettings();
  const biliCookie = useBiliCookie();
  await settings.init();
  info('[init] 已加载账户信息');
  biliCookie.init();
  info('[init] 已加载bilibili cookie');
  initInfo();
  info('[init] 开始更新数据');

  if (isLoggedIn && accountInfo.value.isBiliVerified && !setting.settings.dev_disableDanmakuClient) {
    const danmakuInitNoticeRef = window.$notification.info({
      title: '正在初始化弹幕客户端...',
      closable: false
    });
    const result = await initDanmakuClient();
    danmakuInitNoticeRef.destroy();
    if (result.success) {
      window.$notification.success({
        title: '弹幕客户端初始化完成',
        duration: 3000
      });
    } else {
      window.$notification.error({
        title: '弹幕客户端初始化失败: ' + result.message,
      });
    }
  }
  info('[init] 已加载弹幕客户端');
  // 初始化系统托盘图标和菜单
  const menu = await Menu.new({
    items: [
      {
        id: 'quit',
        text: '退出',
        action: () => {
          invoke('quit_app');
        },
      },
    ],
  });
  const iconData = await (await fetch('https://oss.suki.club/vtsuru/icon.ico')).arrayBuffer();
  const options: TrayIconOptions = {
    // here you can add a tray menu, title, tooltip, event handler, etc
    menu: menu,
    title: 'VTsuru.Client',
    tooltip: 'VTsuru 事件收集器',
    icon: iconData,
    action: (event) => {

      switch (event.type) {
        case 'DoubleClick':
          appWindow.show();
          break;
        case 'Click':
          appWindow.show();
          break;
      }
    }
  };
  tray = await TrayIcon.new(options);

  appWindow.setMinSize(new PhysicalSize(720, 480));

  getAllWebviewWindows().then(async (windows) => {
    const w = windows.find((win) => win.label === 'danmaku-window')
    if (w) {
      const useWindow = useDanmakuWindow();
      useWindow.init();

      if ((useWindow.emojiData?.updateAt ?? 0) < Date.now() - 1000 * 60 * 60 * 24) {
        await useWindow.getEmojiData();
      }
      if (await w.isVisible()) {
        useWindow.isDanmakuWindowOpen = true;

        console.log('弹幕窗口已打开');
      }
    }
  });

  // 监听f12事件
  if (!isDev) {
    window.addEventListener('keydown', (event) => {
      if (event.key === 'F12') {
        event.preventDefault();
        event.stopPropagation();
      }
    });
  }

  clientInited.value = true;
}
export function OnClientUnmounted() {
  if (clientInited.value) {
    clientInited.value = false;
  }

  tray.close();
  //useDanmakuWindow().closeWindow();
}

async function checkUpdate() {
  const update = await check();
  console.log(update);
  if (update) {
    console.log(
      `found update ${update.version} from ${update.date} with notes ${update.body}`
    );
    let downloaded = 0;
    let contentLength = 0;
    // alternatively we could also call update.download() and update.install() separately
    await update.downloadAndInstall((event) => {
      switch (event.event) {
        case 'Started':
          contentLength = event.data.contentLength || 0;
          console.log(`started downloading ${event.data.contentLength} bytes`);
          break;
        case 'Progress':
          downloaded += event.data.chunkLength;
          console.log(`downloaded ${downloaded} from ${contentLength}`);
          break;
        case 'Finished':
          console.log('download finished');
          break;
      }
    });

    console.log('update installed');
    await relaunch();
  }
}

export const isInitedDanmakuClient = ref(false);
export const isInitingDanmakuClient = ref(false);
export async function initDanmakuClient() {
  const biliCookie = useBiliCookie();
  const settings = useSettings();
  if (isInitedDanmakuClient.value || isInitingDanmakuClient.value) {
    return { success: true, message: '' };
  }
  isInitingDanmakuClient.value = true;
  let result = { success: false, message: '' };
  try {
    if (isLoggedIn) {
      if (settings.settings.useDanmakuClientType === 'openlive') {
        result = await initOpenLive();
      } else {
        const cookie = await biliCookie.getBiliCookie();
        if (!cookie) {
          if (settings.settings.fallbackToOpenLive) {
            settings.settings.useDanmakuClientType = 'openlive';
            settings.save();
            info('未设置bilibili cookie, 根据设置切换为openlive');
            result = await initOpenLive();
          } else {
            info('未设置bilibili cookie, 跳过弹幕客户端初始化');
            window.$notification.warning({
              title: '未设置bilibili cookie, 跳过弹幕客户端初始化',
              duration: 5,
            });
            result = { success: false, message: '未设置bilibili cookie' };
          }
        } else {
          const resp = await callStartDanmakuClient();
          if (!resp?.success) {
            warn('加载弹幕客户端失败: ' + resp?.message);
            result = { success: false, message: resp?.message };
          } else {
            info('已加载弹幕客户端');
            result = { success: true, message: '' };
          }
        }
      }
    }
    return result;
  } catch (err) {
    warn('加载弹幕客户端失败: ' + err);
    return { success: false, message: '加载弹幕客户端失败' };
  } finally {
    if (result) {
      isInitedDanmakuClient.value = true;
    }
    isInitingDanmakuClient.value = false;
  }
}
export async function initOpenLive() {
  const reuslt = await callStartDanmakuClient();
  if (reuslt?.success == true) {
    info('已加载弹幕客户端 [openlive]');
  } else {
    warn('加载弹幕客户端失败 [openlive]: ' + reuslt?.message);
  }
  return reuslt;
}
function initNotificationHandler() {
  onAction((event) => {
    if (event.extra?.type === 'question-box') {
      openUrl(CN_HOST + '/manage/question-box');
    }
  });
}

export async function callStartDanmakuClient() {
  const biliCookie = useBiliCookie();
  const settings = useSettings();
  const webFetcher = useWebFetcher();
  if (settings.settings.useDanmakuClientType === 'direct') {
    const key = await getRoomKey(
      accountInfo.value.biliRoomId!, await biliCookie.getBiliCookie() || '');
    if (!key) {
      warn('获取房间密钥失败, 无法连接弹幕客户端');
      return { success: false, message: '无法获取房间密钥' };
    }
    const buvid = await getBuvid();
    if (!buvid) {
      warn('获取buvid失败, 无法连接弹幕客户端');
      return { success: false, message: '无法获取buvid' };
    }
    return await webFetcher.Start('direct', {
      roomId: accountInfo.value.biliRoomId!,
      buvid: buvid.data,
      token: key,
      tokenUserId: biliCookie.uId!,
    }, true);
  } else {
    return await webFetcher.Start('openlive', undefined, true);
  }
}