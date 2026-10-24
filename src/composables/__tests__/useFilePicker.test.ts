import { describe, expect, it, vi } from 'vitest'

import { matchesFileAccept, normalizeAccept, validatePickedFiles } from '../useFilePicker'

describe('useFilePicker helpers', () => {
  describe('normalizeAccept', () => {
    it('normalizes bare extensions, dotted extensions, and MIME types', () => {
      expect(normalizeAccept(undefined)).toBeUndefined()
      expect(normalizeAccept(['png', '.jpg', 'image/webp'])).toBe('.png,.jpg,image/webp')
      expect(normalizeAccept('xlsx, .csv, text/csv')).toBe('.xlsx,.csv,text/csv')
    })
  })

  describe('matchesFileAccept', () => {
    it('matches image/* by MIME or extension fallback when browser leaves type empty', () => {
      expect(matchesFileAccept(new File(['a'], 'cover.png', { type: 'image/png' }), 'image/*')).toBe(true)
      expect(matchesFileAccept(new File(['a'], 'photo.heic', { type: '' }), 'image/*')).toBe(true)
      expect(matchesFileAccept(new File(['a'], 'notes.txt', { type: 'text/plain' }), 'image/*')).toBe(false)
    })

    it('matches JSON and CSV files even when File.type is empty on Windows', () => {
      expect(matchesFileAccept(new File(['{}'], 'profile.json', { type: '' }), 'application/json')).toBe(true)
      expect(matchesFileAccept(new File(['a,b'], 'songs.CSV', { type: '' }), '.xlsx,.xls,.csv')).toBe(true)
      expect(matchesFileAccept(new File(['a,b'], 'songs.txt', { type: 'text/plain' }), '.xlsx,.xls,.csv')).toBe(false)
    })
  })

  describe('validatePickedFiles', () => {
    it('filters invalid format and oversized files and reports readable error', () => {
      const onError = vi.fn()
      const valid = new File(['ok'], 'good.png', { type: 'image/png' })
      const wrongExt = new File(['bad'], 'doc.pdf', { type: 'application/pdf' })
      const tooBig = new File([new Uint8Array(2048)], 'huge.png', { type: 'image/png' })

      const accepted = validatePickedFiles([valid, wrongExt, tooBig], {
        accept: 'image/*',
        maxSize: 1024,
        onError,
      })

      expect(accepted).toEqual([valid])
      expect(onError).toHaveBeenCalledTimes(1)
    })

    it('deduplicates identical files and enforces maxFiles', () => {
      const onError = vi.fn()
      const f1 = new File(['same'], 'a.png', { type: 'image/png', lastModified: 100 })
      const f1Dup = new File(['same'], 'a.png', { type: 'image/png', lastModified: 100 })
      const f2 = new File(['two'], 'b.png', { type: 'image/png', lastModified: 200 })
      const f3 = new File(['three'], 'c.png', { type: 'image/png', lastModified: 300 })

      const accepted = validatePickedFiles([f1, f1Dup, f2, f3], {
        accept: 'image/*',
        dedupe: true,
        maxFiles: 2,
        onError,
      })

      expect(accepted).toEqual([f1, f2])
      expect(onError).toHaveBeenCalledWith('最多可添加 2 个文件')
    })
  })
})
