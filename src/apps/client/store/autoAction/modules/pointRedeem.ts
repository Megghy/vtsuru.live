import type { Ref } from 'vue'

import type { EventModel } from '@/api/client-types'
import { EventDataTypes } from '@/api/generated/model'

import { executeActions, filterValidActions } from '../actionUtils'
import type { AutoActionItem, RuntimeState } from '../types'
import { TriggerType } from '../types'
import { buildExecutionContext } from '../utils'

export interface PointOrderRedeemedHubEvent {
  OrderId?: number
  orderId?: number
  GoodsId?: number
  goodsId?: number
  GoodsName?: string
  goodsName?: string
  GoodsType?: number
  goodsType?: number
  Count?: number
  count?: number
  Point?: number
  point?: number
  IsFree?: boolean
  isFree?: boolean
  BuyerName?: string
  buyerName?: string
  BuyerUid?: number
  buyerUid?: number
  BuyerOpenId?: string
  buyerOpenId?: string
  Remark?: string | null
  remark?: string | null
  SelectedSubItems?: string[]
  selectedSubItems?: string[]
  Timestamp?: number
  timestamp?: number
}

export interface NormalizedPointOrder {
  orderId: number
  goodsId: number
  goodsName: string
  goodsType: number
  count: number
  point: number
  isFree: boolean
  buyerName: string
  buyerUid: number
  buyerOpenId: string
  remark: string
  selectedSubItems: string[]
  subItems: string
  timestamp: number
}

function pick<T>(source: Record<string, unknown>, ...keys: string[]): T | undefined {
  for (const key of keys) {
    const val = source[key]
    if (val !== undefined && val !== null) return val as T
  }
  return undefined
}

export function normalizePointRedeemEvent(payload: PointOrderRedeemedHubEvent): NormalizedPointOrder {
  const raw = payload as unknown as Record<string, unknown>
  const point = Number(pick<number>(raw, 'Point', 'point') ?? 0)
  const selectedSubItems = pick<string[]>(raw, 'SelectedSubItems', 'selectedSubItems') ?? []
  return {
    orderId: Number(pick<number>(raw, 'OrderId', 'orderId') ?? 0),
    goodsId: Number(pick<number>(raw, 'GoodsId', 'goodsId') ?? 0),
    goodsName: String(pick<string>(raw, 'GoodsName', 'goodsName') ?? ''),
    goodsType: Number(pick<number>(raw, 'GoodsType', 'goodsType') ?? 0),
    count: Number(pick<number>(raw, 'Count', 'count') ?? 1),
    point,
    isFree: Boolean(pick<boolean>(raw, 'IsFree', 'isFree') ?? point <= 0),
    buyerName: String(pick<string>(raw, 'BuyerName', 'buyerName') ?? ''),
    buyerUid: Number(pick<number>(raw, 'BuyerUid', 'buyerUid') ?? 0),
    buyerOpenId: String(pick<string>(raw, 'BuyerOpenId', 'buyerOpenId') ?? ''),
    remark: String(pick<string>(raw, 'Remark', 'remark') ?? ''),
    selectedSubItems,
    subItems: selectedSubItems.join('、'),
    timestamp: Number(pick<number>(raw, 'Timestamp', 'timestamp') ?? Date.now()),
  }
}

export function matchesPointRedeemTrigger(action: AutoActionItem, order: NormalizedPointOrder): boolean {
  const cfg = action.triggerConfig
  if (cfg.pointIncludeFree === false && order.isFree) return false
  if (cfg.pointGoodsIds && cfg.pointGoodsIds.length > 0 && !cfg.pointGoodsIds.includes(order.goodsId)) {
    return false
  }
  if (cfg.pointGoodsNameKeywords && cfg.pointGoodsNameKeywords.length > 0) {
    const target = order.goodsName.toLowerCase()
    const matched = cfg.pointGoodsNameKeywords.some((kw) => kw.trim() && target.includes(kw.trim().toLowerCase()))
    if (!matched) return false
  }
  return true
}

export function usePointRedeem(
  isLive: Ref<boolean>,
  roomId: Ref<number | undefined>,
  isTianXuanActive: Ref<boolean>,
  sendDanmaku: (roomId: number, message: string) => Promise<boolean>,
  sendPrivateMessage: (userId: number, message: string) => Promise<boolean>,
) {
  function processPointRedeem(
    payload: PointOrderRedeemedHubEvent,
    allActions: AutoActionItem[],
    runtimeState: RuntimeState,
    isTest = false,
  ) {
    if (!roomId.value) return
    const order = normalizePointRedeemEvent(payload)

    const validActions = filterValidActions(allActions, TriggerType.POINT_REDEEM, isLive, isTianXuanActive, {
      isTest,
      customFilter: (action) => matchesPointRedeemTrigger(action, order),
    })

    if (validActions.length === 0) return

    const syntheticEvent: EventModel = {
      type: EventDataTypes.Gift,
      uname: order.buyerName,
      uface: '',
      uid: order.buyerUid,
      open_id: order.buyerOpenId,
      ouid: order.buyerOpenId || String(order.buyerUid || ''),
      msg: order.goodsName,
      time: Math.floor(order.timestamp / 1000),
      num: order.count,
      price: order.point,
      guard_level: 0,
      fans_medal_level: 0,
      fans_medal_name: '',
      fans_medal_wearing_status: false,
    }

    executeActions(
      validActions,
      syntheticEvent,
      TriggerType.POINT_REDEEM,
      roomId.value,
      runtimeState,
      {
        sendLiveDanmaku: sendDanmaku,
        sendPrivateMessage,
      },
      {
        isTest,
        skipUserFilters: order.buyerUid <= 0,
        customContextBuilder: (ev, rid, tt) =>
          buildExecutionContext(ev, rid, tt, {
            pointOrder: order,
          }),
      },
    )
  }

  return { processPointRedeem }
}
