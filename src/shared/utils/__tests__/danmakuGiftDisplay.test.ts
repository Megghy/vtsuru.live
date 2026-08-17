import { describe, expect, it } from 'vitest'

import { EventDataTypes } from '@/api/api-models'

import {
  formatDanmakuPrice,
  getDanmakuGiftDisplayMeta,
  getGiftPaymentDisplayMeta,
} from '../danmakuGiftDisplay'

describe('formatDanmakuPrice', () => {
  it('formats finite numbers and drops invalid values', () => {
    expect(formatDanmakuPrice(19)).toBe('19')
    expect(formatDanmakuPrice(19.5)).toBe('19.5')
    expect(formatDanmakuPrice(0.1)).toBe('0.1')
    expect(formatDanmakuPrice(Number.NaN)).toBeUndefined()
    expect(formatDanmakuPrice(undefined)).toBeUndefined()
    expect(formatDanmakuPrice(null)).toBeUndefined()
  })
})

describe('getDanmakuGiftDisplayMeta', () => {
  it('summarizes paid gift counts', () => {
    const meta = getDanmakuGiftDisplayMeta({
      type: EventDataTypes.Gift,
      msg: '锦书传意',
      num: 3,
      price: 19,
    })

    expect(meta).toMatchObject({
      giftName: '锦书传意',
      giftSummaryText: '3 × 锦书传意',
      hasPaidGift: true,
      hasMysteryBoxGift: false,
      sourceLabelText: '礼物',
      giftPriceText: '19',
    })
  })

  it('marks free gifts and blank names', () => {
    const meta = getDanmakuGiftDisplayMeta({
      type: EventDataTypes.Gift,
      msg: '   ',
      num: 1,
      price: 0,
    })

    expect(meta.giftName).toBe('礼物')
    expect(meta.giftSummaryText).toBe('礼物')
    expect(meta.hasPaidGift).toBe(false)
    expect(meta.sourceLabelText).toBe('免费礼物')
  })

  it('prefers mystery box metadata from either naming style', () => {
    const camel = getDanmakuGiftDisplayMeta({
      type: EventDataTypes.Gift,
      msg: '小心心',
      num: 1,
      price: 1,
      mysteryBoxName: '星光盲盒',
      mysteryBoxPrice: 5,
    })
    const snake = getDanmakuGiftDisplayMeta({
      type: EventDataTypes.Gift,
      msg: '小心心',
      num: 1,
      price: 1,
      mystery_box_name: '星光盲盒',
      mystery_box_price: 5,
    })

    for (const meta of [camel, snake]) {
      expect(meta.hasMysteryBoxGift).toBe(true)
      expect(meta.mysteryBoxName).toBe('星光盲盒')
      expect(meta.mysteryBoxPriceText).toBe('5')
      expect(meta.sourceLabelText).toBe('星光盲盒')
    }
  })
})

describe('getGiftPaymentDisplayMeta', () => {
  it('builds compact and detail texts for mystery-box payments', () => {
    const meta = getGiftPaymentDisplayMeta({
      giftPrice: 1,
      mysteryBoxName: '星光盲盒',
      mysteryBoxPrice: 5,
    })

    expect(meta).toMatchObject({
      hasMysteryBoxPayment: true,
      hasPaidGift: true,
      shortText: '盲盒 ￥5',
      compactText: '盲盒 ￥5 / 开出 ￥1',
      detailText: '来源 星光盲盒 / 盲盒 ￥5 / 开出 ￥1',
    })
  })

  it('falls back to free gift labels', () => {
    const meta = getGiftPaymentDisplayMeta({ price: 0 })

    expect(meta.hasPaidGift).toBe(false)
    expect(meta.shortText).toBe('免费礼物')
    expect(meta.compactText).toBe('免费礼物')
  })

  it('uses giftPrice over price when both exist', () => {
    const meta = getGiftPaymentDisplayMeta({ giftPrice: 12, price: 99 })
    expect(meta.giftPriceText).toBe('12')
    expect(meta.shortText).toBe('￥12')
  })
})
