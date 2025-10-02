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
 * 关注感谢模块
 * @param isLive 是否处于直播状态
 * @param roomId 房间ID
 * @param isTianXuanActive 是否处于天选时刻
 * @param sendLiveDanmaku 发送弹幕函数
 */
export function useFollowThank(
  isLive: Ref<boolean>,
  roomId: Ref<number | undefined>,
  isTianXuanActive: Ref<boolean>,
  sendLiveDanmaku: (roomId: number, message: string) => Promise<boolean>,
) {
  // 运行时数据
  const aggregatedFollows = ref<{ uid: number, name: string, timestamp: number }[]>([])
  const timer = ref<any | null>(null)

  /**
   * 处理关注事件 - 支持新的AutoActionItem结构
   * @param event 关注事件
   * @param actions 自动操作列表
   * @param runtimeState 运行时状态
   */
  function processFollow(
    event: EventModel,
    actions: AutoActionItem[],
    runtimeState: RuntimeState,
  ) {
    if (!roomId.value) return

    // 使用通用函数过滤有效的关注感谢操作
    const followActions = filterValidActions(actions, TriggerType.FOLLOW, isLive, isTianXuanActive)

    // 使用通用执行函数处理关注事件
    if (followActions.length > 0 && roomId.value) {
      executeActions(
        followActions,
        event,
        TriggerType.FOLLOW,
        roomId.value,
        runtimeState,
        { sendLiveDanmaku },
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
    processFollow,
    clearTimer,
  }
}
