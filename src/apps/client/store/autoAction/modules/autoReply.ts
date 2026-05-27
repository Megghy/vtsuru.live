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
  KeywordMatchType,
  TriggerType,
} from '../types'


/**
 * 自动回复模块
 * @param isLive 是否处于直播状态
 * @param roomId 房间ID
 * @param sendLiveDanmaku 发送弹幕函数
 */
export function useAutoReply(
  isLive: Ref<boolean>,
  roomId: Ref<number | undefined>,
  sendLiveDanmaku: (roomId: number, message: string) => Promise<boolean>,
) {
  /**
   * 检查关键词匹配
   * @param text 要检查的文本
   * @param keyword 关键词
   * @param matchType 匹配类型
   * @returns 是否匹配
   */
  function isKeywordMatch(text: string, keyword: string, matchType: KeywordMatchType = KeywordMatchType.Contains): boolean {
    switch (matchType) {
      case KeywordMatchType.Full:
        return text === keyword
      case KeywordMatchType.Contains:
        return text.includes(keyword)
      case KeywordMatchType.Regex:
        try {
          const regex = new RegExp(keyword)
          return regex.test(text)
        } catch (e) {
          console.warn('无效的正则表达式:', keyword, e)
          return false
        }
      default:
        return text.includes(keyword) // 默认使用包含匹配
    }
  }

  /**
   * 处理弹幕事件
   * @param event 弹幕事件
   * @param actions 自动操作列表
   * @param runtimeState 运行时状态
   */
  function onDanmaku(
    event: EventModel,
    actions: AutoActionItem[],
    runtimeState: RuntimeState,
  ) {
    if (!roomId.value) return

    // 使用通用函数过滤有效的自动回复操作
    const replyActions = filterValidActions(actions, TriggerType.DANMAKU, isLive)

    if (replyActions.length > 0 && roomId.value) {
      const message = event.msg

      executeActions(
        replyActions,
        event,
        TriggerType.DANMAKU,
        roomId.value,
        runtimeState,
        { sendLiveDanmaku },
        {
          customFilters: [
            // 关键词和屏蔽词检查
            (action, _context) => {
              const keywordMatchType = action.triggerConfig.keywordMatchType || KeywordMatchType.Contains
              const keywordMatch = action.triggerConfig.keywords?.some(kw =>
                isKeywordMatch(message, kw, keywordMatchType),
              )
              if (!keywordMatch) return false

              const blockwordMatchType = action.triggerConfig.blockwordMatchType || KeywordMatchType.Contains
              const blockwordMatch = action.triggerConfig.blockwords?.some(bw =>
                isKeywordMatch(message, bw, blockwordMatchType),
              )
              return !blockwordMatch // 如果匹配屏蔽词返回false，否则返回true
            },
          ],

        },
      )
    }
  }

  // 重置冷却时间 (用于测试)
  function resetCooldowns(runtimeState: RuntimeState, actionId?: string) {
    if (actionId) {
      delete runtimeState.lastExecutionTime[actionId]
    } else {
      Object.keys(runtimeState.lastExecutionTime).forEach((id) => {
        delete runtimeState.lastExecutionTime[id]
      })
    }
  }

  return {
    onDanmaku,
    resetCooldowns,
  }
}
