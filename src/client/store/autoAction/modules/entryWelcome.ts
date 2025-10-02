import type { Ref } from 'vue'
import type {
  AutoActionItem,
  RuntimeState,
} from '../types'
import type { EventModel } from '@/api/api-models'
import { ref } from 'vue'
import {
  executeActions,
  filterValidActions,
} from '../actionUtils'
import {
  TriggerType,
} from '../types'

/**
 * 入场欢迎模块
 * @param isLive 是否处于直播状态
 * @param roomId 房间ID
 * @param isTianXuanActive 是否处于天选时刻
 * @param sendLiveDanmaku 发送弹幕函数
 */
export function useEntryWelcome(
  isLive: Ref<boolean>,
  roomId: Ref<number | undefined>,
  isTianXuanActive: Ref<boolean>,
  sendLiveDanmaku: (roomId: number, message: string) => Promise<boolean>,
) {
  // 运行时数据
  const timer = ref<any | null>(null)

  /**
   * 处理入场事件 - 支持新的AutoActionItem结构
   * @param event 入场事件
   * @param actions 自动操作列表
   * @param runtimeState 运行时状态
   */
  function processEnter(
    event: EventModel,
    actions: AutoActionItem[],
    runtimeState: RuntimeState,
  ) {
    if (!roomId.value) return

    // 使用通用函数过滤有效的入场欢迎操作
    const enterActions = filterValidActions(actions, TriggerType.ENTER, isLive, isTianXuanActive)

    // 使用通用执行函数处理入场事件
    if (enterActions.length > 0 && roomId.value) {
      executeActions(
        enterActions,
        event,
        TriggerType.ENTER,
        roomId.value,
        runtimeState,
        { sendLiveDanmaku },
        {
          customFilters: [
            // 检查入场过滤条件
            (action, context) => {
              if (action.triggerConfig.filterMode === 'blacklist'
                && action.triggerConfig.filterGiftNames?.includes(event.uname)) {
                return false
              }
              return true
            },
          ],
        },
      )
    }
  }

  /**
   * 清理计时器
   */
  function clearTimer() {
    if (timer.value) {
      clearTimeout(timer.value)
      timer.value = null
    }
  }

  return {
    processEnter,
    clearTimer,
  }
}
