import type { Ref } from 'vue'
import type { AutoActionItem, RuntimeState } from '../types'
import type { DanmakuModel, EventModel } from '@/api/api-models'
import { useIDBKeyval } from '@vueuse/integrations/useIDBKeyval'
import { v4 as uuidv4 } from 'uuid'
import { EventDataTypes } from '@/api/api-models'
import { executeActions } from '../actionUtils'
import { ActionType, KeywordMatchType, Priority, TriggerType } from '../types'
import { buildExecutionContext, createDefaultAutoAction } from '../utils'

export interface CheckInHubEvent {
  Status?: number | string
  status?: number | string
  Success?: boolean
  success?: boolean
  IsDuplicate?: boolean
  isDuplicate?: boolean
  Message?: string
  message?: string
  Points?: number
  points?: number
  ConsecutiveDays?: number
  consecutiveDays?: number
  TodayRank?: number
  todayRank?: number
  Event?: DanmakuModel
  event?: DanmakuModel
  Timestamp?: number
  timestamp?: number
}

const CHECK_IN_STATUS_DUPLICATE = 1

export interface CheckInConfig {
  sendReply: boolean
  successAction: AutoActionItem
  cooldownAction: AutoActionItem
  earlyBird: {
    enabled: boolean
    successAction: AutoActionItem
  }
}

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
    sendReply: true,
    successAction,
    cooldownAction,
    earlyBird: {
      enabled: false,
      successAction: earlyBirdAction,
    },
  }
}

function field<T>(source: Record<string, unknown>, ...names: string[]): T | undefined {
  for (const name of names) {
    const value = source[name]
    if (value !== undefined && value !== null) {
      return value as T
    }
  }
}

function normalizeEvent(source: DanmakuModel | EventModel | undefined): EventModel | null {
  if (!source) {
    return null
  }

  const event = source as unknown as Record<string, unknown>
  return {
    type: field<EventDataTypes>(event, 'type', 'Type') ?? EventDataTypes.Message,
    uname: field<string>(event, 'uname', 'uName', 'UName') ?? '',
    uface: field<string>(event, 'uface', 'uFace', 'UFace') ?? '',
    uid: field<number>(event, 'uid', 'uId', 'UId') ?? 0,
    open_id: field<string>(event, 'open_id', 'openId', 'OpenId', 'oId', 'OId') ?? '',
    msg: field<string>(event, 'msg', 'Msg') ?? '',
    time: field<number>(event, 'time', 'Time') ?? Date.now(),
    num: field<number>(event, 'num', 'Num') ?? 1,
    price: field<number>(event, 'price', 'Price') ?? 0,
    guard_level: field(event, 'guard_level', 'guardLevel', 'GuardLevel') ?? 0,
    fans_medal_level: field(event, 'fans_medal_level', 'fansMedalLevel', 'FansMedalLevel') ?? 0,
    fans_medal_name: field(event, 'fans_medal_name', 'fansMedalName', 'FansMedalName') ?? '',
    fans_medal_wearing_status: field(event, 'fans_medal_wearing_status', 'fansMedalWearingStatus', 'FansMedalWearingStatus') ?? false,
    emoji: field<string>(event, 'emoji', 'Emoji'),
    ouid: field<string>(event, 'ouid', 'ouId', 'OUId') ?? '',
  } as EventModel
}

function isDuplicateStatus(payload: CheckInHubEvent) {
  const duplicate = payload.IsDuplicate ?? payload.isDuplicate
  if (duplicate !== undefined) {
    return duplicate
  }

  const status = payload.Status ?? payload.status
  return status === CHECK_IN_STATUS_DUPLICATE || status === 'Duplicate'
}

export function useCheckIn(
  isLive: Ref<boolean>,
  roomId: Ref<number | undefined>,
  liveStartTime: Ref<number | null>,
  _isTianXuanActive: Ref<boolean>,
  sendDanmaku: (roomId: number, message: string) => Promise<boolean>,
) {
  const { data: checkInConfig, isFinished: isConfigLoaded } = useIDBKeyval<CheckInConfig>(
    'autoAction.checkin.config',
    createDefaultCheckInConfig(),
    {
      onError: (err) => {
        console.error('[CheckIn] IDB 错误 (配置):', err)
      },
    },
  )

  function processCheckInResult(payload: CheckInHubEvent, runtimeState: RuntimeState) {
    if (!isConfigLoaded.value || !checkInConfig.value.sendReply || !roomId.value) {
      return
    }

    const event = normalizeEvent(payload.Event ?? payload.event)
    if (!event) {
      console.warn('[CheckIn] 签到结果缺少弹幕事件，跳过回复')
      return
    }

    const success = payload.Success ?? payload.success ?? false
    const duplicate = isDuplicateStatus(payload)
    const action = success
      ? liveStartTime.value && isLive.value && Date.now() - liveStartTime.value < 30 * 60 * 1000 && checkInConfig.value.earlyBird.enabled
        ? checkInConfig.value.earlyBird.successAction
        : checkInConfig.value.successAction
      : duplicate
        ? checkInConfig.value.cooldownAction
        : null

    if (!action) {
      const message = payload.Message ?? payload.message ?? '签到失败'
      console.warn(`[CheckIn] ${event.uname || event.uid || event.ouid} 签到未触发回复: ${message}`)
      return
    }

    const checkInContext = buildExecutionContext(event, roomId.value, TriggerType.DANMAKU, {
      checkin: {
        points: payload.Points ?? payload.points ?? 0,
        consecutiveDays: payload.ConsecutiveDays ?? payload.consecutiveDays ?? 0,
        todayRank: payload.TodayRank ?? payload.todayRank ?? 0,
        time: new Date(payload.Timestamp ?? payload.timestamp ?? Date.now()),
      },
    })

    executeActions(
      [action],
      event,
      TriggerType.DANMAKU,
      roomId.value,
      runtimeState,
      { sendLiveDanmaku: sendDanmaku },
      {
        customContextBuilder: () => checkInContext,
        skipUserFilters: true,
      },
    )
  }

  return {
    checkInConfig,
    processCheckInResult,
  }
}

export function createCheckInAutoActions(): AutoActionItem[] {
  return [
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
        cooldownSeconds: 86400,
      },
    },
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
        cooldownSeconds: 86400,
      },
    },
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
