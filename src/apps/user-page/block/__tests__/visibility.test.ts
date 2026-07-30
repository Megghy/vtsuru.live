import { describe, expect, it } from 'vitest'

import type { BlockNode, BlockVisibilityContext } from '../schemaTypes'
import { isBlockVisible } from '../visibility'

const context: BlockVisibilityContext = { isLive: true, device: 'mobile', now: 1_800_000_000 }

function block(visibility?: BlockNode['visibility']): BlockNode {
  return { id: 'block', type: 'text', visibility, props: { text: '内容' } }
}

describe('isBlockVisible', () => {
  it('无条件时始终显示', () => expect(isBlockVisible(block(), context)).toBe(true))

  it('同时匹配直播、设备和时间条件', () => {
    expect(
      isBlockVisible(
        block({ liveState: 'live', device: 'mobile', startsAt: 1_700_000_000, endsAt: 1_900_000_000 }),
        context,
      ),
    ).toBe(true)
  })

  it('任一条件不匹配时隐藏', () => {
    expect(isBlockVisible(block({ liveState: 'offline' }), context)).toBe(false)
    expect(isBlockVisible(block({ device: 'desktop' }), context)).toBe(false)
    expect(isBlockVisible(block({ startsAt: 1_900_000_000 }), context)).toBe(false)
    expect(isBlockVisible(block({ endsAt: 1_700_000_000 }), context)).toBe(false)
  })
})
