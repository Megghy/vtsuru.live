import { describe, expect, it } from 'vitest'

import { DEFAULT_LAYOUT, mergeLayout } from '../settings'

describe('mergeLayout', () => {
  it('旧配置追加新面板并沿用默认隐藏，保留用户顺序与尺寸', () => {
    const layout = mergeLayout({ order: ['gift', 'danmaku', 'sc'], hidden: ['sc'], sizes: { danmaku: 50, sc: 20, gift: 30 } as never }, DEFAULT_LAYOUT)
    expect(layout.order).toEqual(['gift', 'danmaku', 'sc', 'vote'])
    expect(layout.hidden).toEqual(['sc', 'vote'])
    expect(layout.sizes).toMatchObject({ danmaku: 50, gift: 30, vote: DEFAULT_LAYOUT.sizes.vote })
  })

  it('已包含全部面板时不改动显隐', () => {
    const layout = mergeLayout({ order: ['vote', 'danmaku', 'sc', 'gift'], hidden: [] }, DEFAULT_LAYOUT)
    expect(layout.order[0]).toBe('vote')
    expect(layout.hidden).toEqual([])
  })
})
