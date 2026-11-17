declare module '@/apps/obs/components/blivechat/constants' {
  export const AUTHOR_TYPE_NORMAL: number
  export const AUTHOR_TYPE_MEMBER: number
  export const AUTHOR_TYPE_ADMIN: number
  export const AUTHOR_TYPE_OWNER: number
  export const AUTHOR_TYPE_TO_TEXT: readonly string[]

  export const MESSAGE_TYPE_TEXT: number
  export const MESSAGE_TYPE_GIFT: number
  export const MESSAGE_TYPE_MEMBER: number
  export const MESSAGE_TYPE_SUPER_CHAT: number
  export const MESSAGE_TYPE_DEL: number
  export const MESSAGE_TYPE_UPDATE: number

  export const CONTENT_TYPE_TEXT: number
  export const CONTENT_TYPE_IMAGE: number

  export interface PriceConfig {
    price: number
    colors: {
      contentBg: string
      headerBg: string
      header: string
      authorName: string
      time: string
      content: string
    }
    pinTime: number
    priceLevel: number
  }

  export function getShowGuardLevelText(guardLevel: number): string
  export function getPriceConfig(price: number): PriceConfig
  export function getShowContent(message: { content?: string; translation?: string }): string
  export function getShowRichContent(message: {
    richContent: Array<{ type: number; text: string; url?: string; width?: number; height?: number }>
    translation?: string
  }): Array<{ type: number; text: string; url?: string; width?: number; height?: number }>
  export function getShowContentParts(message: {
    content?: string
    contentParts?: Array<{ type: number; text: string; url?: string; width?: number; height?: number }>
    translation?: string
  }): Array<{ type: number; text: string; url?: string; width?: number; height?: number }>
  export function getGiftShowContent(message: { giftName?: string; num?: number }, showGiftName: boolean): string
  export function getGiftShowNameAndNum(message: { giftName?: string; num?: number }): string
  export function getShowAuthorName(message: { authorName: string; authorNamePronunciation?: string }): string
}

declare module '@/apps/obs/components/blivechat/utils' {
  export function mergeConfig<T extends Record<string, unknown>>(config: Partial<T>, defaultConfig: T): T
  export function toBool(val: unknown): boolean
  export function toInt(val: unknown, _default: number): number
  export function toFloat(val: unknown, _default: number): number
  export function formatCurrency(price: number): string
  export function getTimeTextHourMin(date: Date | number): string
  export function getUuid4Hex(): string
}

declare module '@/apps/obs/components/blivechat/utils/pronunciation' {
  export const DICT_PINYIN: string
  export const DICT_KANA: string
  export class PronunciationConverter {
    pronunciationMap: Map<string, string>
    loadDict(dictName: string): Promise<void>
    getPronunciation(text: string): string
  }
}

declare module '@/apps/obs/components/blivechat/utils/trie' {
  export class Trie<T = unknown> {
    set(key: string, value: T): void
    get(key: string): T | null
    has(key: string): boolean
    lazyMatch(str: string): T | null
  }
}
