import { createDiscreteApi, useOsTheme } from 'naive-ui'
import { ThemeType } from './api/api-models'
import { useStorage } from '@vueuse/core'

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
