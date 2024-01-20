import { useStorage } from '@vueuse/core'
import { createDiscreteApi, useOsTheme } from 'naive-ui'
import { ThemeType } from './api/api-models'

const { message } = createDiscreteApi(['message'])

const osThemeRef = useOsTheme() //获取当前系统主题
export function NavigateToNewTab(url: string) {
  window.open(url, '_blank')
}
const themeType = useStorage('Settings.Theme', ThemeType.Auto)
export function isDarkMode(): boolean {
  if (themeType.value == ThemeType.Auto) return osThemeRef.value === 'dark'
  else return themeType.value == ThemeType.Dark
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
