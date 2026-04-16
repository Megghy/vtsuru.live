import type { DanmakuModel, EventModel } from '@/api/api-models'
import { EventDataTypes } from '@/api/api-models'

type DanmakuGiftLike = Pick<DanmakuModel, 'type' | 'msg' | 'num' | 'price'>
  & Partial<Pick<DanmakuModel, 'mysteryBoxName' | 'mysteryBoxPrice'>>
  & Partial<Pick<EventModel, 'mystery_box_name' | 'mystery_box_price'>>

type GiftPaymentLike = {
  giftPrice?: number | null
  price?: number | null
}
  & Partial<Pick<DanmakuModel, 'mysteryBoxName' | 'mysteryBoxPrice'>>
  & Partial<Pick<EventModel, 'mystery_box_name' | 'mystery_box_price'>>

export interface DanmakuGiftDisplayMeta {
  hasMysteryBoxGift: boolean
  hasPaidGift: boolean
  giftName: string
  giftSummaryText: string
  sourceLabelText: string
  mysteryBoxName?: string
  mysteryBoxPriceText?: string
  giftPriceText?: string
}

export interface GiftPaymentDisplayMeta {
  hasMysteryBoxPayment: boolean
  hasPaidGift: boolean
  mysteryBoxName?: string
  mysteryBoxPriceText?: string
  giftPriceText?: string
  shortText: string
  compactText: string
  detailText?: string
}

export function formatDanmakuPrice(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined
  }

  const rounded = Number(value.toFixed(2))
  return rounded.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

export function getGiftPaymentDisplayMeta(item: GiftPaymentLike): GiftPaymentDisplayMeta {
  const mysteryBoxName = normalizeText(item.mysteryBoxName, item.mystery_box_name)
  const mysteryBoxPrice = normalizePositivePrice(item.mysteryBoxPrice, item.mystery_box_price)
  const giftPrice = normalizePositivePrice(item.giftPrice, item.price)
  const mysteryBoxPriceText = formatDanmakuPrice(mysteryBoxPrice)
  const giftPriceText = formatDanmakuPrice(giftPrice)
  const hasMysteryBoxPayment = !!mysteryBoxName || mysteryBoxPrice !== undefined

  const compactParts = hasMysteryBoxPayment
    ? [
        mysteryBoxPriceText ? `盲盒 ￥${mysteryBoxPriceText}` : '盲盒',
        giftPriceText ? `开出 ￥${giftPriceText}` : undefined,
      ]
    : [giftPriceText ? `礼物 ￥${giftPriceText}` : '免费礼物']

  const detailParts = [
    mysteryBoxName ? `来源 ${mysteryBoxName}` : undefined,
    mysteryBoxPriceText ? `盲盒 ￥${mysteryBoxPriceText}` : undefined,
    giftPriceText ? `${hasMysteryBoxPayment ? '开出' : '礼物'} ￥${giftPriceText}` : undefined,
  ].filter(Boolean) as string[]

  return {
    hasMysteryBoxPayment,
    hasPaidGift: giftPrice !== undefined,
    mysteryBoxName,
    mysteryBoxPriceText,
    giftPriceText,
    shortText: hasMysteryBoxPayment
      ? mysteryBoxPriceText ? `盲盒 ￥${mysteryBoxPriceText}` : '盲盒'
      : giftPriceText ? `￥${giftPriceText}` : '免费礼物',
    compactText: compactParts.filter(Boolean).join(' / '),
    detailText: detailParts.length > 0 ? detailParts.join(' / ') : undefined,
  }
}

export function getDanmakuGiftDisplayMeta(item: DanmakuGiftLike): DanmakuGiftDisplayMeta {
  const giftName = normalizeText(item.msg) ?? '礼物'
  const count = typeof item.num === 'number' && Number.isFinite(item.num) && item.num > 1 ? Math.trunc(item.num) : 1
  const mysteryBoxName = normalizeText(item.mysteryBoxName, item.mystery_box_name)
  const mysteryBoxPrice = normalizePositivePrice(item.mysteryBoxPrice, item.mystery_box_price)
  const giftPrice = normalizePositivePrice(item.price)
  const hasMysteryBoxGift = item.type === EventDataTypes.Gift && (!!mysteryBoxName || mysteryBoxPrice !== undefined)

  return {
    hasMysteryBoxGift,
    hasPaidGift: giftPrice !== undefined,
    giftName,
    giftSummaryText: count > 1 ? `${count} × ${giftName}` : giftName,
    sourceLabelText: mysteryBoxName ?? (giftPrice !== undefined ? '礼物' : '免费礼物'),
    mysteryBoxName,
    mysteryBoxPriceText: formatDanmakuPrice(mysteryBoxPrice),
    giftPriceText: formatDanmakuPrice(giftPrice),
  }
}

function normalizeText(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (!value)
      continue

    const trimmed = value.trim()
    if (trimmed) {
      return trimmed
    }
  }

  return undefined
}

function normalizePositivePrice(...values: Array<number | null | undefined>) {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return value
    }
  }

  return undefined
}
