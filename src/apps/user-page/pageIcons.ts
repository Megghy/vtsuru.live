import BrowsersOutline from '@vicons/ionicons5/es/BrowsersOutline'
import type { Component } from 'vue'
import { defineAsyncComponent } from 'vue'

export type UserPageNavIconId = string

export const DEFAULT_USER_PAGE_NAV_ICON = 'BrowsersOutline'

const iconAliases: Readonly<Record<string, string>> = {
  BookOutline: '文章',
  BrowsersOutline: '页面',
  CafeOutline: '茶会',
  CalendarOutline: '日程',
  CallOutline: '联系',
  CameraOutline: '相册',
  CartOutline: '商店',
  ChatbubblesOutline: '交流',
  CodeSlashOutline: '开发',
  ConstructOutline: '施工中',
  DocumentTextOutline: '文档',
  FolderOpenOutline: '资源',
  GameControllerOutline: '游戏',
  GiftOutline: '支持',
  GlobeOutline: '网站',
  HeartOutline: '喜欢',
  HomeOutline: '主页',
  ImageOutline: '图片',
  InformationCircleOutline: '介绍',
  LinkOutline: '链接',
  MailOutline: '邮箱',
  MapOutline: '地图',
  MicOutline: '直播',
  MusicalNotesOutline: '音乐',
  PeopleOutline: '社群',
  PersonOutline: '关于我',
  PlayCircleOutline: '播放',
  RocketOutline: '计划',
  SparklesOutline: '精选',
  StarOutline: '推荐',
  TrophyOutline: '成就',
  VideocamOutline: '视频',
}

export const COMMON_USER_PAGE_NAV_ICON_NAMES = Object.freeze(Object.keys(iconAliases))

const componentCache = new Map<string, Component>([[DEFAULT_USER_PAGE_NAV_ICON, BrowsersOutline]])

export function isUserPageNavIcon(value: unknown): value is UserPageNavIconId {
  return typeof value === 'string' && /^[A-Z][A-Za-z0-9]{1,63}$/.test(value)
}

function humanizeIconName(name: string) {
  return name
    .replace(/(Outline|Sharp)$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
}

export function getUserPageNavIconLabel(value: unknown) {
  if (!isUserPageNavIcon(value)) return '默认图标'
  return iconAliases[value] ?? humanizeIconName(value)
}

export function getUserPageNavIconSearchText(name: string) {
  return `${name} ${humanizeIconName(name)} ${iconAliases[name] ?? ''}`.toLocaleLowerCase()
}

export function resolveUserPageNavIcon(value: unknown): Component {
  if (!isUserPageNavIcon(value)) return BrowsersOutline
  const cached = componentCache.get(value)
  if (cached) return cached

  const component = defineAsyncComponent({
    loader: async () => {
      const { loadUserPageNavIconComponent } = await import('./pageIconLoaders')
      return (await loadUserPageNavIconComponent(value)) ?? BrowsersOutline
    },
    loadingComponent: BrowsersOutline,
    delay: 0,
    suspensible: false,
  })
  componentCache.set(value, component)
  return component
}
