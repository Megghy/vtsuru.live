import type { TrayIconOptions } from '@tauri-apps/api/tray'
import { invoke } from '@tauri-apps/api/core'
import { Menu } from '@tauri-apps/api/menu'
import { TrayIcon } from '@tauri-apps/api/tray'
import { getAllWebviewWindows } from '@tauri-apps/api/webviewWindow'
import { getCurrentWindow, PhysicalSize } from '@tauri-apps/api/window'
import { attachConsole, info, warn } from '@tauri-apps/plugin-log'
import {
  isPermissionGranted,
  onAction,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification'
import { openUrl } from '@tauri-apps/plugin-opener'
import { relaunch } from '@tauri-apps/plugin-process'
import { check } from '@tauri-apps/plugin-updater'
import { h, ref } from 'vue'
import { isLoggedIn, useAccount } from '@/api/account'
import { CN_HOST, isDev } from '@/data/constants'
import { useWebFetcher } from '@/store/useWebFetcher'
import { useAutoAction } from '../store/useAutoAction'
import { useBiliCookie } from '../store/useBiliCookie'
import { useBiliFunction } from '../store/useBiliFunction'
import { useDanmakuWindow } from '../store/useDanmakuWindow'
import { useSettings } from '../store/useSettings'
import { initInfo } from './info'
import { getBuvid, getRoomKey } from './utils'

const accountInfo = useAccount()

export const clientInited = ref(false)
export const clientInitStage = ref('')
let tray: TrayIcon
let heartbeatTimer: number | null = null
let updateCheckTimer: number | null = null
let updateNotificationRef: any = null

async function sendHeartbeat() {
  try {
    await invoke('heartbeat', undefined, {
      headers: [['Origin', location.host]],
    })
  } catch (error) {
    console.error('发送心跳失败:', error)
  }
}

export function startHeartbeat() {
  // 立即发送一次，确保后端在加载后快速收到心跳
  void sendHeartbeat()

  // 之后每 5 秒发送一次心跳（后端超时时间为 15 秒）
  heartbeatTimer = window.setInterval(() => {
    void sendHeartbeat()
  }, 2000)
  info('[心跳] 定时器已启动，间隔 2 秒')
}

export function stopHeartbeat() {
  if (heartbeatTimer !== null) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
    info('[心跳] 定时器已停止')
  }
}

export function startUpdateCheck() {
  // 立即检查一次更新
  void checkUpdatePeriodically()

  // 之后每 6 小时检查一次更新
  updateCheckTimer = window.setInterval(() => {
    void checkUpdatePeriodically()
  }, 6 * 60 * 60 * 1000) // 6 hours
  info('[更新检查] 定时器已启动，间隔 6 小时')
}

export function stopUpdateCheck() {
  if (updateCheckTimer !== null) {
    clearInterval(updateCheckTimer)
    updateCheckTimer = null
    info('[更新检查] 定时器已停止')
  }
  if (updateNotificationRef) {
    updateNotificationRef.destroy()
    updateNotificationRef = null
  }
}

async function checkUpdatePeriodically() {
  try {
    info('[更新检查] 开始检查更新...')
    const update = await check()

    if (update) {
      info(`[更新检查] 发现新版本: ${update.version}`)

      // 发送 Windows 通知
      const permissionGranted = await isPermissionGranted()
      if (permissionGranted) {
        sendNotification({
          title: 'VTsuru.Client 更新可用',
          body: `发现新版本 ${update.version}，点击通知查看详情`,
        })
      }

      // 显示不可关闭的 NaiveUI notification
      if (!updateNotificationRef) {
        updateNotificationRef = window.$notification.warning({
          title: '发现新版本',
          content: `VTsuru.Client ${update.version} 现已可用`,
          meta: update.date,
          action: () => {
            return h('div', { style: 'display: flex; gap: 8px; margin-top: 8px;' }, [
              h(
                'button',
                {
                  class: 'n-button n-button--primary-type n-button--small-type',
                  onClick: () => {
                    void handleUpdateInstall(update)
                  },
                },
                '立即更新',
              ),
              h(
                'button',
                {
                  class: 'n-button n-button--default-type n-button--small-type',
                  onClick: () => handleUpdateDismiss(),
                },
                '稍后提醒',
              ),
            ])
          },
          closable: false,
          duration: 0, // 不自动关闭
        })
      }
    } else {
      info('[更新检查] 当前已是最新版本')
    }
  } catch (error) {
    warn(`[更新检查] 检查更新失败: ${error}`)
  }
}

async function handleUpdateInstall(update: any) {
  try {
    // 关闭提示
    if (updateNotificationRef) {
      updateNotificationRef.destroy()
      updateNotificationRef = null
    }

    // 显示下载进度通知
    let downloaded = 0
    let contentLength = 0
    const progressPercentage = ref(0)
    const progressText = ref('准备下载更新...')
    const progressNotification = window.$notification.info({
      title: '正在下载更新',
      content: () =>
        h('div', { style: 'display: flex; flex-direction: column; gap: 10px; min-width: 240px;' }, [
          h('div', {
            style: 'height: 6px; border-radius: 999px; background: rgba(0,0,0,0.12); overflow: hidden; backdrop-filter: blur(6px);',
          }, [
            h('div', {
              style: `height: 100%; width: ${progressPercentage.value}%; background: linear-gradient(90deg, #5c7cfa, #91a7ff); transition: width 0.2s ease;`,
            }),
          ]),
          h('div', {
            style: 'font-size: 12px; color: var(--n-text-color); text-align: center;',
          }, progressText.value),
        ]),
      closable: false,
      duration: 0,
    })

    info('[更新] 开始下载并安装更新')
    await update.downloadAndInstall((event: any) => {
      switch (event.event) {
        case 'Started':
          contentLength = event.data.contentLength || 0
          info(`[更新] 开始下载 ${contentLength} 字节`)
          progressPercentage.value = 0
          progressText.value = '正在连接下载源...'
          break
        case 'Progress': {
          downloaded += event.data.chunkLength
          const progress = contentLength > 0 ? Math.round((downloaded / contentLength) * 100) : 0
          progressPercentage.value = Number.isFinite(progress) ? progress : 0
          const downloadedMb = Math.max(downloaded / 1024 / 1024, 0)
          const totalMb = Math.max(contentLength / 1024 / 1024, 0)
          const formatMb = (value: number) =>
            value >= 100 ? Math.round(value).toString() : (Math.round(value * 10) / 10).toString()
          progressText.value = contentLength > 0
            ? `已下载 ${formatMb(downloadedMb)}MB / ${formatMb(totalMb)}MB`
            : '正在下载更新...'
          info(`[更新] 已下载 ${downloaded} / ${contentLength} 字节`)
          break
        }
        case 'Finished':
          info('[更新] 下载完成')
          progressPercentage.value = 100
          progressText.value = '下载完成，正在安装...'
          break
      }
    })

    progressNotification.destroy()
    info('[更新] 更新安装完成，准备重启应用')

    window.$notification.success({
      title: '更新完成',
      content: '应用将在 3 秒后重启',
      duration: 3000,
    })

    // 延迟 3 秒后重启
    await new Promise(resolve => setTimeout(resolve, 3000))
    await relaunch()
  } catch (error) {
    warn(`[更新] 安装更新失败: ${error}`)
    window.$notification.error({
      title: '更新失败',
      content: `更新安装失败: ${error}`,
      duration: 5000,
    })
  }
}

function handleUpdateDismiss() {
  if (updateNotificationRef) {
    updateNotificationRef.destroy()
    updateNotificationRef = null
  }
  info('[更新] 用户选择稍后更新')
}

export async function initAll(isOnBoot: boolean) {
  const setting = useSettings()
  if (clientInited.value) {
    return
  }
  clientInitStage.value = '初始化中...'
  // 初始检查更新（不阻塞初始化）
  if (!isDev) {
    void checkUpdate()
  }
  const appWindow = getCurrentWindow()
  let permissionGranted = await isPermissionGranted()

  // If not we need to request it
  if (!permissionGranted) {
    const permission = await requestPermission()
    permissionGranted = permission === 'granted'
    if (permissionGranted) {
      info('Notification permission granted')
    }
  }

  if (isOnBoot) {
    if (setting.settings.bootAsMinimized && !isDev && await appWindow.isVisible()) {
      appWindow.hide()
      sendNotification({
        title: 'VTsuru.Client',
        body: '已启动并最小化到托盘',
      })
    }
  }
  initNotificationHandler()
  await attachConsole()
  const settings = useSettings()
  const biliCookie = useBiliCookie()
  clientInitStage.value = '加载设置...'
  await settings.init()
  info('[init] 已加载账户信息')
  clientInitStage.value = '加载 Bilibili Cookie...'
  biliCookie.init()
  info('[init] 已加载bilibili cookie')
  clientInitStage.value = '初始化基础信息...'
  initInfo()
  info('[init] 开始更新数据')

  if (isLoggedIn.value && accountInfo.value.isBiliVerified && !setting.settings.dev_disableDanmakuClient) {
    const danmakuInitNoticeRef = window.$notification.info({
      title: '正在初始化弹幕客户端...',
      closable: false,
    })
    clientInitStage.value = '初始化弹幕客户端...'
    const result = await initDanmakuClient()
    danmakuInitNoticeRef.destroy()
    if (result.success) {
      window.$notification.success({
        title: '弹幕客户端初始化完成',
        duration: 3000,
      })
      clientInitStage.value = '弹幕客户端初始化完成'
    } else {
      window.$notification.error({
        title: `弹幕客户端初始化失败: ${result.message}`,
      })
      clientInitStage.value = '弹幕客户端初始化失败'
    }
  }
  info('[init] 已加载弹幕客户端')
  // 初始化系统托盘图标和菜单
  clientInitStage.value = '创建系统托盘...'
  const menu = await Menu.new({
    items: [
      {
        id: 'open-devtools',
        text: '打开调试控制台',
        action: () => {
          void invoke('open_dev_tools')
        },
      },
      {
        id: 'quit',
        text: '退出',
        action: () => {
          invoke('quit_app')
        },
      },
    ],
  })
  const iconData = await (await fetch('https://oss.suki.club/vtsuru/icon.ico')).arrayBuffer()
  const options: TrayIconOptions = {
    // here you can add a tray menu, title, tooltip, event handler, etc
    menu,
    title: 'VTsuru.Client',
    tooltip: 'VTsuru 事件收集器',
    icon: iconData,
    action: (event) => {
      if (event.type === 'DoubleClick' || event.type === 'Click') {
        appWindow.show()
        appWindow.setFocus()
      }
    },
  }
  tray = await TrayIcon.new(options)
  clientInitStage.value = '系统托盘就绪'

  appWindow.setMinSize(new PhysicalSize(720, 480))

  getAllWebviewWindows().then(async (windows) => {
    const w = windows.find(win => win.label === 'danmaku-window')
    if (w) {
      const useWindow = useDanmakuWindow()
      useWindow.init()

      if ((useWindow.emojiData?.updateAt ?? 0) < Date.now() - 1000 * 60 * 60 * 24) {
        await useWindow.getEmojiData()
      }
      if (await w.isVisible()) {
        useWindow.isDanmakuWindowOpen = true

        console.log('弹幕窗口已打开')
      }
    }
  })

  window.addEventListener('keydown', (event) => {
    if (event.key === 'F12') {
      void invoke('open_dev_tools')
    }
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && (event.key === 'I' || event.key === 'i')) {
      void invoke('open_dev_tools')
    }
  })

  useAutoAction().init()
  useBiliFunction().init()

  // startHeartbeat()

  // 启动定期更新检查
  if (!isDev) {
    startUpdateCheck()
  }

  clientInited.value = true
  clientInitStage.value = '启动完成'
}
export function OnClientUnmounted() {
  if (clientInited.value) {
    clientInited.value = false
  }

  stopHeartbeat()
  stopUpdateCheck()
  tray.close()
  // useDanmakuWindow().closeWindow();
}

export async function checkUpdate() {
  // 手动检查更新（保留用于手动触发）
  await checkUpdatePeriodically()
}

export const isInitedDanmakuClient = ref(false)
export const isInitingDanmakuClient = ref(false)
export async function initDanmakuClient() {
  const biliCookie = useBiliCookie()
  const settings = useSettings()
  if (isInitedDanmakuClient.value || isInitingDanmakuClient.value) {
    info('弹幕客户端已初始化, 跳过初始化')
    return { success: true, message: '' }
  }
  isInitingDanmakuClient.value = true
  console.log(settings.settings)
  let result = { success: false, message: '' }
  try {
    if (isLoggedIn) {
      if (settings.settings.useDanmakuClientType === 'openlive') {
        result = await initOpenLive()
      } else {
        const cookie = await biliCookie.getBiliCookie()
        if (!cookie) {
          if (settings.settings.fallbackToOpenLive) {
            settings.settings.useDanmakuClientType = 'openlive'
            settings.save()
            info('未设置bilibili cookie, 根据设置切换为openlive')
            result = await initOpenLive()
          } else {
            info('未设置bilibili cookie, 跳过弹幕客户端初始化')
            window.$notification.warning({
              title: '未设置bilibili cookie, 跳过弹幕客户端初始化',
              duration: 5,
            })
            result = { success: false, message: '未设置bilibili cookie' }
          }
        } else {
          const resp = await callStartDanmakuClient()
          if (!resp?.success) {
            warn(`加载弹幕客户端失败: ${resp?.message}`)
            result = { success: false, message: resp?.message }
          } else {
            info('已加载弹幕客户端')
            result = { success: true, message: '' }
          }
        }
      }
    } else {
      info('未登录, 跳过弹幕客户端初始化')
      result = { success: true, message: '' }
    }
    return result
  } catch (err) {
    warn(`加载弹幕客户端失败: ${err}`)
    return { success: false, message: '加载弹幕客户端失败' }
  } finally {
    if (result) {
      isInitedDanmakuClient.value = true
    }
    isInitingDanmakuClient.value = false
  }
}
export async function initOpenLive() {
  const reuslt = await callStartDanmakuClient()
  if (reuslt?.success == true) {
    info('已加载弹幕客户端 [openlive]')
  } else {
    warn(`加载弹幕客户端失败 [openlive]: ${reuslt?.message}`)
  }
  return reuslt
}
function initNotificationHandler() {
  onAction((event) => {
    if (event.extra?.type === 'question-box') {
      openUrl(`${CN_HOST}/manage/question-box`)
    }
  })
}

export async function callStartDanmakuClient() {
  const biliCookie = useBiliCookie()
  const settings = useSettings()
  const webFetcher = useWebFetcher()
  if (settings.settings.useDanmakuClientType === 'direct') {
    info('开始初始化弹幕客户端 [direct]')
    const key = await getRoomKey(
      accountInfo.value.biliRoomId,
      await biliCookie.getBiliCookie() || '',
    )
    if (!key) {
      warn('获取房间密钥失败, 无法连接弹幕客户端')
      return { success: false, message: '无法获取房间密钥' }
    }
    const buvid = await getBuvid()
    if (!buvid) {
      warn('获取buvid失败, 无法连接弹幕客户端')
      return { success: false, message: '无法获取buvid' }
    }
    return webFetcher.Start('direct', {
      roomId: accountInfo.value.biliRoomId,
      buvid: buvid.data,
      token: key,
      tokenUserId: biliCookie.uId,
    }, true)
  } else {
    info('开始初始化弹幕客户端 [openlive]')
    return webFetcher.Start('openlive', undefined, true)
  }
}
