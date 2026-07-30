import { describe, expect, it } from 'vitest'

import { mergeBuilderResources } from '../useBuilderResources'

describe('mergeBuilderResources', () => {
  it('合并服务器资源、引用数和未使用状态', () => {
    const resources = mergeBuilderResources(
      [
        { id: 1, path: '/one.png', name: 'one.png', hash: 'one', size: 128 },
        { id: 2, path: '/two.png', name: 'two.png', hash: 'two', size: 256 },
      ],
      [{ id: 1, path: '/one.png', name: 'one.png', locations: ['settings.home.block.blocks[0].props.imageFile'] }],
    )

    expect(resources).toEqual([
      expect.objectContaining({ id: 2, locations: [], missing: false }),
      expect.objectContaining({ id: 1, locations: ['settings.home.block.blocks[0].props.imageFile'], missing: false }),
    ])
  })

  it('保留已被配置引用但服务器不存在的资源', () => {
    const resources = mergeBuilderResources(
      [],
      [
        {
          id: 9,
          path: '/deleted.png',
          name: 'deleted.png',
          locations: ['settings.background.pageBackgroundImageFile'],
        },
      ],
    )

    expect(resources).toEqual([
      expect.objectContaining({ id: 9, missing: true, locations: ['settings.background.pageBackgroundImageFile'] }),
    ])
  })
})
