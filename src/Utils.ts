import { useOsTheme } from "naive-ui"
import { ThemeType } from "./api/api-models"
import { useStorage } from "@vueuse/core"

const osThemeRef = useOsTheme() //获取当前系统主题
export function NavigateToNewTab(url: string) {
  window.open(url, '_blank')
}
const themeType = useStorage('Settings.Theme', ThemeType.Auto)
export function isDarkMode(): boolean {

  if (themeType.value == ThemeType.Auto) return osThemeRef.value === 'dark'
  else return themeType.value == ThemeType.Dark
}
