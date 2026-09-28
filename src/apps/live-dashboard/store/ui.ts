import { defineStore } from 'pinia'
import { reactive, ref, shallowRef } from 'vue'

import { ThemeType } from '@/api/api-models'
import { usePersistedStorage } from '@/shared/storage/persist'
import { isDarkMode } from '@/shared/utils'

import type { DashboardEvent } from '../core/types'

export interface PointedEvent {
  event: DashboardEvent
  x: number
  y: number
}

/** 中控台界面态：全局唯一的用户菜单、右键菜单、导出图片弹窗与各类面板开关 */
export const useDashboardUi = defineStore('LiveDashboardUi', () => {
  const userMenu = shallowRef<PointedEvent | null>(null)
  const contextMenu = shallowRef<PointedEvent | null>(null)
  const imageTarget = shallowRef<DashboardEvent | null>(null)
  /** 事件 key -> 译文，仅本次会话 */
  const translations = reactive(new Map<string, string>())
  const settingsOpen = ref(false)
  const shortcutsOpen = ref(false)
  const searchFocusTick = ref(0)
  const themeType = usePersistedStorage('Settings.Theme', ThemeType.Auto)

  function openUserMenu(event: DashboardEvent, e: MouseEvent) {
    contextMenu.value = null
    userMenu.value = { event, x: e.clientX, y: e.clientY }
  }

  /** 有选中文字时保留浏览器原生菜单，便于复制片段 */
  function openContextMenu(event: DashboardEvent, e: MouseEvent) {
    if (window.getSelection()?.toString()) return
    e.preventDefault()
    userMenu.value = null
    contextMenu.value = { event, x: e.clientX, y: e.clientY }
  }

  function toggleTheme() {
    themeType.value = isDarkMode.value ? ThemeType.Light : ThemeType.Dark
  }

  return {
    userMenu,
    contextMenu,
    imageTarget,
    translations,
    settingsOpen,
    shortcutsOpen,
    searchFocusTick,
    openUserMenu,
    openContextMenu,
    toggleTheme,
  }
})
