import { describe, expect, it } from 'vitest'

import { toImageUploadFileInfo, toImageUploadFileList } from '../uploadFileHelper'

describe('uploadFileHelper', () => {
  describe('toImageUploadFileInfo', () => {
    it('returns null when file or path is missing', () => {
      expect(toImageUploadFileInfo(undefined)).toBeNull()
      expect(toImageUploadFileInfo(null)).toBeNull()
      expect(toImageUploadFileInfo({ id: 1, path: '' })).toBeNull()
      expect(toImageUploadFileInfo({ id: 1, path: null })).toBeNull()
    })

    it('formats file with image type, finished status, url and thumbnailUrl', () => {
      const result = toImageUploadFileInfo({
        id: 123,
        name: 'bg',
        path: 'https://vtsuru.live/vtsuru/objects/abc?fid=123',
      })

      expect(result).toEqual({
        id: '123',
        name: 'bg.png',
        status: 'finished',
        url: 'https://vtsuru.live/vtsuru/objects/abc?fid=123',
        thumbnailUrl: 'https://vtsuru.live/vtsuru/objects/abc?fid=123',
        type: 'image/png',
      })
    })

    it('preserves existing image extension', () => {
      const result = toImageUploadFileInfo({
        id: 'img-1',
        name: 'photo.webp',
        path: '/static/photo.webp',
      })

      expect(result?.name).toBe('photo.webp')
      expect(result?.type).toBe('image/png')
    })
  })

  describe('toImageUploadFileList', () => {
    it('returns empty array on empty or invalid input', () => {
      expect(toImageUploadFileList(undefined)).toEqual([])
      expect(toImageUploadFileList(null)).toEqual([])
      expect(toImageUploadFileList([])).toEqual([])
    })

    it('filters out invalid items and maps valid items', () => {
      const results = toImageUploadFileList([
        { id: 1, name: 'valid.jpg', path: 'https://vtsuru.live/1.jpg' },
        { id: 2, name: 'invalid', path: null },
        null,
        { id: 3, name: 'another', path: 'https://vtsuru.live/objects/3' },
      ])

      expect(results).toHaveLength(2)
      expect(results[0].id).toBe('1')
      expect(results[0].name).toBe('valid.jpg')
      expect(results[1].id).toBe('3')
      expect(results[1].name).toBe('another.png')
    })
  })
})
