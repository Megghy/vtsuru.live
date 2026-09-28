import { usePersistedStorage } from '@/shared/storage/persist'

import type { PanelId } from '../core/types'
import { PANEL_IDS } from '../core/types'

export type PanelSort = 'time' | 'price'

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
}

/** 旧配置缺少后加入的面板时，追加到末尾并沿用其默认显隐 */
export function mergeLayout(stored: Partial<DashboardSettings['layout']> | undefined, defaults: DashboardSettings['layout']) {
  const layout = { ...defaults, ...stored, sizes: { ...defaults.sizes, ...stored?.sizes } }
  const added = PANEL_IDS.filter((id) => !layout.order.includes(id))
  layout.order = [...layout.order, ...added]
  layout.hidden = [...layout.hidden, ...added.filter((id) => defaults.hidden.includes(id))]
  return layout
}

export function useDashboardSettings() {
  return usePersistedStorage<DashboardSettings>('vtsuru:settings:live-dashboard', structuredClone(DEFAULT_SETTINGS), {
    mergeDefaults: (stored, defaults) => ({
      ...defaults,
      ...stored,
      layout: mergeLayout(stored.layout, defaults.layout),
      card: { ...defaults.card, ...stored.card },
      sort: { ...defaults.sort, ...stored.sort },
    }),
  })
}

export function resetLayout(settings: DashboardSettings) {
  settings.layout = structuredClone(DEFAULT_LAYOUT)
}
