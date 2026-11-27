import { defaultWindowIcon } from '@tauri-apps/api/app'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { Menu } from '@tauri-apps/api/menu'
import type { TrayIconOptions } from '@tauri-apps/api/tray'
import { TrayIcon } from '@tauri-apps/api/tray'
import { getAllWebviewWindows } from '@tauri-apps/api/webviewWindow'
import { getCurrentWindow, PhysicalSize } from '@tauri-apps/api/window'
import { attachConsole, info, warn } from '@tauri-apps/plugin-log'
import { isPermissionGranted, onAction, requestPermission } from '@tauri-apps/plugin-notification'
import { openUrl } from '@tauri-apps/plugin-opener'
import { relaunch } from '@tauri-apps/plugin-process'
import { check } from '@tauri-apps/plugin-updater'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { isLoggedIn, useAccount } from '@/api/account'
import router from '@/app/router'
import {
  clientSupportsRpc,
  clientVersion,
  CN_HOST,
  compareVersion,
  initClientVersion,
  isDev,
  isTauri,
  REQUIRED_CLIENT_VERSION,
} from '@/shared/config'
import { useFetcherRpcServer } from '@/store/useFetcherRpcServer'
import { useLiveEmoji } from '@/store/useLiveEmoji'
import { useWebFetcher } from '@/store/useWebFetcher'

import { useAutoAction } from '../store/useAutoAction'
import { useBiliAccountManager } from '../store/useBiliAccountManager'
import { useBiliCookie } from '../store/useBiliCookie'
import { useBiliFunction } from '../store/useBiliFunction'
import { useClientBackup } from '../store/useClientBackup'
import { useClientShortcuts } from '../store/useClientShortcuts'
import { useDanmakuWindow } from '../store/useDanmakuWindow'
import { useLiveRoutine } from '../store/useLiveRoutine'
import { useManagedTools } from '../store/useManagedTools'
import { usePngtuberDriver } from '../store/usePngtuberDriver'
import { useSettings } from '../store/useSettings'
import { useTranscription } from '../store/useTranscription'
import { useVtsStore } from '../store/useVtsStore'
import { initInfo, isLiveStreaming, roomInfo } from './info'
import { notifyBootMinimized, notifyClientUpdate, onBiliCookieInvalid, onLiveStatusChanged } from './notification'
import { getBuvid, getRoomKey } from './utils'

const accountInfo = useAccount()

export const clientInited = ref(false)
export const clientInitStage = ref('')
export const isCheckingUpdate = ref(false)
export const isClientVersionOutdated = computed(() => {
  if (!isTauri() || !clientVersion.value) return false
  return compareVersion(clientVersion.value, REQUIRED_CLIENT_VERSION) < 0
})

let tray: TrayIcon | undefined
let updateCheckTimer: number | null = null
let trayEventUnlisten: (() => void) | null = null
let mainCloseUnlisten: (() => void) | null = null
let closeExitEventUnlisten: (() => void) | null = null
let isExitingClient = false
const UPDATE_TOAST_ID = 'client-update-available'
const UPDATE_PROGRESS_ID = 'client-update-progress'
const NATIVE_TRAY_ID = 'main-tray'

export async function gracefulExitClient() {
  if (isExitingClient || !isTauri()) return
  isExitingClient = true
  try {
    await Promise.race([useWebFetcher().Stop(), new Promise((resolve) => setTimeout(resolve, 1500))])
  } catch {
    // 忽略清理异常，确保正常退出
  }
  await invoke('quit_app')
}

function setInitStageSafely(stage: string) {
  if (clientInitStage.value !== '启动完成') {
    clientInitStage.value = stage
  }
}

function startDanmakuClientInitFlow() {
  const loadingToastId = toast.loading('正在初始化弹幕客户端...')
  setInitStageSafely('初始化弹幕客户端...')

  void initDanmakuClient()
    .then((result) => {
      if (result.success) {
        info('[init] 弹幕客户端初始化完成')
        toast.success('弹幕客户端初始化完成', { id: loadingToastId, duration: 3000 })
        setInitStageSafely('弹幕客户端初始化完成')
      } else {
        warn(`[init] 弹幕客户端初始化失败: ${result.message}`)
        toast.error('弹幕客户端初始化失败', {
          id: loadingToastId,
          description: result.message || '请稍后重试',
        })
        setInitStageSafely('弹幕客户端初始化失败')
      }
    })
    .catch((error) => {
      warn(`[init] 弹幕客户端初始化异常: ${error}`)
      toast.error('弹幕客户端初始化异常', {
        id: loadingToastId,
        description: `${error}`,
      })
      setInitStageSafely('弹幕客户端初始化失败')
    })
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      setTimeout(() => {
        warn(`[init] 异步任务在 ${ms}ms 内未完成，已触发超时熔断`)
        resolve(fallback)
      }, ms)
    }),
  ])
}

async function getTrayIcon(): Promise<TrayIconOptions['icon']> {
  try {
    const icon = await defaultWindowIcon()
    if (icon) return icon
  } catch (err) {
    warn(`[tray] 获取原生默认窗口图标失败: ${err}`)
  }

  try {
    const res = await fetch('/favicon.ico', { signal: AbortSignal.timeout(1500) })
    if (res.ok) return await res.arrayBuffer()
  } catch {}

  try {
    const res = await fetch('https://oss.suki.club/vtsuru/icon.ico', { signal: AbortSignal.timeout(1500) })
    if (res.ok) return await res.arrayBuffer()
  } catch {}

  return undefined
}

async function initSystemTray(appWindow: ReturnType<typeof getCurrentWindow>) {
  setInitStageSafely('检查系统托盘...')
  try {
    // 若新版 Rust 宿主已在 setup 中创建原生托盘，跳过前端重复创建
    const existingNativeTray = await TrayIcon.getById(NATIVE_TRAY_ID).catch(() => null)
    if (existingNativeTray) {
      info('[tray] 检测到 Rust 原生托盘已就绪，跳过前端重复创建')
      if (!trayEventUnlisten) {
        trayEventUnlisten = await listen('tray://check-update', () => {
          void checkUpdate(true)
        })
      }
      return
    }

    if (tray) {
      try {
        await tray.close()
      } catch {}
      tray = undefined
    }

    const menu = await Menu.new({
      items: [
        {
          id: 'show-main',
          text: '显示主界面',
          action: () => {
            void appWindow.unminimize().catch(() => {})
            void appWindow.show().catch(async (err) => warn(`[tray] 显示窗口失败: ${err}`))
            void appWindow.setFocus().catch(async (err) => warn(`[tray] 聚焦窗口失败: ${err}`))
          },
        },
        {
          id: 'toggle-danmaku',
          text: '打开/关闭弹幕机',
          action: () => {
            const danmakuStore = useDanmakuWindow()
            if (danmakuStore.isDanmakuWindowOpen) danmakuStore.closeWindow()
            else danmakuStore.openWindow()
          },
        },
        {
          id: 'open-devtools',
          text: '打开调试控制台',
          action: () => {
            void invoke('open_dev_tools')
          },
        },
        {
          id: 'quit',
          text: '退出程序',
          action: () => {
            void invoke('quit_app').catch((err) => warn(`[tray] 退出失败: ${err}`))
          },
        },
      ],
    })

    const icon = await getTrayIcon()
    const options: TrayIconOptions = {
      menu,
      menuOnLeftClick: false,
      title: 'VTsuru.Client',
      tooltip: 'VTsuru 事件收集器',
      ...(icon ? { icon } : {}),
      action: (event) => {
        if (
          (event.type === 'Click' && event.button === 'Left' && event.buttonState === 'Up') ||
          event.type === 'DoubleClick'
        ) {
          void appWindow.unminimize().catch(() => {})
          void appWindow.show().catch(async (err) => warn(`[tray] 显示窗口失败: ${err}`))
          void appWindow.setFocus().catch(async (err) => warn(`[tray] 聚焦窗口失败: ${err}`))
        }
      },
    }

    tray = await TrayIcon.new(options)
    info('[tray] 兼容模式前端托盘创建成功')
  } catch (err) {
    warn(`[tray] 系统托盘创建失败，降级跳过: ${err}`)
  } finally {
    setInitStageSafely('系统托盘就绪')
  }
}

export function startUpdateCheck() {
  void checkUpdate(false)
  if (updateCheckTimer !== null) clearInterval(updateCheckTimer)
  updateCheckTimer = window.setInterval(
    () => {
      void checkUpdate(false)
    },
    6 * 60 * 60 * 1000,
  )
  info('[更新检查] 定时器已启动，间隔 6 小时')
}

export function stopUpdateCheck() {
  if (updateCheckTimer !== null) {
    clearInterval(updateCheckTimer)
    updateCheckTimer = null
    info('[更新检查] 定时器已停止')
  }
  toast.dismiss(UPDATE_TOAST_ID)
  toast.dismiss(UPDATE_PROGRESS_ID)
}

/**
 * 统一的更新检查与安装入口（定时与设置页手动检查共用）
 */
export async function checkUpdate(manual = false): Promise<boolean> {
  if (isCheckingUpdate.value) return false
  isCheckingUpdate.value = true
  try {
    info(`[更新检查] 开始检查更新 (manual=${manual})...`)
    const update = await check()

    if (update) {
      info(`[更新检查] 发现新版本: ${update.version}`)
      notifyClientUpdate(update.version)

      const summary = update.body?.trim() ? `\n${update.body.trim().slice(0, 120)}` : ''
      toast.warning(`发现新版本 ${update.version}`, {
        id: UPDATE_TOAST_ID,
        description: `VTsuru.Client ${update.version} 现已可用${update.date ? ` (${update.date})` : ''}${summary}`,
        duration: Infinity,
        action: {
          label: '立即更新',
          onClick: () => void handleUpdateInstall(update),
        },
        cancel: {
          label: '稍后提醒',
          onClick: handleUpdateDismiss,
        },
      })
      return true
    }

    info('[更新检查] 当前已是最新版本')
    if (manual) {
      toast.success('当前已是最新版本')
    }
    return false
  } catch (error) {
    warn(`[更新检查] 检查更新失败: ${error}`)
    if (manual) {
      toast.error('检查更新失败', { description: `${error}` })
    }
    return false
  } finally {
    isCheckingUpdate.value = false
  }
}

function showUpdateProgress(description: string) {
  toast.loading('正在下载更新', {
    id: UPDATE_PROGRESS_ID,
    description,
    duration: Infinity,
  })
}

async function handleUpdateInstall(update: NonNullable<Awaited<ReturnType<typeof check>>>) {
  try {
    toast.dismiss(UPDATE_TOAST_ID)
    let downloaded = 0
    let contentLength = 0
    showUpdateProgress('准备下载更新...')

    info('[更新] 开始下载并安装更新')
    await update.downloadAndInstall((event) => {
      switch (event.event) {
        case 'Started':
          contentLength = event.data.contentLength || 0
          info(`[更新] 开始下载 ${contentLength} 字节`)
          showUpdateProgress('正在连接下载源...')
          break
        case 'Progress': {
          downloaded += event.data.chunkLength
          const downloadedMb = Math.max(downloaded / 1024 / 1024, 0)
          const totalMb = Math.max(contentLength / 1024 / 1024, 0)
          const formatMb = (value: number) =>
            value >= 100 ? Math.round(value).toString() : (Math.round(value * 10) / 10).toString()
          showUpdateProgress(
            contentLength > 0 ? `已下载 ${formatMb(downloadedMb)}MB / ${formatMb(totalMb)}MB` : '正在下载更新...',
          )
          break
        }
        case 'Finished':
          info('[更新] 下载完成')
          showUpdateProgress('下载完成，正在安装...')
          break
      }
    })

    toast.dismiss(UPDATE_PROGRESS_ID)
    info('[更新] 更新安装完成，准备重启应用')
    toast.success('更新完成', { description: '应用将在 3 秒后重启', duration: 3000 })

    await new Promise((resolve) => setTimeout(resolve, 3000))
    try {
      await useWebFetcher().Stop()
    } catch (stopError) {
      warn(`[更新] 重启前停止 EventFetcher 失败: ${stopError}`)
    }
    await relaunch()
  } catch (error) {
    warn(`[更新] 安装更新失败: ${error}`)
    toast.dismiss(UPDATE_PROGRESS_ID)
    toast.error('更新失败', { description: `更新安装失败: ${error}`, duration: 5000 })
  }
}

function handleUpdateDismiss() {
  toast.dismiss(UPDATE_TOAST_ID)
  info('[更新] 用户选择稍后更新')
}

export async function initAll(_isOnBoot?: boolean) {
  const settings = useSettings()
  if (clientInited.value) {
    return
  }
  clientInitStage.value = '初始化中...'
  await initClientVersion()
  if (!isTauri()) {
    if (isDev) {
      console.info('[init] Dev 网页调试模式：跳过 Tauri 原生初始化，仅加载纯前端客户端 Store')
      clientInitStage.value = '加载网页调试模块...'
      await settings.init()
      usePngtuberDriver()
      useAutoAction().init()
      void useVtsStore()
        .init()
        .catch((err) => console.warn('[VTS] 网页调试初始化失败:', err))
    } else {
      console.warn('[init] 非 Tauri 环境，跳过客户端原生初始化')
    }
    clientInited.value = true
    clientInitStage.value = '启动完成'
    return
  }
  info(`[init] 当前 client 版本: ${clientVersion.value ?? '未知'} (前端所需最低: ${REQUIRED_CLIENT_VERSION})`)

  const appWindow = getCurrentWindow()
  let permissionGranted = await isPermissionGranted()
  if (!permissionGranted) {
    const permission = await requestPermission()
    permissionGranted = permission === 'granted'
    if (permissionGranted) {
      info('Notification permission granted')
    }
  }

  initNotificationHandler()
  await attachConsole()

  clientInitStage.value = '加载设置...'
  await settings.init()

  // 仅在真正由系统开机自启启动（带 --autostart 参数）且用户开启了静默最小化时才隐藏主窗
  const launchedByAutostart = await invoke<boolean>('is_autostart_launch').catch(() => false)
  if (launchedByAutostart && settings.settings.bootAsMinimized && !isDev && (await appWindow.isVisible())) {
    void appWindow.hide()
    notifyBootMinimized()
  }

  // 同步看门狗自动重载与关窗行为到 Rust 宿主（兼容老壳忽略异常）
  if (settings.settings.watchdogAutoReload !== undefined) {
    void invoke('set_heartbeat_auto_reload', { enabled: Boolean(settings.settings.watchdogAutoReload) }).catch(() => {})
  }
  void invoke('set_close_window_action', {
    action: settings.settings.closeWindowAction || 'minimize-to-tray',
  }).catch(() => {})

  // 兜底拦截主窗口系统级关闭（Alt+F4 / 任务栏关闭），同时兼容未更新原生壳的旧客户端
  if (!mainCloseUnlisten) {
    mainCloseUnlisten = await appWindow.onCloseRequested((event) => {
      event.preventDefault()
      if (settings.settings.closeWindowAction === 'exit') {
        void gracefulExitClient()
      } else {
        void appWindow.hide()
      }
    })
  }
  if (!closeExitEventUnlisten) {
    closeExitEventUnlisten = await listen('window://close-exit-requested', () => {
      void gracefulExitClient()
    })
  }

  const biliCookie = useBiliCookie()
  clientInitStage.value = '加载 Bilibili 账号与 Cookie...'
  await biliCookie.init()
  info('[init] 已加载 Bilibili 账号与 Cookie')

  clientInitStage.value = '初始化基础信息...'
  initInfo()

  await withTimeout(initSystemTray(appWindow), 4000, undefined)

  const shouldInitDanmakuClient =
    isLoggedIn.value &&
    (accountInfo.value.isBiliVerified || accountInfo.value.isBiliAuthed) &&
    !settings.settings.dev_disableDanmakuClient
  if (shouldInitDanmakuClient) {
    startDanmakuClientInitFlow()
  } else {
    info('[init] 跳过弹幕客户端初始化')
  }

  appWindow.setMinSize(new PhysicalSize(860, 580))

  // 初始化浮窗 Store（不再依赖启动时预创建的常驻空 WebView，按需懒创建浮窗）
  void (async () => {
    const windows = await getAllWebviewWindows().catch(() => [])
    const danmakuStore = useDanmakuWindow()
    danmakuStore.init()
    await useLiveEmoji().ensureFresh()
    const dw = windows.find((win) => win.label === 'danmaku-window')
    if (dw && (await dw.isVisible().catch(() => false))) {
      danmakuStore.isDanmakuWindowOpen = true
    }

    const { useGiftWindow } = await import('@/apps/client/store/useGiftWindow')
    const giftStore = useGiftWindow()
    giftStore.init()
    const gw = windows.find((win) => win.label === 'gift-window')
    if (gw && (await gw.isVisible().catch(() => false))) {
      giftStore.isGiftWindowOpen = true
    }
  })()

  window.addEventListener('keydown', (event) => {
    if (event.key === 'F12') {
      void invoke('open_dev_tools')
    }
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && (event.key === 'I' || event.key === 'i')) {
      void invoke('open_dev_tools')
    }
  })

  usePngtuberDriver()
  useAutoAction().init()
  useBiliFunction().init()
  void useManagedTools()
    .init()
    .catch(async (err) => warn(`[Tools] 初始化失败: ${err}`))
  void useLiveRoutine()
    .init()
    .catch(async (err) => warn(`[Routine] 初始化失败: ${err}`))
  void useClientShortcuts()
    .init()
    .catch(async (err) => warn(`[Shortcuts] 初始化失败: ${err}`))
  void useVtsStore()
    .init()
    .catch(async (err) => warn(`[VTS] 初始化失败: ${err}`))
  await useClientBackup().init()
  await useTranscription().init()

  if (clientSupportsRpc()) {
    void useFetcherRpcServer()
      .start()
      .catch(async (err) => warn(`[RPC] 启动失败: ${err}`))
  } else {
    warn(
      `[RPC] 当前 client 版本 ${clientVersion.value ?? '未知'} 过旧, 跳过开放接口 (需 ${REQUIRED_CLIENT_VERSION}+, 请更新客户端)`,
    )
  }

  if (!isDev) {
    startUpdateCheck()
  }

  initClientLifecycleMonitors()

  clientInited.value = true
  clientInitStage.value = '启动完成'
}

let lifecycleMonitorsStop: (() => void) | null = null

function initClientLifecycleMonitors() {
  lifecycleMonitorsStop?.()

  const accountManager = useBiliAccountManager()
  let hasHydratedRoomState = false
  let prevLiveState = false

  const stopLiveWatch = watch(
    () => [Boolean(roomInfo.value), isLiveStreaming.value] as const,
    ([hasRoom, live]) => {
      if (!hasRoom) return
      if (!hasHydratedRoomState) {
        hasHydratedRoomState = true
        prevLiveState = live
        return
      }
      if (live !== prevLiveState) {
        prevLiveState = live
        onLiveStatusChanged(live, roomInfo.value?.title)
      }
    },
    { immediate: true },
  )

  let prevMainValid: boolean | null = null
  const stopAccountWatch = watch(
    () => accountManager.mainAccount,
    (acc) => {
      if (!acc) {
        prevMainValid = null
        return
      }
      if (prevMainValid === true && !acc.isValid) {
        onBiliCookieInvalid(acc.alias ? `${acc.name} (${acc.alias})` : acc.name || acc.id)
      }
      prevMainValid = acc.isValid
    },
    { deep: true, immediate: true },
  )

  lifecycleMonitorsStop = () => {
    stopLiveWatch()
    stopAccountWatch()
  }
}

export function OnClientUnmounted() {
  if (clientInited.value) {
    clientInited.value = false
  }

  lifecycleMonitorsStop?.()
  lifecycleMonitorsStop = null

  void useVtsStore().dispose()
  void useClientShortcuts().dispose()
  if (!isTauri()) return

  stopUpdateCheck()
  trayEventUnlisten?.()
  trayEventUnlisten = null
  mainCloseUnlisten?.()
  mainCloseUnlisten = null
  closeExitEventUnlisten?.()
  closeExitEventUnlisten = null
  void useClientBackup().dispose()
  void useTranscription().dispose()
  useFetcherRpcServer().dispose()
  const currentTray = tray
  tray = undefined
  void currentTray?.close()
}

export const isInitedDanmakuClient = ref(false)
export const isInitingDanmakuClient = ref(false)

export function resetDanmakuClientInitState() {
  isInitedDanmakuClient.value = false
  isInitingDanmakuClient.value = false
  info('弹幕客户端初始化状态已重置')
}

export async function initDanmakuClient() {
  const biliCookie = useBiliCookie()
  const settings = useSettings()
  if (isInitedDanmakuClient.value || isInitingDanmakuClient.value) {
    info('弹幕客户端已初始化, 跳过初始化')
    return { success: true, message: '' }
  }

  if (!settings.settings.enableEventFetcher) {
    info('EventFetcher 功能已禁用, 跳过弹幕客户端初始化')
    return { success: true, message: 'EventFetcher 已禁用' }
  }

  isInitingDanmakuClient.value = true
  let result = { success: false, message: '' }
  try {
    if (isLoggedIn.value) {
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
            toast.warning('未设置 Bilibili Cookie，已跳过弹幕客户端初始化', { duration: 5000 })
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
    isInitingDanmakuClient.value = false
    if (result.success) {
      isInitedDanmakuClient.value = true
    }
  }
}

export async function initOpenLive() {
  const result = await callStartDanmakuClient()
  if (result?.success === true) {
    info('已加载弹幕客户端 [openlive]')
  } else {
    warn(`加载弹幕客户端失败 [openlive]: ${result?.message}`)
  }
  return result
}

export async function callStartDanmakuClient() {
  const biliCookie = useBiliCookie()
  const settings = useSettings()
  const webFetcher = useWebFetcher()
  if (settings.settings.useDanmakuClientType === 'direct') {
    info('开始初始化弹幕客户端 [direct]')
    const key = await getRoomKey(accountInfo.value.biliRoomId, (await biliCookie.getBiliCookie()) || '')
    if (!key) {
      warn('获取房间密钥失败, 无法连接弹幕客户端')
      return { success: false, message: '无法获取房间密钥' }
    }
    const buvid = await getBuvid()
    if (!buvid) {
      warn('获取buvid失败, 无法连接弹幕客户端')
      return { success: false, message: '无法获取buvid' }
    }
    return webFetcher.Start(
      'direct',
      {
        roomId: accountInfo.value.biliRoomId,
        buvid,
        token: key,
        tokenUserId: biliCookie.uId,
      },
      true,
    )
  } else {
    info('开始初始化弹幕客户端 [openlive]')
    return webFetcher.Start('openlive', undefined, true)
  }
}

async function revealMainWindow() {
  try {
    const win = getCurrentWindow()
    await win.show()
    await win.unminimize()
    await win.setFocus()
  } catch (err) {
    warn(`[notification] 唤醒主窗口失败: ${err}`)
  }
}

function initNotificationHandler() {
  void onAction((event) => {
    const extra = (event as { notification?: { extra?: Record<string, unknown> } }).notification?.extra
    if (extra?.type === 'question-box') {
      void openUrl(`${CN_HOST}manage/question-box`)
    } else if (extra?.type === 'goods-buy') {
      void openUrl(`${CN_HOST}manage/goods-buy`)
    } else if (extra?.type === 'cookie-invalid') {
      void revealMainWindow()
      void router.push({ name: 'client-account-manage' })
    } else if (
      extra?.type === 'update' ||
      extra?.type === 'danmaku' ||
      extra?.type === 'live-status' ||
      extra?.type === 'auto-action' ||
      extra?.type === 'message-failed' ||
      extra?.type === 'live-danmaku-failed'
    ) {
      void revealMainWindow()
    }
  }).catch((err) => {
    warn(`[notification] 注册通知点击回调失败: ${err}`)
  })
}
