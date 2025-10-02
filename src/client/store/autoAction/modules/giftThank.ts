import type { Ref } from 'vue'
import type {
  AutoActionItem,
  RuntimeState,
} from '../types'
import type { EventModel } from '@/api/api-models'

import {
  executeActions,
  filterValidActions,
} from '../actionUtils'
import {
  TriggerType,
} from '../types'

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
  function processGift(
    event: EventModel,
    actions: AutoActionItem[],
    runtimeState: RuntimeState,
  ) {
    if (!roomId.value) return

    // 使用通用函数过滤有效的礼物感谢操作
    const giftActions = filterValidActions(actions, TriggerType.GIFT, isLive, isTianXuanActive)

    // 使用通用执行函数处理礼物事件
    if (giftActions.length > 0 && roomId.value) {
      // 礼物基本信息
      const giftName = event.msg
      const giftPrice = event.price / 1000

      executeActions(
        giftActions,
        event,
        TriggerType.GIFT,
        roomId.value,
        runtimeState,
        { sendLiveDanmaku },
        {
          customFilters: [
            // 礼物过滤逻辑
            (action, context) => {
              // 黑名单模式
              if (action.triggerConfig.filterMode === 'blacklist'
                && action.triggerConfig.filterGiftNames?.includes(giftName)) {
                return false
              }

              // 白名单模式
              if (action.triggerConfig.filterMode === 'whitelist'
                && !action.triggerConfig.filterGiftNames?.includes(giftName)) {
                return false
              }

              // 礼物价值过滤
              if (action.triggerConfig.minValue && giftPrice < action.triggerConfig.minValue) {
                return false
              }

              return true
            },
          ],
        },
      )
    }
  }

  return {
    processGift,
  }
}
