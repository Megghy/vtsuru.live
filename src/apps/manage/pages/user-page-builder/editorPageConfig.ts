import type { BlockPageProject } from '@/apps/user-page/block/schema'
import type { UserPageConfig, UserPagesSettings } from '@/apps/user-page/types'

import { createId } from './editorHelpers'

export function createDefaultProject(): BlockPageProject {
  return {
    version: 1,
    blocks: [
      { id: createId(), type: 'profile' },
      { id: createId(), type: 'buttons', props: { items: [] } },
      { id: createId(), type: 'footer' },
    ],
  }
}

export function isValidPageConfig(config: unknown): boolean {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return false
  const page = config as UserPageConfig
  if (page.mode === 'legacy') return true
  if (page.mode === 'block') return !!page.block
  if (page.mode === 'contrib') return !!page.contrib
  return false
}

export function isEmptyDraftPlaceholder(settings: UserPagesSettings | null): boolean {
  if (!settings || settings.version !== 2 || Object.keys(settings.pages ?? {}).length !== 0) return false
  if (Object.keys(settings).some((key) => !['version', 'home', 'pages'].includes(key))) return false
  if (!settings.home || settings.home.mode !== 'legacy') return false
  const homeKeys = Object.keys(settings.home)
  return homeKeys.length === 1 && homeKeys[0] === 'mode'
}

export function isMeaningfulSettings(settings: UserPagesSettings | null): settings is UserPagesSettings {
  if (!settings || settings.version !== 2) return false
  if (isValidPageConfig(settings.home)) return true
  return Object.values(settings.pages ?? {}).some(isValidPageConfig)
}

export function ensurePageConfig(settings: UserPagesSettings, key: string): UserPageConfig {
  if (key === 'home') {
    settings.home ??= { mode: 'block', block: createDefaultProject() }
    if (!isValidPageConfig(settings.home)) {
      settings.home.mode = 'block'
      settings.home.block ??= createDefaultProject()
    }
    return settings.home
  }

  settings.pages ??= {}
  settings.pages[key] ??= { mode: 'block', block: createDefaultProject() }
  if (!isValidPageConfig(settings.pages[key])) {
    settings.pages[key].mode = 'block'
    settings.pages[key].block ??= createDefaultProject()
  }
  return settings.pages[key]
}

export interface PageModeOption {
  value: UserPageConfig['mode']
  label: string
  shortLabel: string
  tag?: string
  description: string
}

export const PAGE_MODE_OPTIONS: PageModeOption[] = [
  {
    value: 'block',
    label: '可视化自由搭建',
    shortLabel: '模块搭建',
    tag: '推荐',
    description: '使用丰富的预设组件（个人信息、按钮组、歌单、视频等）自由拼装页面，支持拖拽排序与响应式预览。',
  },
  {
    value: 'legacy',
    label: '经典模板',
    shortLabel: '经典模板',
    description: '使用系统内置的经典名片模板，支持基础信息、展示视频、外链列表等固定结构。',
  },
  {
    value: 'contrib',
    label: '扩展组件页',
    shortLabel: '扩展页',
    description: '加载社区开发者贡献的独立定制页面组件（如专属互动页、小游戏等，需配置页面 ID）。',
  },
]

export function getPageModeLabel(mode: UserPageConfig['mode']) {
  if (mode === 'legacy') return '经典模板'
  if (mode === 'block') return '可视化搭建'
  if (mode === 'contrib') return '扩展组件页'
  return '未知模式'
}

export function getPageModeShortLabel(mode: UserPageConfig['mode']) {
  if (mode === 'legacy') return '经典模板'
  if (mode === 'block') return '模块搭建'
  if (mode === 'contrib') return '扩展页'
  return '未知'
}
