import { describe, expect, it } from 'vitest'

import { createCoverFileInfo } from '../goodsCoverHelper'

describe('createCoverFileInfo', () => {
  it('returns empty array when cover or cover.path is missing', () => {
    expect(createCoverFileInfo(undefined)).toEqual([])
    expect(createCoverFileInfo({ id: 1, path: null })).toEqual([])
    expect(createCoverFileInfo({ id: 1, path: '' })).toEqual([])
  })

  it('formats cover with image type, finished status and thumbnail url', () => {
    const result = createCoverFileInfo({
      id: 123,
      name: '封面',
      path: 'https://vtsuru.live/vtsuru/objects/0196238b93927493a3848b61c8340d02?fid=123',
    })

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      id: '123',
      name: '封面.png',
      status: 'finished',
      url: 'https://vtsuru.live/vtsuru/objects/0196238b93927493a3848b61c8340d02?fid=123',
      thumbnailUrl: 'https://vtsuru.live/vtsuru/objects/0196238b93927493a3848b61c8340d02?fid=123',
      type: 'image/png',
    })
  })

  it('preserves existing image extension if present', () => {
    const result = createCoverFileInfo({
      id: 456,
      name: 'my-avatar.webp',
      path: 'https://vtsuru.live/files/avatar.webp',
    })

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('my-avatar.webp')
    expect(result[0].type).toBe('image/png')
  })
})
