import type { Ref } from 'vue'
import type {
  AutoActionItem,
  ExecutionContext,
  RuntimeState,
  TriggerType,
} from './types'
import type { EventModel } from '@/api/api-models'
import { useBiliCookie } from '../useBiliCookie'
import { evaluateTemplateExpressions } from './expressionEvaluator'
import {
  ActionType,
} from './types'
import { buildExecutionContext, evaluateExpression, getRandomTemplate } from './utils'
import { logCommandHistory, logDanmakuHistory, logPrivateMsgHistory } from './utils/historyLogger'

/**
 * 过滤有效的自动操作项
 * @param actions 所有操作项列表
 * @param triggerType 触发类型
 * @param isLive 是否直播中
 * @param isTianXuanActive 是否天选时刻激活
 * @param options 额外过滤选项
 * @param options.actionType 特定操作类型
 * @param options.customFilter 自定义过滤器
 * @param options.enabledTriggerTypes 触发类型启用状态
 * @returns 过滤后的操作项
 */
export function filterValidActions(
  actions: AutoActionItem[],
  triggerType: TriggerType,
  isLive: Ref<boolean>,
  isTianXuanActive?: Ref<boolean>,
  options?: {
    actionType?: ActionType // 特定操作类型
    customFilter?: (action: AutoActionItem) => boolean // 自定义过滤器
    enabledTriggerTypes?: Ref<Record<TriggerType, boolean>> // 触发类型启用状态
  },
): AutoActionItem[] {
  return actions.filter((action) => {
    // 基本过滤条件
    if (action.triggerType !== triggerType || !action.enabled) {
      return false
    }

    // 检查触发类型是否启用
    if (options?.enabledTriggerTypes && !options.enabledTriggerTypes.value[triggerType]) {
      return false
    }

    // 直播状态过滤
    if (action.triggerConfig.onlyDuringLive && !isLive.value) {
      return false
    }

    // 天选时刻过滤
    if (isTianXuanActive && action.triggerConfig.ignoreTianXuan && isTianXuanActive.value) {
      return false
    }

    // 操作类型过滤
    if (options?.actionType && action.actionType !== options.actionType) {
      return false
    }

    // 自定义过滤器
    if (options?.customFilter && !options.customFilter(action)) {
      return false
    }

    return true
  })
}

/**
 * 检查用户是否满足过滤条件
 * @param action 操作项
 * @param event 事件数据
 * @returns 是否满足条件
 */
export function checkUserFilters(action: AutoActionItem, event: EventModel): boolean {
  if (!action.triggerConfig.userFilterEnabled) {
    return true
  }

  if (action.triggerConfig.requireMedal && !event.fans_medal_wearing_status) {
    return false
  }

  if (action.triggerConfig.requireCaptain && !event.guard_level) {
    return false
  }

  return true
}

/**
 * 检查冷却时间
 * @param action 操作项
 * @param runtimeState 运行时状态
 * @returns 是否可以执行（已过冷却期）
 */
export function checkCooldown(action: AutoActionItem, runtimeState: RuntimeState): boolean {
  if (action.ignoreCooldown) {
    return true
  }

  const now = Date.now()
  const lastExecTime = runtimeState.lastExecutionTime[action.id] || 0
  const cooldownMs = (action.actionConfig.cooldownSeconds || 0) * 1000

  return now - lastExecTime >= cooldownMs
}

/**
 * 处理模板并返回格式化后的内容
 * @param action 操作项
 * @param context 执行上下文
 * @param options 可选配置
 * @param options.useRandomTemplate 是否随机选择模板 (默认 true)
 * @param options.defaultValue 模板为空或处理失败时的默认值
 * @returns 格式化后的内容，如果没有有效模板则返回null
 */
export function processTemplate(
  action: AutoActionItem,
  context: ExecutionContext,
  options?: {
    useRandomTemplate?: boolean // 是否随机选择模板，默认true
    defaultValue?: string // 如果模板为空或格式化失败时的默认值
  },
): string | null {
  if (!action.template || action.template.trim() === '') {
    console.warn(`跳过操作 "${action.name || '未命名'}"：未设置有效模板`)
    return options?.defaultValue || null
  }

  try {
    // 获取模板内容
    let template: string
    if (options?.useRandomTemplate !== false) {
      // 使用随机模板 (默认行为)
      const randomTemplate = getRandomTemplate(action.template)
      if (!randomTemplate) {
        return options?.defaultValue || null
      }
      template = randomTemplate
    } else {
      // 使用整个模板字符串
      template = action.template
    }

    // 格式化模板
    const formattedContent = evaluateTemplateExpressions(template, context)
    return formattedContent
  } catch (error) {
    console.error(`模板处理错误 (${action.name || action.id}):`, error)
    return options?.defaultValue || null
  }
}

// 辅助函数：发送弹幕并记录日志
async function sendAndLogDanmaku(
  sendHandler: (roomId: number, message: string) => Promise<boolean>,
  action: AutoActionItem,
  roomId: number,
  message: string,
): Promise<boolean> {
  try {
    const success = await sendHandler(roomId, message)
    logDanmakuHistory(
      action.id,
      action.name || '未命名操作',
      message,
      roomId,
      success,
      success ? undefined : '发送失败',
    ).catch(err => console.error('记录弹幕历史失败:', err))
    return success
  } catch (err) {
    console.error(`[AutoAction] 发送弹幕失败 (${action.name || action.id}):`, err)
    logDanmakuHistory(
      action.id,
      action.name || '未命名操作',
      message,
      roomId,
      false,
      err instanceof Error ? err.toString() : String(err), // 确保err是字符串
    ).catch(e => console.error('记录弹幕历史失败:', e))
    return false
  }
}

/**
 * 执行操作的通用函数
 * @param actions 过滤后的操作列表
 * @param event 触发事件
 * @param triggerType 触发类型
 * @param roomId 房间ID
 * @param runtimeState 运行时状态
 * @param handlers 操作处理器
 * @param handlers.sendLiveDanmaku 发送弹幕处理器
 * @param handlers.sendPrivateMessage 发送私信处理器
 * @param options 额外选项
 * @param options.customContextBuilder 自定义上下文构建器
 * @param options.customFilters 自定义过滤器列表
 * @param options.skipUserFilters 是否跳过用户过滤
 * @param options.skipCooldownCheck 是否跳过冷却检查
 * @param options.onSuccess 操作成功回调
 */
export function executeActions(
  actions: AutoActionItem[],
  event: EventModel | null,
  triggerType: TriggerType,
  roomId: number,
  runtimeState: RuntimeState,
  handlers: {
    sendLiveDanmaku?: (roomId: number, message: string) => Promise<boolean>
    sendPrivateMessage?: (userId: number, message: string) => Promise<boolean>
    // 可以扩展其他类型的发送处理器
  },
  options?: {
    customContextBuilder?: (event: EventModel | null, roomId: number, triggerType: TriggerType) => ExecutionContext
    customFilters?: Array<(action: AutoActionItem, context: ExecutionContext) => boolean>
    skipUserFilters?: boolean
    skipCooldownCheck?: boolean
    onSuccess?: (action: AutoActionItem, context: ExecutionContext) => void
  },
) {
  if (!roomId || actions.length === 0) return
  const biliCookie = useBiliCookie()
  // 对每个操作进行处理
  for (const action of actions) {
    // 构建执行上下文
    const context = options?.customContextBuilder
      ? options.customContextBuilder(event, roomId, triggerType)
      : buildExecutionContext(event, roomId, triggerType)

    // 应用自定义过滤器
    if (options?.customFilters) {
      const passesAllFilters = options.customFilters.every(filter => filter(action, context))
      if (!passesAllFilters) continue
    }

    // 检查用户过滤条件
    if (!options?.skipUserFilters && event && !checkUserFilters(action, event)) {
      continue
    }

    // 检查逻辑表达式
    if (action.logicalExpression && event) {
      if (!evaluateExpression(action.logicalExpression, context)) {
        continue
      }
    }

    // 检查冷却时间
    if (!options?.skipCooldownCheck && !checkCooldown(action, runtimeState)) {
      continue
    }

    // 根据操作类型执行不同的处理逻辑
    switch (action.actionType) {
      case ActionType.SEND_DANMAKU:
        if (!biliCookie.isCookieValid) {
          continue // 如果未登录，则跳过
        }
        if (handlers.sendLiveDanmaku) {
          // 处理弹幕发送
          const message = processTemplate(action, context)
          if (message) {
            // 更新冷却时间
            runtimeState.lastExecutionTime[action.id] = Date.now()

            const sendAction = async () => sendAndLogDanmaku(handlers.sendLiveDanmaku, action, roomId, message)

            // 延迟发送
            if (action.actionConfig.delaySeconds && action.actionConfig.delaySeconds > 0) {
              setTimeout(sendAction, action.actionConfig.delaySeconds * 1000)
            } else {
              sendAction()
            }
          }
        } else {
          console.warn(`[AutoAction] 未提供弹幕发送处理器，无法执行操作: ${action.name || action.id}`)
        }
        break

      case ActionType.SEND_PRIVATE_MSG:
        if (!biliCookie.isCookieValid) {
          continue // 如果未登录，则跳过
        }
        if (handlers.sendPrivateMessage && event && event.uid) {
          // 处理私信发送
          const message = processTemplate(action, context)
          if (message) {
            // 更新冷却时间（私信也可以有冷却时间）
            runtimeState.lastExecutionTime[action.id] = Date.now()

            const sendPmPromise = async (uid: number, msg: string) => {
              return handlers.sendPrivateMessage(uid, msg)
                .then((success) => {
                  // 记录私信发送历史
                  logPrivateMsgHistory(
                    action.id,
                    action.name || '未命名操作',
                    msg,
                    uid,
                    success,
                    success ? undefined : '发送失败',
                  ).catch(err => console.error('记录私信历史失败:', err))

                  if (success && options?.onSuccess) {
                    // 发送成功后调用 onSuccess 回调
                    options.onSuccess(action, context)
                  }
                  return success
                })
                .catch((err) => {
                  console.error(`[AutoAction] 发送私信失败 (${action.name || action.id}):`, err)
                  // 记录失败的发送
                  logPrivateMsgHistory(
                    action.id,
                    action.name || '未命名操作',
                    msg,
                    uid,
                    false,
                    err instanceof Error ? err.toString() : String(err), // 确保err是字符串
                  ).catch(e => console.error('记录私信历史失败:', e))
                  return false // 明确返回 false 表示失败
                })
            }

            // 私信通常不需要延迟，但我们也可以支持
            if (action.actionConfig.delaySeconds && action.actionConfig.delaySeconds > 0) {
              setTimeout(() => {
                sendPmPromise(event.uid, message)
              }, action.actionConfig.delaySeconds * 1000)
            } else {
              sendPmPromise(event.uid, message)
            }
          }
        } else {
          console.warn(`[AutoAction] 未提供私信发送处理器或事件缺少UID，无法执行操作: ${action.name || action.id}`)
        }
        break

      case ActionType.EXECUTE_COMMAND: {
        // 执行自定义命令
        const command = processTemplate(action, context)
        if (command) {
          // 更新冷却时间
          runtimeState.lastExecutionTime[action.id] = Date.now()

          // 目前只记录执行历史，具体实现可在未来扩展
          logCommandHistory(
            action.id,
            action.name || '未命名操作',
            command,
            true,
          ).catch(err => console.error('记录命令执行历史失败:', err))

          console.warn(`[AutoAction] 暂不支持执行自定义命令: ${action.name || action.id}`)
        }
        break
      }

      default:
        console.warn(`[AutoAction] 未知的操作类型: ${action.actionType}`)
    }
  }
}
