import { usePersistedStorage } from '@/shared/storage/persist'

import type { PanelId } from '../core/types'
import { PANEL_IDS } from '../core/types'

export type PanelSort = 'time' | 'price'

export type ToolbarStatKey =
  | 'duration'
  | 'danmaku'
  | 'onlineRank'
  | 'totalLikes'
  | 'watched'
  | 'popularity'
  | 'activeUsers'
  | 'totalRevenue'
  | 'sc'
  | 'gift'
  | 'guard'
  | 'perMinute'
  | 'topPayers'

export interface ToolbarStatOption {
  key: ToolbarStatKey
  label: string
  description?: string
}

export const TOOLBAR_STAT_OPTIONS: ToolbarStatOption[] = [
  { key: 'duration', label: '统计时长', description: '自重置以来的统计计时' },
  { key: 'danmaku', label: '弹幕数', description: '本场接收的弹幕总数' },
  { key: 'onlineRank', label: '在线观众', description: '在线高能观众数（未获取时为活跃互动人数）' },
  { key: 'totalLikes', label: '本场点赞', description: '本场累计总点赞数' },
  { key: 'totalRevenue', label: '总收益', description: '礼物、醒目留言与大航海总额' },
  { key: 'topPayers', label: '高额贡献用户', description: '本场打赏前 3 名观众头像及金额' },
  { key: 'watched', label: '累计看过', description: '累计观看人次' },
  { key: 'popularity', label: '人气', description: '直播间热度值' },
  { key: 'activeUsers', label: '近20分钟互动', description: '近 20 分钟内活跃去重用户数' },
  { key: 'sc', label: '醒目留言 (SC)', description: '醒目留言收益总额' },
  { key: 'gift', label: '礼物收益', description: '金瓜子礼物收益总额' },
  { key: 'guard', label: '大航海', description: '本场上舰人数' },
  { key: 'perMinute', label: '每分钟事件', description: '当前事件互动速率' },
]

export const DEFAULT_TOOLBAR_STATS: Record<ToolbarStatKey, boolean> = {
  duration: true,
  danmaku: true,
  onlineRank: true,
  totalLikes: true,
  totalRevenue: true,
  topPayers: true,
  watched: false,
  popularity: false,
  activeUsers: false,
  sc: false,
  gift: false,
  guard: false,
  perMinute: false,
}

export const DEFAULT_TOOLBAR_ORDER: ToolbarStatKey[] = [
  'duration',
  'danmaku',
  'onlineRank',
  'totalLikes',
  'totalRevenue',
  'topPayers',
  'watched',
  'popularity',
  'activeUsers',
  'sc',
  'gift',
  'guard',
  'perMinute',
]

export interface DashboardSettings {
  layout: {
    order: PanelId[]
    hidden: PanelId[]
    /** 与 order 对应的百分比 */
    sizes: Record<PanelId, number>
    /** 竖屏显示器：面板上下排列 */
    vertical: boolean
    /** 专注模式：隐藏的面板原地虚化而不是移除 */
    focusMode: boolean
    /** 弹幕面板中互动区高度百分比 */
    interactionSize: number
    /** 弹幕与互动区上下互换 */
    interactionOnTop: boolean
  }
  hideRead: boolean
  cardMode: boolean
  card: { size: number; autoHide: boolean; autoHideThreshold: number; autoHideSeconds: number }
  sort: Record<'sc' | 'gift', PanelSort>
  /** 礼物面板最低金额（元），0 为不过滤；大航海不受影响 */
  giftMinPrice: number
  showFreeGift: boolean
  showAvatar: boolean
  showMedal: boolean
  fontSize: number
  absoluteTime: boolean
  /** 启动时从本地库载入最近多少小时的事件 */
  historyHours: number
  /** 顶栏显示的统计指标项 */
  toolbarStats: Record<ToolbarStatKey, boolean>
  /** 顶栏统计指标项排序 */
  toolbarOrder: ToolbarStatKey[]
}

export const DEFAULT_LAYOUT: DashboardSettings['layout'] = {
  order: [...PANEL_IDS],
  hidden: ['vote'],
  sizes: { danmaku: 34, sc: 33, gift: 33, vote: 25 },
  vertical: false,
  focusMode: false,
  interactionSize: 22,
  interactionOnTop: false,
}

const DEFAULT_SETTINGS: DashboardSettings = {
  layout: DEFAULT_LAYOUT,
  hideRead: false,
  cardMode: false,
  card: { size: 24, autoHide: false, autoHideThreshold: 10, autoHideSeconds: 60 },
  sort: { sc: 'time', gift: 'time' },
  giftMinPrice: 0,
  showFreeGift: false,
  showAvatar: true,
  showMedal: true,
  fontSize: 15,
  absoluteTime: false,
  historyHours: 12,
  toolbarStats: DEFAULT_TOOLBAR_STATS,
  toolbarOrder: DEFAULT_TOOLBAR_ORDER,
}

/** 旧配置缺少后加入的面板时，追加到末尾并沿用其默认显隐 */
export function mergeLayout(
  stored: Partial<DashboardSettings['layout']> | undefined,
  defaults: DashboardSettings['layout'],
) {
  const layout = { ...defaults, ...stored, sizes: { ...defaults.sizes, ...stored?.sizes } }
  const added = PANEL_IDS.filter((id) => !layout.order.includes(id))
  layout.order = [...layout.order, ...added]
  layout.hidden = [...layout.hidden, ...added.filter((id) => defaults.hidden.includes(id))]
  return layout
}

export function mergeToolbarOrder(stored: ToolbarStatKey[] | undefined, defaults: ToolbarStatKey[]) {
  if (!Array.isArray(stored)) return [...defaults]
  const valid = stored.filter((k) => defaults.includes(k))
  const missing = defaults.filter((k) => !valid.includes(k))
  return [...valid, ...missing]
}

export function useDashboardSettings() {
  return usePersistedStorage<DashboardSettings>('vtsuru:settings:live-dashboard', structuredClone(DEFAULT_SETTINGS), {
    mergeDefaults: (stored, defaults) => ({
      ...defaults,
      ...stored,
      layout: mergeLayout(stored.layout, defaults.layout),
      card: { ...defaults.card, ...stored.card },
      sort: { ...defaults.sort, ...stored.sort },
      toolbarStats: { ...defaults.toolbarStats, ...stored.toolbarStats },
      toolbarOrder: mergeToolbarOrder(stored.toolbarOrder, defaults.toolbarOrder),
    }),
  })
}

export function resetLayout(settings: DashboardSettings) {
  settings.layout = structuredClone(DEFAULT_LAYOUT)
}
