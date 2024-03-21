import { useStorage } from '@vueuse/core'
import { UploadFileInfo, createDiscreteApi, useOsTheme } from 'naive-ui'
import { ThemeType } from './api/api-models'
import { computed } from 'vue'
import { VTSURU_API_URL } from './data/constants'

const { message } = createDiscreteApi(['message'])

const osThemeRef = useOsTheme() //获取当前系统主题
export function NavigateToNewTab(url: string) {
  window.open(url, '_blank')
}
const themeType = useStorage('Settings.Theme', ThemeType.Auto)
export const isDarkMode = computed(() => {
  if (themeType.value == ThemeType.Auto) return osThemeRef.value === 'dark'
  else return themeType.value == ThemeType.Dark
})
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
    ctx!.drawImage(image, 0, 0)
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
export function getBase64(file: File | undefined | null): Promise<string | undefined> {
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
      message.error('文件大小不能超过 ' + maxSize / 1024 / 1024 + 'MB')
      return result
    }
    if (!file.file) {
      result.existImages.push(file.id) //用id绝对路径当的文件名
    } else {
      const base64 = await getBase64(file.file)
      if (base64) {
        result.newImagesBase64.push(base64)
      }
    }
  }
  return result
}
export function getUserAvatarUrl(userId: number) {
  return VTSURU_API_URL + 'user-face/' + userId
}
export function getOUIdAvatarUrl(ouid: string) {
  return VTSURU_API_URL + 'face/' + ouid
}

export class GuidUtils {
  // 将数字转换为GUID
  public static numToGuid(value: number): string {
    const buffer = new ArrayBuffer(16)
    const view = new DataView(buffer)
    view.setBigUint64(8, BigInt(value)) // 将数字写入后8个字节
    return GuidUtils.bufferToGuid(buffer)
  }

  // 检查GUID是否由数字生成
  public static isGuidFromUserId(guid: string): boolean {
    const buffer = GuidUtils.guidToBuffer(guid)
    const view = new DataView(buffer)
    for (let i = 0; i < 8; i++) {
      if (view.getUint8(i) !== 0) return false // 检查前8个字节是否为0
    }
    return true
  }

  // 将GUID转换为数字
  public static guidToLong(guid: string): number {
    const buffer = GuidUtils.guidToBuffer(guid)
    const view = new DataView(buffer)
    return Number(view.getBigUint64(8))
  }

  // 辅助方法：将ArrayBuffer转换为GUID字符串
  private static bufferToGuid(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    const guid = bytes.reduce((str, byte, idx) => {
      const pair = byte.toString(16).padStart(2, '0')
      return str + pair + (idx === 3 || idx === 5 || idx === 7 || idx === 9 ? '-' : '')
    }, '')
    return guid
  }

  // 辅助方法：将GUID字符串转换为ArrayBuffer
  private static guidToBuffer(guid: string): ArrayBuffer {
    const hex = guid.replace(/-/g, '')
    if (hex.length !== 32) throw new Error('Invalid GUID format.')
    const buffer = new ArrayBuffer(16)
    const view = new DataView(buffer)
    for (let i = 0; i < 16; i++) {
      view.setUint8(i, parseInt(hex.substr(i * 2, 2), 16))
    }
    return buffer
  }
}
