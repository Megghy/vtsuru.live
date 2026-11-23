import { invoke } from '@tauri-apps/api/core'
import { PhysicalPosition, PhysicalSize } from '@tauri-apps/api/dpi'
import type { WebviewOptions } from '@tauri-apps/api/webview'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import type { WindowOptions } from '@tauri-apps/api/window'

import { isTauri } from '@/shared/config'

export const DEFAULT_OVERLAY_POSITION = { x: 100, y: 100 }

/**
 * 与 vtsuru-fetcher-client 主窗口 tauri.conf.json 保持一致的默认 WebView2 启动参数；
 * Windows WebView2 要求共享同一 userDataFolder 的所有窗口具有完全一致的 additionalBrowserArgs，
 * 否则创建第二个窗口会抛出 HRESULT(0x8007139F) ERROR_INVALID_STATE。
 */
const DEFAULT_WEBVIEW2_BROWSER_ARGS =
  '--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection --autoplay-policy=no-user-gesture-required --disable-background-timer-throttling'

let cachedBrowserArgs: string | null | undefined

async function resolveWebviewBrowserArgs(): Promise<string | undefined> {
  if (cachedBrowserArgs !== undefined) {
    return cachedBrowserArgs ?? undefined
  }
  try {
    cachedBrowserArgs = await invoke<string | null>('get_webview_browser_args')
  } catch {
    // 兼容尚未包含 get_webview_browser_args 命令的旧版桌面壳
    cachedBrowserArgs = DEFAULT_WEBVIEW2_BROWSER_ARGS
  }
  return cachedBrowserArgs ?? undefined
}

type OverlayWebviewWindowOptions = Omit<WebviewOptions, 'x' | 'y' | 'width' | 'height'> &
  WindowOptions & {
    additionalBrowserArgs?: string
  }

export interface OverlayWindowCreateOptions {
  label: string
  url: string
  title: string
  width: number
  height: number
  x: number
  y: number
  resizable: boolean
  alwaysOnTop: boolean
}

export async function applyTransparentWindowBackground(win: {
  setBackgroundColor: (color: [number, number, number, number]) => Promise<void>
}) {
  try {
    await win.setBackgroundColor([0, 0, 0, 0])
  } catch (error) {
    console.warn('[overlay-window] 透明背景未生效', error)
  }
}

/**
 * 按需获取或懒创建透明置顶悬浮窗 WebviewWindow（不占用常驻后台 WebView2 内存）
 */
export async function ensureOverlayWindow(options: OverlayWindowCreateOptions): Promise<WebviewWindow | undefined> {
  if (!isTauri()) return undefined

  const existing = await WebviewWindow.getByLabel(options.label).catch(() => null)
  if (existing) {
    await applyTransparentWindowBackground(existing)
    return existing
  }

  const additionalBrowserArgs = await resolveWebviewBrowserArgs()
  const windowOptions: OverlayWebviewWindowOptions = {
    url: options.url,
    title: options.title,
    width: options.width,
    height: options.height,
    x: options.x,
    y: options.y,
    decorations: false,
    transparent: true,
    alwaysOnTop: options.alwaysOnTop,
    resizable: options.resizable,
    shadow: false,
    visible: false,
    skipTaskbar: true,
    ...(additionalBrowserArgs ? { additionalBrowserArgs } : {}),
  }

  const win = new WebviewWindow(options.label, windowOptions)

  await new Promise<void>((resolve, reject) => {
    void win.once('tauri://created', () => resolve())
    void win.once('tauri://error', (err) => reject(new Error(String(err.payload ?? err))))
  })

  await applyTransparentWindowBackground(win)
  await win.setSize(new PhysicalSize(options.width, options.height)).catch(() => {})
  await win.setPosition(new PhysicalPosition(options.x, options.y)).catch(() => {})
  return win
}

/**
 * 统一将 EventModel.price 归一化为非负人民币元（免费礼物在 OpenLive 中可能为负值）
 */
export function normalizePaidYuan(price: number | undefined | null): number {
  if (!price || !Number.isFinite(price) || price <= 0) return 0
  return Math.round(price * 100) / 100
}

/**
 * 统一格式化人民币元金额显示
 */
export function formatYuanPrice(yuan: number): string {
  if (!yuan || yuan <= 0) return '免费'
  if (yuan >= 1000) return `¥${Math.round(yuan)}`
  const fixed = Number(yuan.toFixed(2))
  return `¥${fixed}`
}
