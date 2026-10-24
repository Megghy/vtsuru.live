import { SquareArrowForward24Filled } from '@vicons/fluent'
import { usePreferredDark } from '@vueuse/core'
import type { Component, VNode } from 'vue'
import { computed, h, shallowRef } from 'vue'
import { toast } from 'vue-sonner'
import type { ExternalToast } from 'vue-sonner'

export { toast } from 'vue-sonner'

import { ThemeType } from '@/api/client-types'
import type { ResponseSongModel } from '@/api/generated/model'
import { SongPlatform } from '@/api/generated/model'
import { VTSURU_API_URL } from '@/shared/config'
import { usePersistedStorage } from '@/shared/storage/persist'
import FiveSingIcon from '@/svgs/fivesing.svg'
import NeteaseIcon from '@/svgs/netease.svg'

const isPreferredDark = usePreferredDark()
const themeType = usePersistedStorage('Settings.Theme', ThemeType.Auto)

export const isDarkMode = computed(() => {
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
  onPositiveClick?: () => void | Promise<void>
  onNegativeClick?: () => void
  onClose?: () => void
  class?: string
}

export const appDialog = shallowRef<AppDialogRequest | null>(null)

function openDialog(opts: AppDialogRequest) {
  appDialog.value = opts
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

export const loadingBar = {
  start: () => {},
  finish: () => {},
  error: () => {},
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

export function copyToClipboard(text: string) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text)
    message.success('已复制到剪切板')
  } else {
    message.warning('当前环境不支持自动复制, 请手动选择并复制')
  }
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

export function objectsToCSV(arr: any[]) {
  const array = [Object.keys(arr[0])].concat(arr)
  return array
    .map((row) => {
      return Object.values(row)
        .map((value) => {
          return typeof value === 'string' ? JSON.stringify(value) : value
        })
        .toString()
    })
    .join('\n')
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
  return `${VTSURU_API_URL}user-face/${userId}?size=${size}`
}

export function getOUIdAvatarUrl(ouid: string) {
  return `${VTSURU_API_URL}face/${ouid}`
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
        'button',
        {
          class:
            'inline-flex items-center justify-center h-7 px-2 text-xs font-medium rounded border border-[#00BBB3] text-[#00BBB3] hover:bg-[#00BBB3]/10 transition-colors',
          title: '在5sing打开',
          onClick: () => window.open(`http://5sing.kugou.com/bz/${song.id}.html`),
        },
        [h(FiveSingIcon, { class: 'svg-icon fivesing w-3.5 h-3.5 mr-1' }), '5sing'],
      )
    }
    case SongPlatform.Netease:
      return h(
        'button',
        {
          class:
            'inline-flex items-center justify-center h-7 px-2 text-xs font-medium rounded border border-[#C20C0C] text-[#C20C0C] hover:bg-[#C20C0C]/10 transition-colors',
          title: '在网易云打开',
          onClick: () => window.open(`https://music.163.com/#/song?id=${song.id}`),
        },
        [h(NeteaseIcon, { class: 'svg-icon netease w-3.5 h-3.5 mr-1' }), '网易云'],
      )
    case SongPlatform.Custom:
      return song.url
        ? h(
            'button',
            {
              class:
                'inline-flex items-center justify-center h-7 px-2 text-xs font-medium rounded border border-muted-foreground/30 text-foreground hover:bg-muted transition-colors',
              title: '打开链接',
              onClick: () => window.open(song.url),
            },
            [h(SquareArrowForward24Filled, { class: 'w-3.5 h-3.5 mr-1' }), '打开链接'],
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
