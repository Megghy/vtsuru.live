import type { Ref } from 'vue'
import { computed } from 'vue'

import { executeActions, filterValidActions } from '../actionUtils'
import type { AutoActionItem, ExecutionContext, RuntimeState } from '../types'
import { ActionType, TriggerType } from '../types'
import { buildExecutionContext } from '../utils'

export function matchesGuardTrigger(action: AutoActionItem, event: { guard_level?: number } | null): boolean {
  const levels = action.triggerConfig.guardLevels
  if (!levels || levels.length === 0) return true
  const level = event?.guard_level
  return level !== undefined && levels.includes(level)
}

export function pickGuardGiftCode(
  action: AutoActionItem,
  guardLevel: number | undefined,
): { code: string; level: number } | null {
  const giftCodes = action.triggerConfig.giftCodes
  if (!giftCodes || giftCodes.length === 0 || guardLevel === undefined) return null

  const entry = giftCodes.find((gc) => gc.level === guardLevel) ?? giftCodes.find((gc) => gc.level === 0)
  if (!entry || !entry.codes || entry.codes.length === 0) return null

  const randomIndex = Math.floor(Math.random() * entry.codes.length)
  return { code: entry.codes[randomIndex], level: entry.level }
}

/**
 * 舰长私信模块
 * @param roomId 房间ID
 * @param sendPrivateMessage 发送私信函数
 * @param sendLiveDanmaku 发送弹幕函数
 */
export function useGuardPm(
  roomId: Ref<number | undefined>,
  sendPrivateMessage: (uid: number, message: string) => Promise<boolean>,
  sendLiveDanmaku: (roomId: number, message: string) => Promise<boolean>,
) {
  /**
   * 处理舰长购买事件
   * @param actions 自动操作列表
   * @param event 舰长购买事件
   * @param runtimeState 运行时状态
   */
  function handleGuardBuy(actions: AutoActionItem[], event: any, runtimeState: RuntimeState, isTest = false) {
    if (!roomId.value) return

    // 使用通用函数过滤舰长事件的操作
    const isLiveRef = computed(() => true)
    const guardActions = filterValidActions(actions, TriggerType.GUARD, isLiveRef, undefined, { isTest })

    // 使用通用执行函数处理舰长事件
    if (guardActions.length > 0 && roomId.value) {
      executeActions(
        guardActions,
        event,
        TriggerType.GUARD,
        roomId.value,
        runtimeState,
        { sendPrivateMessage, sendLiveDanmaku },
        {
          isTest,
          customFilters: [(action) => matchesGuardTrigger(action, event)],
          customContextBuilder: (eventData, contextRoomId, triggerType, action): ExecutionContext => {
            const context = buildExecutionContext(eventData, contextRoomId, triggerType)
            if (triggerType === TriggerType.GUARD && eventData && context.variables.guard) {
              const picked = pickGuardGiftCode(action, eventData.guard_level)
              if (picked) {
                context.variables.guard.giftCode = picked.code
                context.variables.guard.selectedGiftCode = picked
              }
            }
            return context
          },
          onSuccess: (action: AutoActionItem, context: ExecutionContext) => {
            if (isTest) return
            // 检查是否需要消耗礼品码
            if (
              action.actionType === ActionType.SEND_PRIVATE_MSG &&
              action.triggerConfig.consumeGiftCode &&
              context.variables.guard?.selectedGiftCode
            ) {
              const { code: selectedCode, level: selectedLevel } = context.variables.guard.selectedGiftCode

              if (Array.isArray(action.triggerConfig.giftCodes)) {
                const levelCodesEntry = action.triggerConfig.giftCodes.find((gc) => gc.level === selectedLevel)
                if (levelCodesEntry && Array.isArray(levelCodesEntry.codes)) {
                  const codeIndex = levelCodesEntry.codes.indexOf(selectedCode)
                  if (codeIndex > -1) {
                    levelCodesEntry.codes.splice(codeIndex, 1)
                    console.log(
                      `[AutoAction] 成功消耗礼品码: ActionID=${action.id}, Level=${selectedLevel}, Code=${selectedCode}. 剩余 ${levelCodesEntry.codes.length} 个。`,
                    )
                  }
                }
              }
            }
          },
        },
      )
    }
  }

  return {
    handleGuardBuy,
  }
}
