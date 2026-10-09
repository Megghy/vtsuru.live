import { describe, expect, it } from 'vitest'

import { DEFAULT_LAYOUT, DEFAULT_TOOLBAR_STATS, mergeLayout, TOOLBAR_STAT_OPTIONS } from '../settings'

describe('mergeLayout', () => {
  it('旧配置追加新面板并沿用默认隐藏，保留用户顺序与尺寸', () => {
    const layout = mergeLayout(
      { order: ['gift', 'danmaku', 'sc'], hidden: ['sc'], sizes: { danmaku: 50, sc: 20, gift: 30 } as never },
      DEFAULT_LAYOUT,
    )
    expect(layout.order).toEqual(['gift', 'danmaku', 'sc', 'vote'])
    expect(layout.hidden).toEqual(['sc', 'vote'])
    expect(layout.sizes).toMatchObject({ danmaku: 50, gift: 30, vote: DEFAULT_LAYOUT.sizes.vote })
  })

  it('已包含全部面板时不改动显隐', () => {
    const layout = mergeLayout({ order: ['vote', 'danmaku', 'sc', 'gift'], hidden: [] }, DEFAULT_LAYOUT)
    expect(layout.order[0]).toBe('vote')
    expect(layout.hidden).toEqual([])
  })

  it('DEFAULT_TOOLBAR_STATS 默认仅开启精简的核心指标，其余项可选', () => {
    expect(DEFAULT_TOOLBAR_STATS.duration).toBe(true)
    expect(DEFAULT_TOOLBAR_STATS.danmaku).toBe(true)
    expect(DEFAULT_TOOLBAR_STATS.onlineRank).toBe(true)
    expect(DEFAULT_TOOLBAR_STATS.totalLikes).toBe(true)
    expect(DEFAULT_TOOLBAR_STATS.totalRevenue).toBe(true)
    expect(DEFAULT_TOOLBAR_STATS.topPayers).toBe(true)

    // 次要指标默认关闭，避免顶栏拥挤
    expect(DEFAULT_TOOLBAR_STATS.watched).toBe(false)
    expect(DEFAULT_TOOLBAR_STATS.popularity).toBe(false)
    expect(DEFAULT_TOOLBAR_STATS.activeUsers).toBe(false)
    expect(DEFAULT_TOOLBAR_STATS.sc).toBe(false)
    expect(DEFAULT_TOOLBAR_STATS.gift).toBe(false)
    expect(DEFAULT_TOOLBAR_STATS.guard).toBe(false)
    expect(DEFAULT_TOOLBAR_STATS.perMinute).toBe(false)

    // 所有选项均在 options 清单中注册
    expect(TOOLBAR_STAT_OPTIONS.length).toBe(13)
  })
})
