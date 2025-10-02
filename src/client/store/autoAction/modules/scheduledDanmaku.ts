import type { Ref } from 'vue'
import type {
  AutoActionItem,
  RuntimeState,
} from '../types'
import { computed, ref } from 'vue'
import {
  executeActions,
  filterValidActions,
} from '../actionUtils'
import {
  TriggerType,
} from '../types'

/**
 * 定时弹幕模块
 * @param isLive 是否处于直播状态
 * @param roomId 房间ID
 * @param sendLiveDanmaku 发送弹幕函数
 */
export function useScheduledDanmaku(
  isLive: Ref<boolean>,
  roomId: Ref<number | undefined>,
  sendLiveDanmaku: (roomId: number, message: string) => Promise<boolean>,
) {
  // 运行时数据
  const timer = ref<any | null>(null)
  const remainingSeconds = ref(0) // 倒计时剩余秒数
  const countdownTimer = ref<any | null>(null) // 倒计时定时器

  /**
   * 处理定时任务 - 使用新的AutoActionItem结构
   * @param actions 自动操作列表
   * @param runtimeState 运行时状态
   */
  function processScheduledActions(
    actions: AutoActionItem[],
    runtimeState: RuntimeState,
  ) {
    if (!roomId.value) return

    // 使用通用函数过滤有效的定时弹幕操作
    const scheduledActions = filterValidActions(actions, TriggerType.SCHEDULED, isLive)

    // 为每个定时操作设置定时器
    scheduledActions.forEach((action) => {
      // 检查是否已有定时器
      if (runtimeState.scheduledTimers[action.id]) return

      const intervalSeconds = action.triggerConfig.intervalSeconds || 300 // 默认5分钟

      // 创建定时器函数
      const timerFn = () => {
        // 使用通用执行函数处理定时操作
        if (roomId.value) {
          executeActions(
            [action], // 只处理单个操作
            null, // 定时操作没有触发事件
            TriggerType.SCHEDULED,
            roomId.value,
            runtimeState,
            { sendLiveDanmaku },
            {
              skipUserFilters: true, // 定时任务不需要用户过滤
              skipCooldownCheck: false, // 可以保留冷却检查
            },
          )
        }

        // 设置下一次定时
        runtimeState.scheduledTimers[action.id] = setTimeout(timerFn, intervalSeconds * 1000)
        runtimeState.timerStartTimes[action.id] = Date.now() // 更新定时器启动时间
      }

      // 首次启动定时器
      runtimeState.scheduledTimers[action.id] = setTimeout(timerFn, intervalSeconds * 1000)
      runtimeState.timerStartTimes[action.id] = Date.now() // 记录定时器启动时间
    })
  }

  /**
   * 格式化剩余时间为分:秒格式
   */
  const formattedRemainingTime = computed(() => {
    const minutes = Math.floor(remainingSeconds.value / 60)
    const seconds = remainingSeconds.value % 60
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  })

  /**
   * 清理计时器
   */
  function clearTimer() {
    if (timer.value) {
      clearTimeout(timer.value)
      timer.value = null
    }
    if (countdownTimer.value) {
      clearInterval(countdownTimer.value)
      countdownTimer.value = null
    }
  }

  return {
    processScheduledActions,
    clearTimer,
    remainingSeconds,
    formattedRemainingTime,
  }
}
