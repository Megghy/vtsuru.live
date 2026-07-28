import { describe, expect, it } from 'vitest'
import { isBlockPropertyAvailable } from '../propertyCapabilities'

describe('isBlockPropertyAvailable', () => {
  it('紧凑直播卡片支持显示封面', () => {
    expect(isBlockPropertyAvailable('liveStatus', { variant: 'compact' }, 'showCover')).toBe(true)
  })

  it('按布局和开关限制无效属性', () => {
    expect(isBlockPropertyAvailable('videoList', { layout: 'row' }, 'columns')).toBe(false)
    expect(isBlockPropertyAvailable('videoList', { source: 'manual', layout: 'grid' }, 'layout')).toBe(false)
    expect(isBlockPropertyAvailable('imageGallery', { layout: 'grid' }, 'autoplay')).toBe(false)
    expect(isBlockPropertyAvailable('feedback', { embed: true, embedMode: 'questionBox' }, 'title')).toBe(false)
    expect(isBlockPropertyAvailable('buttons', { direction: 'horizontal', fullWidth: true }, 'fullWidth')).toBe(false)
    expect(isBlockPropertyAvailable('divider', {}, 'framed')).toBe(false)
  })

  it('依赖满足时开放属性', () => {
    expect(isBlockPropertyAvailable('videoList', { source: 'userIndex', layout: 'grid' }, 'columns')).toBe(true)
    expect(isBlockPropertyAvailable('feedback', { embed: true, embedMode: 'iframe' }, 'height')).toBe(true)
    expect(isBlockPropertyAvailable('buttons', { framed: true, borderTitle: '导航' }, 'borderTitleAlign')).toBe(true)
  })
})
