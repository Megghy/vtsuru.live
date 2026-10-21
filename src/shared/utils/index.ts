import { SquareArrowForward24Filled } from '@vicons/fluent'
import { usePreferredDark } from '@vueuse/core'
export { toast } from 'vue-sonner'
import { toast } from 'vue-sonner'
import { computed, h } from 'vue'

import type { SongsInfo } from '@/api/api-models'
import { SongFrom, ThemeType } from '@/api/api-models'
import { buildSiteTokens, VTSURU_API_URL } from '@/shared/config'
import { usePersistedStorage } from '@/shared/storage/persist'
import type { UploadFileInfo } from '@/shared/types/upload'
import FiveSingIcon from '@/svgs/fivesing.svg'
import NeteaseIcon from '@/svgs/netease.svg'

export type { UploadFileInfo } from '@/shared/types/upload'

const isPreferredDark = usePreferredDark()
const themeType = usePersistedStorage('Settings.Theme', ThemeType.Auto)

export const isDarkMode = computed(() => {
  if (themeType.value === ThemeType.Auto) return isPreferredDark.value
  return themeType.value === ThemeType.Dark
})

export const theme = computed(() => (isDarkMode.value ? 'dark' : 'light'))

export const configProviderPropsRef = computed(() => ({
  theme: theme.value,
}))

export const message = {
  success: (msg: any, options?: any) => toast.success(typeof msg === 'string' ? msg : String(msg), options),
  error: (msg: any, options?: any) => toast.error(typeof msg === 'string' ? msg : String(msg), options),
  warning: (msg: any, options?: any) => toast.warning(typeof msg === 'string' ? msg : String(msg), options),
  info: (msg: any, options?: any) => toast.info(typeof msg === 'string' ? msg : String(msg), options),
  loading: (msg: any, options?: any) => toast.loading(typeof msg === 'string' ? msg : String(msg), options),
  destroy: () => toast.dismiss(),
}

export function useMessage() {
  return message
}

export const notification = {
  create: (opts: { title?: string; content?: string; type?: 'info' | 'success' | 'warning' | 'error'; duration?: number }) => {
    const fn = toast[opts.type || 'info'] || toast.info
    return fn(opts.title || '', { description: opts.content, duration: opts.duration })
  },
  info: (opts: any) => {
    if (typeof opts === 'string') return toast.info(opts)
    return toast.info(opts.title || opts.content || '', { description: opts.title ? opts.content : undefined, duration: opts.duration })
  },
  success: (opts: any) => {
    if (typeof opts === 'string') return toast.success(opts)
    return toast.success(opts.title || opts.content || '', { description: opts.title ? opts.content : undefined, duration: opts.duration })
  },
  warning: (opts: any) => {
    if (typeof opts === 'string') return toast.warning(opts)
    return toast.warning(opts.title || opts.content || '', { description: opts.title ? opts.content : undefined, duration: opts.duration })
  },
  error: (opts: any) => {
    if (typeof opts === 'string') return toast.error(opts)
    return toast.error(opts.title || opts.content || '', { description: opts.title ? opts.content : undefined, duration: opts.duration })
  },
}

export function useNotification() {
  return notification
}

export const dialog = {
  warning: (opts: { title?: string; content?: string; positiveText?: string; negativeText?: string; onPositiveClick?: () => void; onNegativeClick?: () => void }) => {
    if (window.confirm(`${opts.title || '提示'}\n${opts.content || ''}`)) {
      opts.onPositiveClick?.()
    } else {
      opts.onNegativeClick?.()
    }
  },
  error: (opts: any) => {
    window.alert(`${opts.title || '错误'}\n${opts.content || ''}`)
    opts.onPositiveClick?.()
  },
  info: (opts: any) => {
    window.alert(`${opts.title || '提示'}\n${opts.content || ''}`)
    opts.onPositiveClick?.()
  },
  success: (opts: any) => {
    window.alert(`${opts.title || '成功'}\n${opts.content || ''}`)
    opts.onPositiveClick?.()
  },
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

export function useModal() {
  return {
    create: (_opts: any) => {},
  }
}

// 兼容全局挂载
if (typeof window !== 'undefined') {
  ;(window as any).$message = message
  ;(window as any).$notification = notification
  ;(window as any).$dialog = dialog
  ;(window as any).$loadingBar = loadingBar
}

export function createNaiveUIApi(_types?: string[]) {
  return {
    message,
    notification,
    dialog,
    loadingBar,
  }
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

export async function getBase64(file: File | undefined | null): Promise<string | undefined> {
  if (!file) return new Promise((resolve) => resolve(undefined))
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result?.toString().split(',')[1] || undefined)
    reader.onerror = (error) => reject(error)
  })
}

export async function getImageUploadModel(
  files: UploadFileInfo[] | undefined | null,
  maxSize: number = 10 * 1024 * 1024,
) {
  const result = {
    existImages: [],
    newImagesBase64: [],
  } as { existImages: string[]; newImagesBase64: string[] }
  if (!files) return result
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    if ((file.file?.size ?? 0) > maxSize) {
      message.error(`文件大小不能超过 ${maxSize / 1024 / 1024}MB`)
      return result
    }
    if (!file.file) {
      result.existImages.push(file.id)
    } else {
      const base64 = await getBase64(file.file)
      if (base64) {
        result.newImagesBase64.push(base64)
      }
    }
  }
  return result
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

export function GetPlayButton(song: SongsInfo) {
  switch (song.from) {
    case SongFrom.FiveSing: {
      return h(
        'button',
        {
          class: 'inline-flex items-center justify-center h-7 px-2 text-xs font-medium rounded border border-[#00BBB3] text-[#00BBB3] hover:bg-[#00BBB3]/10 transition-colors',
          title: '在5sing打开',
          onClick: () => window.open(`http://5sing.kugou.com/bz/${song.id}.html`),
        },
        [h(FiveSingIcon, { class: 'svg-icon fivesing w-3.5 h-3.5 mr-1' }), '5sing'],
      )
    }
    case SongFrom.Netease:
      return h(
        'button',
        {
          class: 'inline-flex items-center justify-center h-7 px-2 text-xs font-medium rounded border border-[#C20C0C] text-[#C20C0C] hover:bg-[#C20C0C]/10 transition-colors',
          title: '在网易云打开',
          onClick: () => window.open(`https://music.163.com/#/song?id=${song.id}`),
        },
        [h(NeteaseIcon, { class: 'svg-icon netease w-3.5 h-3.5 mr-1' }), '网易云'],
      )
    case SongFrom.Custom:
      return song.url
        ? h(
            'button',
            {
              class: 'inline-flex items-center justify-center h-7 px-2 text-xs font-medium rounded border border-muted-foreground/30 text-foreground hover:bg-muted transition-colors',
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
