/**
 * 弹幕姬配置契约与工具
 */

import { defaultDanmujiStyle, normalizeDanmujiStyle, type DanmujiStyle } from './danmujiStyle'

export interface DanmujiConfig {
  style: DanmujiStyle
  minGiftPrice: number
  showDanmaku: boolean
  showGift: boolean
  showGiftName: boolean
  mergeSimilarDanmaku: boolean
  mergeGift: boolean
  maxNumber: number

  blockLevel: number
  blockKeywords: string
  blockUsers: string
  blockMedalLevel: number

  giftUsernamePronunciation: string
  importPresetCss: boolean

  emoticons: {
    keyword: string
    url: string
  }[]
}

export const defaultDanmujiConfig: DanmujiConfig = {
  style: defaultDanmujiStyle,
  minGiftPrice: 0.1,
  showDanmaku: true,
  showGift: true,
  showGiftName: true,
  mergeSimilarDanmaku: false,
  mergeGift: true,
  maxNumber: 60,

  blockLevel: 0,
  blockKeywords: '',
  blockUsers: '',
  blockMedalLevel: 0,

  giftUsernamePronunciation: '',
  importPresetCss: false,

  emoticons: [],
}

function normalizeList(value: unknown): string {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean).join('\n')
  return typeof value === 'string' ? value : ''
}

/** 云端及本地旧配置在读取边界统一迁移。 */
export function normalizeDanmujiConfig(input?: unknown): DanmujiConfig {
  const raw = input && typeof input === 'object' ? input as Record<string, unknown> : {}
  const config = { ...defaultDanmujiConfig, emoticons: [] } as DanmujiConfig
  for (const key of Object.keys(defaultDanmujiConfig) as (keyof DanmujiConfig)[]) {
    const value = raw[key]
    const fallback = defaultDanmujiConfig[key]
    if (typeof fallback === 'boolean' && typeof value === 'boolean') Object.assign(config, { [key]: value })
    if (typeof fallback === 'string' && typeof value === 'string') Object.assign(config, { [key]: value })
    if (typeof fallback === 'number' && (typeof value === 'number' || typeof value === 'string' && value.trim() !== '') && Number.isFinite(Number(value))) Object.assign(config, { [key]: Number(value) })
  }
  config.blockUsers = normalizeList(raw.blockUsers)
  config.style = normalizeDanmujiStyle(raw.style)
  config.blockKeywords = normalizeList(raw.blockKeywords)
  if (Array.isArray(raw.emoticons)) {
    config.emoticons = raw.emoticons.filter((item) => item && typeof item.keyword === 'string' && item.keyword && typeof item.url === 'string' && item.url).map(({ keyword, url }) => ({ keyword, url }))
  }
  return config
}
