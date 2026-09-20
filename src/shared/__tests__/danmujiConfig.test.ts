import { describe, expect, it } from 'vitest'

import { defaultDanmujiConfig, normalizeDanmujiConfig } from '@/shared/danmujiConfig'

describe('danmujiConfig contract', () => {
  it('defaultDanmujiConfig 提供完整的默认配置', () => {
    expect(defaultDanmujiConfig.minGiftPrice).toBe(0.1)
    expect(defaultDanmujiConfig.showDanmaku).toBe(true)
    expect(defaultDanmujiConfig.showGift).toBe(true)
    expect(defaultDanmujiConfig.showGiftName).toBe(true)
    expect(defaultDanmujiConfig.mergeSimilarDanmaku).toBe(false)
    expect(defaultDanmujiConfig.mergeGift).toBe(true)
    expect(defaultDanmujiConfig.maxNumber).toBe(60)
    expect(defaultDanmujiConfig.blockLevel).toBe(0)
    expect(defaultDanmujiConfig.blockKeywords).toBe('')
    expect(defaultDanmujiConfig.blockUsers).toBe('')
    expect(defaultDanmujiConfig.blockMedalLevel).toBe(0)
    expect(defaultDanmujiConfig.giftUsernamePronunciation).toBe('')
    expect(defaultDanmujiConfig.importPresetCss).toBe(false)
    expect(Array.isArray(defaultDanmujiConfig.emoticons)).toBe(true)
    expect(defaultDanmujiConfig.emoticons).toHaveLength(0)
  })

  it('normalizeDanmujiConfig 处理空输入或非法输入时返回默认配置', () => {
    expect(normalizeDanmujiConfig(undefined)).toEqual(defaultDanmujiConfig)
    expect(normalizeDanmujiConfig(null)).toEqual(defaultDanmujiConfig)
    expect(normalizeDanmujiConfig('invalid string')).toEqual(defaultDanmujiConfig)
    expect(normalizeDanmujiConfig(123)).toEqual(defaultDanmujiConfig)
  })

  it('normalizeDanmujiConfig 正确迁移 blockUsers 与 blockKeywords 从 string[] 到换行文本', () => {
    const legacyConfig = {
      blockUsers: ['bad_user_1', 'bad_user_2', '  ', 'user_3'],
      blockKeywords: ['spam', 'ad', '  '],
    }

    const normalized = normalizeDanmujiConfig(legacyConfig)
    expect(normalized.blockUsers).toBe('bad_user_1\nbad_user_2\nuser_3')
    expect(normalized.blockKeywords).toBe('spam\nad')
  })

  it('normalizeDanmujiConfig 保留已是 string 的 blockUsers 与 blockKeywords', () => {
    const stringConfig = {
      blockUsers: 'user1\nuser2',
      blockKeywords: 'key1\nkey2',
    }

    const normalized = normalizeDanmujiConfig(stringConfig)
    expect(normalized.blockUsers).toBe('user1\nuser2')
    expect(normalized.blockKeywords).toBe('key1\nkey2')
  })

  it('normalizeDanmujiConfig 补全缺失字段并规范化数值与布尔值', () => {
    const partialConfig = {
      minGiftPrice: '5.2',
      showDanmaku: false,
      maxNumber: 120,
      emoticons: [
        { keyword: '233', url: 'https://example.com/233.png' },
        { keyword: '', url: 'https://example.com/empty.png' },
        { keyword: 'test', url: '' },
      ],
    }

    const normalized = normalizeDanmujiConfig(partialConfig)
    expect(normalized.minGiftPrice).toBe(5.2)
    expect(normalized.showDanmaku).toBe(false)
    expect(normalized.maxNumber).toBe(120)
    expect(normalized.showGift).toBe(true)
    expect(normalized.blockUsers).toBe('')
    expect(normalized.emoticons).toEqual([{ keyword: '233', url: 'https://example.com/233.png' }])
  })
})
