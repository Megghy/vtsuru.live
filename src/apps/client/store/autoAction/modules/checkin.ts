import type { Ref } from 'vue'
import type { AutoActionItem, RuntimeState } from '../types'
import type { CheckInResult, EventModel } from '@/api/api-models'
import { useIDBKeyval } from '@vueuse/integrations/useIDBKeyval'
import { v4 as uuidv4 } from 'uuid'
import { useAccount } from '@/api/account'
import { EventDataTypes } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import { CHECKIN_API_URL } from '@/shared/config'
import { executeActions } from '../actionUtils'
import { ActionType, KeywordMatchType, Priority, TriggerType } from '../types'
import { buildExecutionContext, createDefaultAutoAction } from '../utils'

// 签到配置接口
export interface CheckInConfig {
  sendReply: boolean // 是否发送签到回复消息
  successAction: AutoActionItem // 使用 AutoActionItem 替代字符串
  cooldownAction: AutoActionItem // 使用 AutoActionItem 替代字符串
  earlyBird: {
    enabled: boolean
    successAction: AutoActionItem // 使用 AutoActionItem 替代字符串
  }
}

// 创建默认配置
function createDefaultCheckInConfig(): CheckInConfig {
  const successAction = createDefaultAutoAction(TriggerType.DANMAKU)
  successAction.name = '签到成功回复'
  successAction.template = '@{{user.name}} 签到成功，获得 {{checkin.points}} 积分，连续签到 {{checkin.consecutiveDays}} 天'

  const cooldownAction = createDefaultAutoAction(TriggerType.DANMAKU)
  cooldownAction.name = '签到冷却回复'
  cooldownAction.template = '{{user.name}} 你今天已经签到过了，明天再来吧~'

  const earlyBirdAction = createDefaultAutoAction(TriggerType.DANMAKU)
  earlyBirdAction.name = '早鸟签到回复'
  earlyBirdAction.template = '恭喜 {{user.name}} 完成早鸟签到！获得 {{checkin.points}} 积分，连续签到 {{checkin.consecutiveDays}} 天！'

  return {
    sendReply: true, // 默认发送回复消息
    successAction,
    cooldownAction,
    earlyBird: {
      enabled: false,
      successAction: earlyBirdAction,
    },
  }
}

/**
 * 签到功能核心逻辑
 */
export function useCheckIn(
  isLive: Ref<boolean>,
  roomId: Ref<number | undefined>,
  liveStartTime: Ref<number | null>,
  isTianXuanActive: Ref<boolean>,
  sendDanmaku: (roomId: number, message: string) => Promise<boolean>,
) {
  // 使用 IndexedDB 持久化存储签到配置
  const { data: checkInConfig, isFinished: isConfigLoaded } = useIDBKeyval<CheckInConfig>(
    'autoAction.checkin.config',
    createDefaultCheckInConfig(),
    {
      onError: (err) => {
        console.error('[CheckIn] IDB 错误 (配置):', err)
      },
    },
  )
  const accountInfo = useAccount()

  // 处理签到弹幕 - 调用服务端API
  async function processCheckIn(
    event: EventModel,
    runtimeState: RuntimeState,
  ) {
    // 确保配置已加载
    if (!isConfigLoaded.value) {
      console.log('[CheckIn] 配置尚未加载完成，跳过处理')
      return
    }

    if (!accountInfo.value.settings.point.enableCheckIn) {
      return
    }

    // 跳过非弹幕事件
    if (event.type !== EventDataTypes.Message) {
      return
    }

    // 检查弹幕内容是否匹配签到指令
    if (event.msg?.trim() !== accountInfo.value.settings.point.checkInKeyword.trim()) {
      return
    }

    const username = event.uname || event.uid || event.open_id || '用户'

    try {
      // 调用服务端API进行签到
      const apiUrl = `${CHECKIN_API_URL}check-in-for`

      // 使用query.ts中的QueryGetAPI替代fetch
      const response = await QueryGetAPI<CheckInResult>(apiUrl, event.uid
        ? {
            uid: event.uid,
            name: username,
          }
        : {
            oId: event.ouid,
            name: username,
          })

      const checkInResult = response.data

      if (checkInResult) {
        if (checkInResult.success) {
          // 签到成功
          if (roomId.value && checkInConfig.value.sendReply) {
            const isEarlyBird = liveStartTime.value && (Date.now() - liveStartTime.value < 30 * 60 * 1000)

            // 构建签到数据上下文
            const checkInData = {
              checkin: {
                points: checkInResult.points,
                consecutiveDays: checkInResult.consecutiveDays,
                todayRank: checkInResult.todayRank,
                time: new Date(),
              },
            }

            // 执行回复动作
            const successContext = buildExecutionContext(event, roomId.value, TriggerType.DANMAKU, checkInData)
            const action = isEarlyBird && checkInConfig.value.earlyBird.enabled
              ? checkInConfig.value.earlyBird.successAction
              : checkInConfig.value.successAction

            executeActions(
              [action],
              event,
              TriggerType.DANMAKU,
              roomId.value,
              runtimeState,
              { sendLiveDanmaku: sendDanmaku },
              {
                customContextBuilder: () => successContext,
              },
            )
          }

          // 显示签到成功通知
          window.$notification.success({
            title: '签到成功',
            description: `${username} 完成签到, 获得 ${checkInResult.points} 积分, 连续签到 ${checkInResult.consecutiveDays} 天`,
            duration: 5000,
          })
        } else {
          // 签到失败 - 今天已经签到过
          if (roomId.value && checkInConfig.value.sendReply) {
            const cooldownContext = buildExecutionContext(event, roomId.value, TriggerType.DANMAKU)

            executeActions(
              [checkInConfig.value.cooldownAction],
              event,
              TriggerType.DANMAKU,
              roomId.value,
              runtimeState,
              { sendLiveDanmaku: sendDanmaku },
              {
                customContextBuilder: () => cooldownContext,
              },
            )
          }

          // 显示签到失败通知
          window.$notification.info({
            title: '签到提示',
            description: checkInResult.message || `${username} 重复签到, 已忽略`,
            duration: 5000,
          })
        }
      }
    } catch (error) {
      console.error('[CheckIn] 处理签到失败:', error)
      window.$notification.error({
        title: '签到错误',
        description: `签到请求失败：${error instanceof Error ? error.message : String(error)}`,
        duration: 5000,
      })
    }
  }

  return {
    checkInConfig,
    processCheckIn,
  }
}

/**
 * 创建默认的签到相关 AutoActionItem 配置
 * 这些配置可以在管理界面中显示和编辑
 */
export function createCheckInAutoActions(): AutoActionItem[] {
  return [
    // 普通签到成功响应
    {
      id: uuidv4(),
      name: '签到成功响应',
      enabled: true,
      triggerType: TriggerType.DANMAKU,
      actionType: ActionType.SEND_DANMAKU,
      template: '@{{user.name}} 签到成功，获得 {{checkin.points}} 积分',
      priority: Priority.NORMAL,
      logicalExpression: '',
      ignoreCooldown: false,
      executeCommand: '',
      triggerConfig: {
        keywords: ['签到'],
        keywordMatchType: KeywordMatchType.Full,
      },
      actionConfig: {
        cooldownSeconds: 86400, // 24小时，确保每天只能签到一次
      },
    },
    // 早鸟签到成功响应
    {
      id: uuidv4(),
      name: '早鸟签到成功响应',
      enabled: true,
      triggerType: TriggerType.DANMAKU,
      actionType: ActionType.SEND_DANMAKU,
      template: '@{{user.name}} 早鸟签到成功，获得 {{checkin.points}} 积分',
      priority: Priority.HIGH,
      logicalExpression: '',
      ignoreCooldown: false,
      executeCommand: '',
      triggerConfig: {
        keywords: ['签到'],
        keywordMatchType: KeywordMatchType.Full,
      },
      actionConfig: {
        cooldownSeconds: 86400, // 24小时
      },
    },
    // 签到冷却期提示
    {
      id: uuidv4(),
      name: '签到冷却提示',
      enabled: true,
      triggerType: TriggerType.DANMAKU,
      actionType: ActionType.SEND_DANMAKU,
      template: '@{{user.name}} 你今天已经签到过了，明天再来吧~',
      priority: Priority.LOW,
      logicalExpression: '',
      ignoreCooldown: true,
      executeCommand: '',
      triggerConfig: {
        keywords: ['签到'],
        keywordMatchType: KeywordMatchType.Full,
      },
      actionConfig: {},
    },
  ]
}
