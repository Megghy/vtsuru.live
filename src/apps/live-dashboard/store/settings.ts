import { usePersistedStorage } from '@/shared/storage/persist'

import type { PanelId } from '../core/types'
import { PANEL_IDS } from '../core/types'

export type PanelSort = 'time' | 'price'
export type PaidReadFilter = 'all' | 'unread' | 'read'

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
  | 'mysteryBox'

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
  { key: 'mysteryBox', label: '盲盒盈亏', description: '盲盒开出总价值与投入成本差值' },
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
  mysteryBox: false,
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
  'mysteryBox',
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
  /** 列表模式下合并连续重复弹幕 */
  collapseRepeated: boolean
  /** 弹幕面板顶部显示实时热度折线与热词条 */
  showDanmakuPulse: boolean
  /** 客户端演播快捷板折叠条是否展开 */
  streamDeckOpen: boolean
  /** 客户端顶栏隐藏底部状态栏已显示的重复指标（在线/点赞/看过/总收益） */
  hideRedundantClientStats: boolean
  /** 客户端进入中控台时自动收起左侧导航栏 */
  autoCollapseClientSidebar: boolean
  card: { size: number; autoHide: boolean; autoHideThreshold: number; autoHideSeconds: number }
  sort: Record<'sc' | 'gift', PanelSort>
  paidReadFilter: Record<'sc' | 'gift', PaidReadFilter>
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
  /** 直播高光打点设置 */
  highlight: {
    danmakuMarkPrefix: string
    danmakuMarkRole: 'owner' | 'guard' | 'all'
    autoSaveReplayOnMark: boolean
  }
}

export interface LayoutPreset {
  id: string
  label: string
  description: string
  panels: PanelId[]
  sizes?: Partial<Record<PanelId, number>>
}

export const LAYOUT_PRESETS: LayoutPreset[] = [
  {
    id: 'default',
    label: '默认三栏',
    description: '弹幕 + 醒目留言 + 礼物',
    panels: ['danmaku', 'sc', 'gift'],
    sizes: { danmaku: 34, sc: 33, gift: 33 },
  },
  {
    id: 'chat',
    label: '杂谈读棉',
    description: '弹幕 + 醒目留言 + 提问箱 + 直播提纲',
    panels: ['danmaku', 'sc', 'question_box', 'checklist'],
    sizes: { danmaku: 30, sc: 22, question_box: 28, checklist: 20 },
  },
  {
    id: 'sing',
    label: '歌回点歌',
    description: '弹幕 + 醒目留言 + 礼物 + 点歌',
    panels: ['danmaku', 'sc', 'gift', 'song_request'],
    sizes: { danmaku: 30, sc: 22, gift: 22, song_request: 26 },
  },
  {
    id: 'interact',
    label: '抽奖核销',
    description: '弹幕 + 醒目留言 + 抽奖控台 + 积分核销',
    panels: ['danmaku', 'sc', 'lottery', 'point_redeem'],
    sizes: { danmaku: 28, sc: 20, lottery: 28, point_redeem: 24 },
  },
  {
    id: 'watch',
    label: '看片鉴赏',
    description: '弹幕 + 视频征集 + 待处理',
    panels: ['danmaku', 'video_collect', 'todo'],
    sizes: { danmaku: 36, video_collect: 38, todo: 26 },
  },
  {
    id: 'game',
    label: '游戏减噪',
    description: '弹幕 + 待处理 + 礼物',
    panels: ['danmaku', 'todo', 'gift'],
    sizes: { danmaku: 38, todo: 32, gift: 30 },
  },
]

export const DEFAULT_LAYOUT: DashboardSettings['layout'] = {
  order: [...PANEL_IDS],
  hidden: [
    'vote',
    'song_request',
    'queue',
    'todo',
    'question_box',
    'point_redeem',
    'video_collect',
    'lottery',
    'checklist',
    'transcript',
  ],
  sizes: {
    danmaku: 34,
    sc: 33,
    gift: 33,
    vote: 25,
    song_request: 25,
    queue: 25,
    todo: 26,
    question_box: 26,
    point_redeem: 25,
    video_collect: 28,
    lottery: 28,
    checklist: 22,
    transcript: 24,
  },
  vertical: false,
  focusMode: false,
  interactionSize: 22,
  interactionOnTop: false,
}

const DEFAULT_SETTINGS: DashboardSettings = {
  layout: DEFAULT_LAYOUT,
  hideRead: false,
  cardMode: false,
  collapseRepeated: false,
  showDanmakuPulse: true,
  streamDeckOpen: false,
  hideRedundantClientStats: true,
  autoCollapseClientSidebar: true,
  card: { size: 24, autoHide: false, autoHideThreshold: 10, autoHideSeconds: 60 },
  sort: { sc: 'time', gift: 'time' },
  paidReadFilter: { sc: 'all', gift: 'all' },
  giftMinPrice: 0,
  showFreeGift: false,
  showAvatar: true,
  showMedal: true,
  fontSize: 15,
  absoluteTime: false,
  historyHours: 12,
  toolbarStats: DEFAULT_TOOLBAR_STATS,
  toolbarOrder: DEFAULT_TOOLBAR_ORDER,
  highlight: {
    danmakuMarkPrefix: '!mark',
    danmakuMarkRole: 'guard',
    autoSaveReplayOnMark: false,
  },
}

/** 旧配置缺少后加入的面板时，追加到末尾并沿用其默认显隐 */
export function mergeLayout(
  stored: Partial<DashboardSettings['layout']> | undefined,
  defaults: DashboardSettings['layout'],
) {
  const layout = { ...defaults, ...stored, sizes: { ...defaults.sizes, ...stored?.sizes } }
  const validOrder = layout.order.filter((id) => PANEL_IDS.includes(id))
  const validHidden = layout.hidden.filter((id) => PANEL_IDS.includes(id))
  const added = PANEL_IDS.filter((id) => !validOrder.includes(id))
  layout.order = [...validOrder, ...added]
  layout.hidden = [...validHidden, ...added.filter((id) => defaults.hidden.includes(id))]
  return layout
}

export function applyLayoutPreset(settings: DashboardSettings, presetId: string) {
  const preset = LAYOUT_PRESETS.find((p) => p.id === presetId)
  if (!preset) return
  const activeSet = new Set(preset.panels)
  const rest = PANEL_IDS.filter((id) => !activeSet.has(id))
  settings.layout.order = [...preset.panels, ...rest]
  settings.layout.hidden = [...rest]
  if (preset.sizes) {
    settings.layout.sizes = { ...settings.layout.sizes, ...preset.sizes }
  }
}

export function mergeToolbarOrder(stored: ToolbarStatKey[] | undefined, defaults: ToolbarStatKey[]) {
  if (!Array.isArray(stored)) return [...defaults]
  const valid = stored.filter((k) => defaults.includes(k))
  const missing = defaults.filter((k) => !valid.includes(k))
  return [...valid, ...missing]
}

export function filterByPaidReadMode<T extends { key: string }>(
  list: T[],
  readKeys: ReadonlySet<string>,
  mode: PaidReadFilter,
  globalHideRead: boolean,
): T[] {
  if (mode === 'unread') return list.filter((e) => !readKeys.has(e.key))
  if (mode === 'read') return list.filter((e) => readKeys.has(e.key))
  return globalHideRead ? list.filter((e) => !readKeys.has(e.key)) : list
}

export function useDashboardSettings() {
  return usePersistedStorage<DashboardSettings>('vtsuru:settings:live-dashboard', structuredClone(DEFAULT_SETTINGS), {
    mergeDefaults: (stored, defaults) => ({
      ...defaults,
      ...stored,
      layout: mergeLayout(stored.layout, defaults.layout),
      card: { ...defaults.card, ...stored.card },
      sort: { ...defaults.sort, ...stored.sort },
      paidReadFilter: { ...defaults.paidReadFilter, ...stored.paidReadFilter },
      toolbarStats: { ...defaults.toolbarStats, ...stored.toolbarStats },
      toolbarOrder: mergeToolbarOrder(stored.toolbarOrder, defaults.toolbarOrder),
      highlight: { ...defaults.highlight, ...stored.highlight },
    }),
  })
}

export function resetLayout(settings: DashboardSettings) {
  settings.layout = structuredClone(DEFAULT_LAYOUT)
}
