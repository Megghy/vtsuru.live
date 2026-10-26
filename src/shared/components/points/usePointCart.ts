import { computed } from 'vue'

import type { ResponsePointGoodModel } from '@/api/client-types'
import { GoodsTypes } from '@/api/generated/model'
import { usePersistedStorage } from '@/shared/storage/persist'

export type BuySubItem = { subItemId: number; quantity: number }

/** 购物车条目只存选择,礼物详情以最新列表为准 */
export interface PointCartItem {
  goodsId: number
  count: number
  selectedSubItems?: BuySubItem[]
  remark?: string
}

/** 按当前选择计算花费与是否需要收货地址,兑换弹窗与购物车共用 */
export function evaluateSelection(goods: ResponsePointGoodModel, item: Omit<PointCartItem, 'goodsId'>) {
  const subs = goods.subItems ?? []
  if (subs.length) {
    const selected = new Map((item.selectedSubItems ?? []).map((s) => [Number(s.subItemId), s.quantity]))
    const picked = subs.filter((s) => selected.has(Number(s.id)))
    const sum = picked.reduce((acc, s) => acc + Number(s.price) * (selected.get(Number(s.id)) ?? 0), 0)
    return {
      cost: goods.canFreeBuy ? 0 : Number(sum.toFixed(2)),
      needAddress: picked.some((s) => s.type === GoodsTypes.Physical && !s.collectUrl),
    }
  }
  return {
    cost: goods.canFreeBuy ? 0 : Number((Math.max(goods.price, 0) * item.count).toFixed(2)),
    needAddress: goods.type === GoodsTypes.Physical && !goods.collectUrl,
  }
}

/** 按主播分开存储,同一 vId 的所有调用方共享同一份响应式数据 */
export function usePointCart(vId: number) {
  const items = usePersistedStorage<PointCartItem[]>(`vtsuru:point:cart:${vId}`, [])
  const count = computed(() => items.value.length)

  const find = (goodsId: number) => items.value.find((i) => i.goodsId === goodsId)

  /** 同一礼物只保留一条,再次加入即原位覆盖 */
  function put(item: PointCartItem) {
    const exists = items.value.some((i) => i.goodsId === item.goodsId)
    items.value = exists ? items.value.map((i) => (i.goodsId === item.goodsId ? item : i)) : [...items.value, item]
  }

  function remove(goodsId: number) {
    items.value = items.value.filter((i) => i.goodsId !== goodsId)
  }

  function clear() {
    items.value = []
  }

  return { items, count, find, put, remove, clear }
}
