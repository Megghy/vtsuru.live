import type {
  ConfigProviderProps,
  UploadFileInfo,
} from 'naive-ui'
import type { DiscreteApiType } from 'naive-ui/es/discrete/src/interface'
import type { SongsInfo } from '@/api/api-models'
import { SquareArrowForward24Filled } from '@vicons/fluent'
import { useStorage } from '@vueuse/core'
import {
  createDiscreteApi,
  darkTheme,
  dateZhCN,
  NButton,
  NIcon,
  NTooltip,
  useOsTheme,
  zhCN,
} from 'naive-ui'
import { computed } from 'vue'
import FiveSingIcon from '@/svgs/fivesing.svg'
import NeteaseIcon from '@/svgs/netease.svg'
import { SongFrom, ThemeType } from '@/api/api-models'
import { getThemeOverrides, VTSURU_API_URL } from '@/shared/config'

const osThemeRef = useOsTheme() // 获取当前系统主题
const themeType = useStorage('Settings.Theme', ThemeType.Auto)
export const theme = computed(() => {
  if (themeType.value == ThemeType.Auto) {
    const osThemeRef = useOsTheme() // 获取当前系统主题
    return osThemeRef.value === 'dark' ? darkTheme : null
  } else {
    return themeType.value == ThemeType.Dark ? darkTheme : null
  }
})

export const isDarkMode = computed(() => {
  if (themeType.value == ThemeType.Auto) return osThemeRef.value === 'dark'
  else return themeType.value == ThemeType.Dark
})

export const configProviderPropsRef = computed<ConfigProviderProps>(() => ({
  theme: theme.value,
  themeOverrides: getThemeOverrides(isDarkMode.value),
  locale: zhCN,
  dateLocale: dateZhCN,
}))

const { message } = createDiscreteApi(['message'], {
  configProviderProps: configProviderPropsRef,
})

export function createNaiveUIApi(types: DiscreteApiType[]) {
  return createDiscreteApi(types, {
    configProviderProps: configProviderPropsRef,
  })
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
export function downloadImage(imageSrc: string, filename: string) {
  const image = new Image()
  image.crossOrigin = 'Anonymous' // This might be needed depending on the image's server
  image.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const ctx = canvas.getContext('2d')
    ctx.drawImage(image, 0, 0)
    canvas.toBlob((blob) => {
      if (blob) {
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
    }) // Omitted the 'image/jpeg' to use the original image format
  }
  image.src = imageSrc
}
export async function getBase64(
  file: File | undefined | null,
): Promise<string | undefined> {
  if (!file) return new Promise(resolve => resolve(undefined))
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () =>
      resolve(reader.result?.toString().split(',')[1] || undefined)
    reader.onerror = error => reject(error)
  })
}
export async function getImageUploadModel(
  files: UploadFileInfo[] | undefined | null,
  maxSize: number = 10 * 1024 * 1024,
) {
  const result = {
    existImages: [],
    newImagesBase64: [],
  } as { existImages: string[], newImagesBase64: string[] }
  if (!files) return result
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    if ((file.file?.size ?? 0) > maxSize) {
      message.error(`文件大小不能超过 ${maxSize / 1024 / 1024}MB`)
      return result
    }
    if (!file.file) {
      result.existImages.push(file.id) // 用id绝对路径当的文件名
    } else {
      const base64 = await getBase64(file.file)
      if (base64) {
        result.newImagesBase64.push(base64)
      }
    }
  }
  return result
}
export function getUserAvatarUrl(userId: number | undefined | null) {
  if (!userId) return ''
  return `${VTSURU_API_URL}user-face/${userId}`
}
export function getOUIdAvatarUrl(ouid: string) {
  return `${VTSURU_API_URL}face/${ouid}`
}

export class GuidUtils {
  // 将数字转换为GUID
  public static numToGuid(value: number): string {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error('输入必须是非负安全整数')
    }
    const buffer = new ArrayBuffer(16)
    const view = new DataView(buffer)
    view.setBigUint64(8, BigInt(value)) // 将数字写入后8个字节
    return GuidUtils.bufferToGuid(buffer)
  }

  // 检查GUID是否由数字生成
  public static isGuidFromUserId(guid: string): boolean {
    try {
      const buffer = GuidUtils.guidToBuffer(guid)
      const view = new DataView(buffer)
      for (let i = 0; i < 8; i++) {
        if (view.getUint8(i) !== 0) return false // 检查前8个字节是否为0
      }
      return true
    } catch {
      return false
    }
  }

  // 将GUID转换为数字
  public static guidToLong(guid: string): number {
    try {
      const buffer = GuidUtils.guidToBuffer(guid)
      const view = new DataView(buffer)
      return Number(view.getBigUint64(8))
    } catch {
      throw new Error('无效的GUID格式')
    }
  }

  // 辅助方法：将ArrayBuffer转换为GUID字符串
  private static bufferToGuid(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let hex = ''

    for (let i = 0; i < 16; i++) {
      hex += bytes[i].toString(16).padStart(2, '0')
    }

    // 标准GUID格式：xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    return `${hex.substring(0, 8)}-${
      hex.substring(8, 12)}-${
      hex.substring(12, 16)}-${
      hex.substring(16, 20)}-${
      hex.substring(20)}`
  }

  // 辅助方法：将GUID字符串转换为ArrayBuffer
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
      return h(NTooltip, null, {
        trigger: () =>
          h(
            h(
              NButton,
              {
                size: 'small',
                color: '#00BBB3',
                ghost: true,
                onClick: () => {
                  window.open(`http://5sing.kugou.com/bz/${song.id}.html`)
                },
              },
              {
                icon: () => h(FiveSingIcon, { class: 'svg-icon fivesing' }),
              },
            ),
          ),
        default: () => '在5sing打开',
      })
    }
    case SongFrom.Netease:
      return h(NTooltip, null, {
        trigger: () =>
          h(
            NButton,
            {
              size: 'small',
              color: '#C20C0C',
              ghost: true,
              onClick: () => {
                window.open(`https://music.163.com/#/song?id=${song.id}`)
              },
            },
            {
              icon: () => h(NeteaseIcon, { class: 'svg-icon netease' }),
            },
          ),
        default: () => '在网易云打开',
      })
    case SongFrom.Custom:
      return song.url
        ? h(NTooltip, null, {
            trigger: () =>
              h(
                NButton,
                {
                  size: 'small',
                  color: '#6b95bd',
                  ghost: true,
                  onClick: () => {
                    window.open(song.url)
                  },
                },
                {
                  icon: () => h(NIcon, { component: SquareArrowForward24Filled }),
                },
              ),
            default: () => '打开链接',
          })
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
  } else if (!!window.ActiveXObject || 'ActiveXObject' in window) {
    return 'IE>=11'
  } else {
    return 'Unkonwn'
  }
}
