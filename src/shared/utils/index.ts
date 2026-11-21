import SquareArrowForward24Filled from '@vicons/fluent/es/SquareArrowForward24Filled'
import { usePreferredDark } from '@vueuse/core'
import type { Component, VNode } from 'vue'
import { computed, h, reactive, ref } from 'vue'
import { toast } from 'vue-sonner'
import type { ExternalToast } from 'vue-sonner'

export { toast } from 'vue-sonner'

import { ThemeType } from '@/api/client-types'
import type { ResponseSongModel } from '@/api/generated/model'
import { SongPlatform } from '@/api/generated/model'
import { getVtsuruApiUrl } from '@/shared/config'
import { usePersistedStorage } from '@/shared/storage/persist'
import { Button } from '@/shared/ui/button'
import FiveSingIcon from '@/svgs/fivesing.svg'
import NeteaseIcon from '@/svgs/netease.svg'

const isPreferredDark = usePreferredDark()
export const themeType = usePersistedStorage('Settings.Theme', ThemeType.Auto)
export const forcedThemeOverride = ref<'dark' | 'light' | null>(null)

export function setForcedThemeMode(mode: 'dark' | 'light' | null) {
  forcedThemeOverride.value = mode
}

export function cycleThemeType(current: ThemeType = themeType.value): ThemeType {
  switch (current) {
    case ThemeType.Auto:
      return ThemeType.Light
    case ThemeType.Light:
      return ThemeType.Dark
    case ThemeType.Dark:
    default:
      return ThemeType.Auto
  }
}

export function getThemeTypeLabel(type: ThemeType = themeType.value): string {
  switch (type) {
    case ThemeType.Auto:
      return '跟随系统'
    case ThemeType.Light:
      return '浅色主题'
    case ThemeType.Dark:
      return '深色主题'
  }
}

export const isDarkMode = computed(() => {
  if (forcedThemeOverride.value === 'dark') return true
  if (forcedThemeOverride.value === 'light') return false
  if (themeType.value === ThemeType.Auto) return isPreferredDark.value
  return themeType.value === ThemeType.Dark
})

export const theme = computed(() => (isDarkMode.value ? 'dark' : 'light'))

export const message = {
  success: (msg: unknown, options?: ExternalToast) => toast.success(String(msg), options),
  error: (msg: unknown, options?: ExternalToast) => toast.error(String(msg), options),
  warning: (msg: unknown, options?: ExternalToast) => toast.warning(String(msg), options),
  info: (msg: unknown, options?: ExternalToast) => toast.info(String(msg), options),
  loading: (msg: unknown, options?: ExternalToast) => toast.loading(String(msg), options),
  destroy: () => toast.dismiss(),
}

export function useMessage() {
  return message
}

type ToastAction = { label: string; onClick: () => void }

export type NotificationOpts = {
  title?: string
  content?: string
  description?: string
  duration?: number
  action?: ToastAction
  cancel?: ToastAction
}

function toToastHandle(id: string | number) {
  return { destroy: () => toast.dismiss(id) }
}

function showNotification(type: 'info' | 'success' | 'warning' | 'error', opts: string | NotificationOpts) {
  if (typeof opts === 'string') return toToastHandle(toast[type](opts))
  const duration = opts.duration === 0 ? Infinity : opts.duration
  return toToastHandle(
    toast[type](opts.title || opts.content || '', {
      description: opts.description ?? (opts.title ? opts.content : undefined),
      duration,
      action: opts.action,
      cancel: opts.cancel,
    }),
  )
}

export const notification = {
  create: (opts: NotificationOpts & { type?: 'info' | 'success' | 'warning' | 'error' }) =>
    showNotification(opts.type || 'info', opts),
  info: (opts: string | NotificationOpts) => showNotification('info', opts),
  success: (opts: string | NotificationOpts) => showNotification('success', opts),
  warning: (opts: string | NotificationOpts) => showNotification('warning', opts),
  error: (opts: string | NotificationOpts) => showNotification('error', opts),
}

export function useNotification() {
  return notification
}

export type AppDialogRequest = {
  title?: string
  content?: string | Component | (() => VNode)
  positiveText?: string
  negativeText?: string
  onPositiveClick?: () => void | boolean | Promise<void | boolean>
  onNegativeClick?: () => void
  onClose?: () => void
  class?: string
}

export const appDialogQueue = ref<AppDialogRequest[]>([])
export const appDialog = computed<AppDialogRequest | null>({
  get: () => appDialogQueue.value[0] ?? null,
  set: (val) => {
    if (val == null) {
      if (appDialogQueue.value.length > 0) {
        appDialogQueue.value = appDialogQueue.value.slice(1)
      }
      return
    }
    appDialogQueue.value = [...appDialogQueue.value, val]
  },
})

function openDialog(opts: AppDialogRequest) {
  appDialogQueue.value = [...appDialogQueue.value, opts]
}

export function shiftAppDialog() {
  if (appDialogQueue.value.length > 0) {
    appDialogQueue.value = appDialogQueue.value.slice(1)
  }
}

export const dialog = {
  create: openDialog,
  warning: openDialog,
  error: openDialog,
  info: openDialog,
  success: openDialog,
}

export function useDialog() {
  return dialog
}

export const loadingBarState = reactive({
  active: false,
  status: 'idle' as 'idle' | 'loading' | 'error',
  progress: 0,
})

let loadingBarTrickleTimer: ReturnType<typeof setInterval> | null = null
let loadingBarHideTimer: ReturnType<typeof setTimeout> | null = null

function clearLoadingBarTimers() {
  if (loadingBarTrickleTimer) {
    clearInterval(loadingBarTrickleTimer)
    loadingBarTrickleTimer = null
  }
  if (loadingBarHideTimer) {
    clearTimeout(loadingBarHideTimer)
    loadingBarHideTimer = null
  }
}

export const loadingBar = {
  start: () => {
    clearLoadingBarTimers()
    loadingBarState.active = true
    loadingBarState.status = 'loading'
    loadingBarState.progress = 18
    loadingBarTrickleTimer = setInterval(() => {
      if (loadingBarState.progress < 88) {
        loadingBarState.progress += Math.max(1.2, (90 - loadingBarState.progress) * 0.14)
      }
    }, 180)
  },
  finish: () => {
    clearLoadingBarTimers()
    if (!loadingBarState.active) return
    loadingBarState.status = 'idle'
    loadingBarState.progress = 100
    loadingBarHideTimer = setTimeout(() => {
      loadingBarState.active = false
      loadingBarState.progress = 0
    }, 220)
  },
  error: () => {
    clearLoadingBarTimers()
    loadingBarState.active = true
    loadingBarState.status = 'error'
    loadingBarState.progress = 100
    loadingBarHideTimer = setTimeout(() => {
      loadingBarState.active = false
      loadingBarState.status = 'idle'
      loadingBarState.progress = 0
    }, 400)
  },
}

export function useLoadingBar() {
  return loadingBar
}

if (typeof window !== 'undefined') {
  window.$message = message
  window.$notification = notification
  window.$dialog = dialog
  window.$loadingBar = loadingBar
}

export function NavigateToNewTab(url: string) {
  window.open(url, '_blank')
}

function copyWithExecCommand(text: string) {
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.left = '-9999px'
  document.body.append(area)
  area.select()
  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    area.remove()
  }
}

export async function copyToClipboard(text: string, customSuccessMessage?: string | false) {
  const notifySuccess = () => {
    if (customSuccessMessage === false) return
    message.success(customSuccessMessage ?? '已复制到剪切板')
  }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      notifySuccess()
      return true
    }
  } catch {
    // 插件 iframe 的 Permissions-Policy 会拒绝 clipboard-write，回退到选区复制。
  }
  if (copyWithExecCommand(text)) {
    notifySuccess()
    return true
  }
  message.warning('当前环境不支持自动复制, 请手动选择并复制')
  return false
}

export function showUndoToast(
  label: string,
  onUndo: () => void | Promise<void>,
  options?: { description?: string; duration?: number },
) {
  let undone = false
  toast.success(label, {
    description: options?.description,
    duration: options?.duration ?? 5000,
    action: {
      label: '撤销',
      onClick: () => {
        if (undone) return
        undone = true
        void Promise.resolve(onUndo()).catch((err) => {
          toast.error(`撤销失败: ${err instanceof Error ? err.message : String(err)}`)
        })
      },
    },
  })
}

export function hexToRgba(hex: string, alpha: number): string | null {
  const trimmedHex = hex.trim()
  if (!trimmedHex.startsWith('#')) return null
  const raw = trimmedHex.slice(1)
  if (raw.length === 3) {
    const r = Number.parseInt(raw[0] + raw[0], 16)
    const g = Number.parseInt(raw[1] + raw[1], 16)
    const b = Number.parseInt(raw[2] + raw[2], 16)
    if ([r, g, b].some((x) => Number.isNaN(x))) return null
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  if (raw.length === 6) {
    const r = Number.parseInt(raw.slice(0, 2), 16)
    const g = Number.parseInt(raw.slice(2, 4), 16)
    const b = Number.parseInt(raw.slice(4, 6), 16)
    if ([r, g, b].some((x) => Number.isNaN(x))) return null
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  return null
}

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const raw = String(value)
  if (/[,"\r\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`
  }
  return raw
}

export function objectsToCSV(arr: Record<string, unknown>[]) {
  if (!arr.length) return ''
  const headers = Object.keys(arr[0])
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...arr.map((row) => headers.map((key) => escapeCsvCell(row[key])).join(',')),
  ]
  return lines.join('\n')
}

export function GetGuardColor(level: number | null | undefined): string {
  if (level) {
    switch (level) {
      case 1: {
        return 'rgb(122, 4, 35)'
      }
      case 2: {
        return 'rgb(157, 155, 255)'
      }
      case 3: {
        return 'rgb(104, 136, 241)'
      }
    }
  }
  return ''
}

/** canvas.toBlob 的 Promise 封装 */
export async function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png', quality?: number): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), type, quality))
  if (!blob) throw new Error('canvas toBlob 失败')
  return blob
}

export function downloadImage(imageSrc: string, filename: string) {
  const image = new Image()
  image.crossOrigin = 'Anonymous'
  image.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const ctx = canvas.getContext('2d')
    ctx?.drawImage(image, 0, 0)
    canvas.toBlob((blob) => {
      if (blob) {
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
    })
  }
  image.src = imageSrc
}

export function getUserAvatarUrl(userId: number | undefined | null, size = 64) {
  if (!userId) return ''
  return `${getVtsuruApiUrl()}user-face/${userId}?size=${size}`
}

export function getOUIdAvatarUrl(ouid: string) {
  return `${getVtsuruApiUrl()}face/${ouid}`
}

export class GuidUtils {
  public static numToGuid(value: number): string {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error('输入必须是非负安全整数')
    }
    const buffer = new ArrayBuffer(16)
    new DataView(buffer).setBigUint64(8, BigInt(value), true)
    return GuidUtils.bufferToGuid(buffer)
  }

  public static toOuid(uid: number | null | undefined, openId: string): string {
    return uid && uid > 0 ? GuidUtils.numToGuid(uid) : openId
  }

  public static isGuidFromUserId(guid: string): boolean {
    try {
      const buffer = GuidUtils.guidToBuffer(guid)
      const view = new DataView(buffer)
      for (let i = 0; i < 8; i++) {
        if (view.getUint8(i) !== 0) return false
      }
      return true
    } catch {
      return false
    }
  }

  public static guidToLong(guid: string): number {
    try {
      const buffer = GuidUtils.guidToBuffer(guid)
      return Number(new DataView(buffer).getBigUint64(8, true))
    } catch {
      throw new Error('无效的GUID格式')
    }
  }

  private static bufferToGuid(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let hex = ''
    for (let i = 0; i < 16; i++) {
      hex += bytes[i].toString(16).padStart(2, '0')
    }
    return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(
      16,
      20,
    )}-${hex.substring(20)}`
  }

  private static guidToBuffer(guid: string): ArrayBuffer {
    const hex = guid.replace(/-/g, '')
    if (hex.length !== 32) throw new Error('无效的GUID格式')
    const buffer = new ArrayBuffer(16)
    const view = new Uint8Array(buffer)
    for (let i = 0; i < 16; i++) {
      const byteValue = Number.parseInt(hex.substr(i * 2, 2), 16)
      if (Number.isNaN(byteValue)) throw new Error('GUID包含非法字符')
      view.set([byteValue], i)
    }
    return buffer
  }
}

export function GetPlayButton(song: ResponseSongModel) {
  switch (song.from) {
    case SongPlatform.FiveSing: {
      return h(
        Button,
        {
          variant: 'outline',
          size: 'xs',
          class: 'gap-1 px-2 border-[#00BBB3] text-[#00BBB3] hover:bg-[#00BBB3]/10 hover:text-[#00BBB3]',
          title: '在5sing打开',
          onClick: () => window.open(`http://5sing.kugou.com/bz/${song.id}.html`),
        },
        () => [h(FiveSingIcon, { class: 'svg-icon fivesing !size-3.5' }), '5sing'],
      )
    }
    case SongPlatform.Netease:
      return h(
        Button,
        {
          variant: 'outline',
          size: 'xs',
          class: 'gap-1 px-2 border-[#C20C0C] text-[#C20C0C] hover:bg-[#C20C0C]/10 hover:text-[#C20C0C]',
          title: '在网易云打开',
          onClick: () => window.open(`https://music.163.com/#/song?id=${song.id}`),
        },
        () => [h(NeteaseIcon, { class: 'svg-icon netease !size-3.5' }), '网易云'],
      )
    case SongPlatform.Custom:
      return song.url
        ? h(
            Button,
            {
              variant: 'outline',
              size: 'xs',
              class: 'gap-1 px-2 border-muted-foreground/30 text-foreground hover:bg-muted',
              title: '打开链接',
              onClick: () => window.open(song.url),
            },
            () => [h(SquareArrowForward24Filled, { class: '!size-3.5' }), '打开链接'],
          )
        : null
  }
}

export function getBrowserName() {
  const userAgent = navigator.userAgent
  if (userAgent.includes('Opera') || userAgent.includes('OPR')) {
    return 'Opera'
  } else if (userAgent.includes('compatible') && userAgent.includes('MSIE')) {
    return 'IE'
  } else if (userAgent.includes('Edge')) {
    return 'Edge'
  } else if (userAgent.includes('Firefox')) {
    return 'Firefox'
  } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    return 'Safari'
  } else if (userAgent.includes('Chrome') && userAgent.includes('Safari')) {
    return 'Chrome'
  } else if (!!(window as any).ActiveXObject || 'ActiveXObject' in window) {
    return 'IE>=11'
  } else {
    return 'Unkonwn'
  }
}
