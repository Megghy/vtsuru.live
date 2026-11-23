import type { Ref } from 'vue'

import type { EventModel } from '@/api/client-types'

import { executeActions, filterValidActions } from '../actionUtils'
import type { AutoActionItem, RuntimeState } from '../types'
import { TriggerType } from '../types'

export function matchesGiftTrigger(action: AutoActionItem, event: EventModel): boolean {
  const giftName = event.msg
  const rawPrice = event.price || 0
  const giftValue = Math.abs(rawPrice)
  const { filterMode, filterGiftNames, minValue } = action.triggerConfig

  if (filterMode === 'free' && rawPrice <= 0) {
    return false
  }
  if (filterMode === 'blacklist' && filterGiftNames?.includes(giftName)) {
    return false
  }
  if (filterMode === 'whitelist' && !filterGiftNames?.includes(giftName)) {
    return false
  }
  if (filterMode !== 'none' && minValue && giftValue < minValue) {
    return false
  }
  return true
}

/**
 * 礼物感谢模块
 * @param isLive 是否处于直播状态
 * @param roomId 房间ID
 * @param isTianXuanActive 是否处于天选时刻
 * @param sendLiveDanmaku 发送弹幕函数
 */
export function useGiftThank(
  isLive: Ref<boolean>,
  roomId: Ref<number | undefined>,
  isTianXuanActive: Ref<boolean>,
  sendLiveDanmaku: (roomId: number, message: string) => Promise<boolean>,
) {
  /**
   * 处理礼物事件
   * @param event 礼物事件
   * @param actions 自动操作列表
   * @param runtimeState 运行时状态
   */
  function processGift(event: EventModel, actions: AutoActionItem[], runtimeState: RuntimeState, isTest = false) {
    if (!roomId.value) return

    // 使用通用函数过滤有效的礼物感谢操作
    const giftActions = filterValidActions(actions, TriggerType.GIFT, isLive, isTianXuanActive, { isTest })

    // 使用通用执行函数处理礼物事件
    if (giftActions.length > 0 && roomId.value) {
      executeActions(
        giftActions,
        event,
        TriggerType.GIFT,
        roomId.value,
        runtimeState,
        { sendLiveDanmaku },
        {
          isTest,
          customFilters: [(action) => matchesGiftTrigger(action, event)],
        },
      )
    }
  }

  return {
    processGift,
  }
}
