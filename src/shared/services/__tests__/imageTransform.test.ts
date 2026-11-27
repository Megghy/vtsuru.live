import { describe, expect, it } from 'vitest'

import {
  deriveSpecForBox,
  normalizeImageTransformSpec,
  stripImageTransformFromUrl,
  transformHtmlImages,
  transformImageUrl,
} from '../imageTransform'

describe('normalizeImageTransformSpec', () => {
  it('supports presets and constrained overrides in Bilibili query syntax', () => {
    expect(normalizeImageTransformSpec('thumb')).toBe('p_thumb')
    expect(normalizeImageTransformSpec({ preset: 'avatar' })).toBe('p_avatar')
    expect(normalizeImageTransformSpec({ preset: 'thumb', format: 'avif' })).toBe('320w_320h.avif')
    expect(normalizeImageTransformSpec({ width: 400, quality: 78 })).toBe('480w')
    expect(normalizeImageTransformSpec({ width: 256, height: 256, fit: 'fill', quality: 85, format: 'avif' })).toBe(
      '256w_256h_1c_85q.avif',
    )
    expect(normalizeImageTransformSpec({ quality: 75 })).toBe('75q.webp')
  })

  it('accepts valid canonical tokens and rejects invalid specs', () => {
    expect(normalizeImageTransformSpec('p_thumb')).toBe('p_thumb')
    expect(normalizeImageTransformSpec('100w_100h')).toBe('100w_100h')
    expect(normalizeImageTransformSpec('1920w_90q')).toBe('1920w_90q')
    expect(normalizeImageTransformSpec('256w_256h_1c_85q.avif')).toBe('256w_256h_1c_85q.avif')

    expect(normalizeImageTransformSpec('p_unknown')).toBeNull()
    expect(normalizeImageTransformSpec('500w')).toBeNull()
    expect(normalizeImageTransformSpec('0w')).toBeNull()
    expect(normalizeImageTransformSpec('1c')).toBeNull()
    expect(normalizeImageTransformSpec({ width: 0, height: 0 })).toBeNull()
  })
})

describe('deriveSpecForBox', () => {
  it('snaps box CSS pixels multiplied by capped DPR to whitelist buckets', () => {
    expect(deriveSpecForBox(36, 36, { crop: true, dpr: 2 })).toEqual({
      width: 100,
      height: 100,
      fit: 'fill',
      quality: undefined,
      format: undefined,
    })
    expect(deriveSpecForBox(180, 120, { crop: true, dpr: 2 })).toEqual({
      width: 480,
      fit: 'fit',
      quality: undefined,
      format: undefined,
    })
    expect(deriveSpecForBox(300, 200, { dpr: 3 })).toEqual({
      width: 640,
      fit: 'fit',
      quality: undefined,
      format: undefined,
    })
    expect(deriveSpecForBox(0, 0, { dpr: 2 })).toBeNull()
  })
})

describe('transformImageUrl & stripImageTransformFromUrl', () => {
  it('appends Bilibili-style query tokens without changing URL pathname', () => {
    expect(transformImageUrl('https://files.vtsuru.suki.club/imgur/None.png', '100w_100h')).toBe(
      'https://files.vtsuru.suki.club/imgur/None.png?100w_100h',
    )

    expect(transformImageUrl('https://files.vtsuru.suki.club/vtsuru/objects/019abc?fid=12&sig=123.xyz', 'card')).toBe(
      'https://files.vtsuru.suki.club/vtsuru/objects/019abc?fid=12&sig=123.xyz&p_card',
    )

    expect(
      transformImageUrl('https://cdn.custom-streamer.example/file/vtsuru/objects/019abc?fid=15', {
        width: 600,
        format: 'webp',
      }),
    ).toBe('https://cdn.custom-streamer.example/file/vtsuru/objects/019abc?fid=15&640w')

    expect(transformImageUrl('https://cdn.custom-streamer.example/file-object/88?fid=88&sig=abc', 'thumb')).toBe(
      'https://cdn.custom-streamer.example/file-object/88?fid=88&sig=abc&p_thumb',
    )
  })

  it('replaces existing transform token and strips back to original URL for lightbox', () => {
    const transformed = transformImageUrl(
      'https://files.vtsuru.suki.club/vtsuru/objects/019abc?fid=12&sig=123.xyz&p_thumb',
      '1280w',
    )
    expect(transformed).toBe('https://files.vtsuru.suki.club/vtsuru/objects/019abc?fid=12&sig=123.xyz&1280w')
    expect(stripImageTransformFromUrl(transformed)).toBe(
      'https://files.vtsuru.suki.club/vtsuru/objects/019abc?fid=12&sig=123.xyz',
    )
    expect(stripImageTransformFromUrl('https://files.vtsuru.suki.club/imgur/None.png?100w_100h')).toBe(
      'https://files.vtsuru.suki.club/imgur/None.png',
    )
  })

  it('skips non-gateway URLs, svg/video, data URIs, and disabled transforms', () => {
    expect(transformImageUrl('https://i0.hdslb.com/bfs/face/abc.jpg', 'avatar')).toBe(
      'https://i0.hdslb.com/bfs/face/abc.jpg',
    )
    expect(transformImageUrl('https://files.vtsuru.suki.club/imgur/logo.svg', 'thumb')).toBe(
      'https://files.vtsuru.suki.club/imgur/logo.svg',
    )
    expect(transformImageUrl('https://files.vtsuru.suki.club/imgur/a.png', false)).toBe(
      'https://files.vtsuru.suki.club/imgur/a.png',
    )
    expect(transformImageUrl('data:image/png;base64,AAA', 'thumb')).toBe('data:image/png;base64,AAA')
  })

  it('routes public custom S3 files through gateway when fileId and isPublic are provided', () => {
    expect(
      transformImageUrl('https://bucket.s3.example.com/vtsuru/objects/019abc?X-Amz-Signature=123', 'card', {
        fileId: 99,
        isPublic: true,
      }),
    ).toBe('https://files.vtsuru.suki.club/file-object/99?fid=99&p_card')

    expect(
      transformImageUrl('https://bucket.s3.example.com/vtsuru/objects/019abc?X-Amz-Signature=123', 'card', {
        fileId: 99,
        isPublic: false,
      }),
    ).toBe('https://bucket.s3.example.com/vtsuru/objects/019abc?X-Amz-Signature=123')
  })
})

describe('transformHtmlImages', () => {
  it('rewrites gateway img src inside rich text HTML while leaving external URLs intact', () => {
    const input =
      '<p><img src="https://files.vtsuru.suki.club/vtsuru/objects/019abc?fid=1&amp;sig=abc" alt="a"><img src="https://example.com/ext.png"></p>'
    expect(transformHtmlImages(input)).toBe(
      '<p><img src="https://files.vtsuru.suki.club/vtsuru/objects/019abc?fid=1&amp;sig=abc&amp;1280w_85q" alt="a"><img src="https://example.com/ext.png"></p>',
    )
    expect(transformHtmlImages(input, 'card')).toBe(
      '<p><img src="https://files.vtsuru.suki.club/vtsuru/objects/019abc?fid=1&amp;sig=abc&amp;p_card" alt="a"><img src="https://example.com/ext.png"></p>',
    )
  })
})
