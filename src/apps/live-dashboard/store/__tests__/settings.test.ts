import { describe, expect, it } from 'vitest'

import { PANEL_IDS, type PanelId } from '../../core/types'
import {
  applyLayoutPreset,
  DEFAULT_LAYOUT,
  DEFAULT_TOOLBAR_STATS,
  filterByPaidReadMode,
  LAYOUT_PRESETS,
  mergeLayout,
  TOOLBAR_STAT_OPTIONS,
} from '../settings'

describe('mergeLayout', () => {
  it('旧配置追加新面板并沿用默认隐藏，保留用户顺序与尺寸', () => {
    const layout = mergeLayout(
      { order: ['gift', 'danmaku', 'sc'], hidden: ['sc'], sizes: { danmaku: 50, sc: 20, gift: 30 } as never },
      DEFAULT_LAYOUT,
    )
    expect(layout.order.slice(0, 3)).toEqual(['gift', 'danmaku', 'sc'])
    expect(layout.order).toEqual(['gift', 'danmaku', 'sc', ...PANEL_IDS.slice(3)])
    expect(layout.hidden).toEqual(['sc', ...PANEL_IDS.slice(3)])
    expect(layout.sizes).toMatchObject({ danmaku: 50, gift: 30, vote: DEFAULT_LAYOUT.sizes.vote })
  })

  it('已包含全部面板时不改动显隐', () => {
    const customOrder: PanelId[] = ['vote', ...PANEL_IDS.filter((id) => id !== 'vote')]
    const layout = mergeLayout({ order: customOrder, hidden: [] }, DEFAULT_LAYOUT)
    expect(layout.order[0]).toBe('vote')
    expect(layout.hidden).toEqual([])
  })

  it('applyLayoutPreset 切换到指定场景预设并仅展示该场景面板', () => {
    const settings = { layout: structuredClone(DEFAULT_LAYOUT) } as Parameters<typeof applyLayoutPreset>[0]
    applyLayoutPreset(settings, 'chat')
    const chatPreset = LAYOUT_PRESETS.find((p) => p.id === 'chat')!
    const visible = settings.layout.order.filter((id) => !settings.layout.hidden.includes(id))
    expect(visible).toEqual(chatPreset.panels)
  })

  it('DEFAULT_TOOLBAR_STATS 默认仅开启精简的核心指标，其余项可选', () => {
    expect(DEFAULT_TOOLBAR_STATS.duration).toBe(true)
    expect(DEFAULT_TOOLBAR_STATS.danmaku).toBe(true)
    expect(DEFAULT_TOOLBAR_STATS.onlineRank).toBe(true)
    expect(DEFAULT_TOOLBAR_STATS.totalLikes).toBe(true)
    expect(DEFAULT_TOOLBAR_STATS.totalRevenue).toBe(true)
    expect(DEFAULT_TOOLBAR_STATS.topPayers).toBe(true)

    expect(DEFAULT_TOOLBAR_STATS.watched).toBe(false)
    expect(DEFAULT_TOOLBAR_STATS.popularity).toBe(false)
    expect(DEFAULT_TOOLBAR_STATS.activeUsers).toBe(false)
    expect(DEFAULT_TOOLBAR_STATS.sc).toBe(false)
    expect(DEFAULT_TOOLBAR_STATS.gift).toBe(false)
    expect(DEFAULT_TOOLBAR_STATS.guard).toBe(false)
    expect(DEFAULT_TOOLBAR_STATS.perMinute).toBe(false)
    expect(DEFAULT_TOOLBAR_STATS.mysteryBox).toBe(false)

    expect(TOOLBAR_STAT_OPTIONS.length).toBe(14)
  })
})

describe('filterByPaidReadMode', () => {
  const items = [{ key: 'a' }, { key: 'b' }, { key: 'c' }]
  const readKeys = new Set(['b'])

  it('all 模式遵循全局 hideRead 设置', () => {
    expect(filterByPaidReadMode(items, readKeys, 'all', false).map((i) => i.key)).toEqual(['a', 'b', 'c'])
    expect(filterByPaidReadMode(items, readKeys, 'all', true).map((i) => i.key)).toEqual(['a', 'c'])
  })

  it('unread 与 read 模式不受全局 hideRead 干扰', () => {
    expect(filterByPaidReadMode(items, readKeys, 'unread', false).map((i) => i.key)).toEqual(['a', 'c'])
    expect(filterByPaidReadMode(items, readKeys, 'read', true).map((i) => i.key)).toEqual(['b'])
  })
})
