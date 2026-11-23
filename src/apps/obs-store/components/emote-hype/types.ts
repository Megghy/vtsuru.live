import type { ObsWidgetTheme } from '@/apps/obs-store/components/shared/theme'

export type EmoteHypeMode = 'combo' | 'meter' | 'fountain'

export interface EmoteHypeState {
  title: string
  mode: EmoteHypeMode
  theme: ObsWidgetTheme
  accentColor: string
  fontFamily: string
  /** 逗号分隔的高频热词，命中获得双倍充能并触发喷泉 */
  hotWords: string
  /** 可选自定义表情图片 URL（每行一个或逗号分隔） */
  customEmoteUrls: string
  /** 单条普通弹幕增加的热度 (0-100) */
  danmakuGain: number
  /** 礼物/SC 基础充能热度 */
  giftGain: number
  /** 每秒自然衰减热度 */
  decayPerSec: number
  /** 满槽高能文案 */
  feverText: string
  /** 喷泉粒子缩放倍率 */
  particleScale: number
  /** 同屏最大粒子数 */
  maxParticles: number
}

export interface FountainBurstItem {
  kind: 'text' | 'image'
  content: string
  color?: string
  scale?: number
}

export type EmoteHypeAction =
  | { type: 'HYPE_ADD'; delta: number; particles?: FountainBurstItem[]; isHot?: boolean }
  | { type: 'FOUNTAIN_BURST'; particles: FountainBurstItem[] }
  | { type: 'TRIGGER_FEVER'; particles?: FountainBurstItem[] }
  | { type: 'RESET_HYPE' }

export const DEFAULT_EMOTE_HYPE_STATE: EmoteHypeState = {
  title: '直播间氛围热度',
  mode: 'combo',
  theme: 'neon',
  accentColor: '#f43f5e',
  fontFamily: '',
  hotWords: '草,666,哈哈哈,打call,牛',
  customEmoteUrls: '',
  danmakuGain: 4,
  giftGain: 18,
  decayPerSec: 3.5,
  feverText: 'FEVER 高能满槽',
  particleScale: 1,
  maxParticles: 64,
}

export function parseHotWords(raw: string): string[] {
  return raw
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function parseCustomEmoteUrls(raw: string): string[] {
  return raw
    .split(/[\n,，]/)
    .map((item) => item.trim())
    .filter((item) => /^https?:\/\//i.test(item))
}
