import type {
  AutoActionItem,
  RuntimeState
} from './autoAction/types.js'
import type { EventModel } from '@/api/api-models.js'
import { useIDBKeyval } from '@vueuse/integrations/useIDBKeyval'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useAccount } from '@/api/account.js'
import { EventDataTypes } from '@/api/api-models.js'
import { isDev } from '@/data/constants.js'
import { useDanmakuClient } from '@/store/useDanmakuClient.js'
import { usePointStore } from '@/store/usePointStore'
import { evaluateTemplateExpressions } from './autoAction/expressionEvaluator'

import { useAutoReply } from './autoAction/modules/autoReply'
import { useCheckIn } from './autoAction/modules/checkin'
import { useEntryWelcome } from './autoAction/modules/entryWelcome'
import { useFollowThank } from './autoAction/modules/followThank'
import { useGiftThank } from './autoAction/modules/giftThank'
import { useGuardPm } from './autoAction/modules/guardPm'
import { useScheduledDanmaku } from './autoAction/modules/scheduledDanmaku'
import { useSuperChatThank } from './autoAction/modules/superChatThank'
import {
  ActionType,

  KeywordMatchType,
  Priority,
  TriggerType,
} from './autoAction/types.js'
import {
  buildExecutionContext,
  createDefaultAutoAction,
  createDefaultRuntimeState,
  getRandomTemplate,
} from './autoAction/utils'
import { useBiliFunction } from './useBiliFunction.js'

export const useAutoAction = defineStore('autoAction', () => {
  const danmakuClient = useDanmakuClient()
  const biliFunc = useBiliFunction()
  const account = useAccount()
  const pointStore = usePointStore()

  // 共享状态
  const isLive = computed(() => account.value.streamerInfo?.isStreaming ?? false)
  const roomId = computed(() => isDev ? 1294406 : account.value.streamerInfo?.roomId)
  const isTianXuanActive = ref(false)
  const liveStartTime = ref<number | null>(null)

  // 存储自动操作项
  const { data: autoActions, isFinished: isActionsLoaded } = useIDBKeyval<AutoActionItem[]>('autoAction.items', [], {
    onError: (err) => {
      console.error('[AutoAction] IDB 错误 (项目):', err)
    },
  })

  // 运行时状态
  const runtimeState = ref<RuntimeState>(createDefaultRuntimeState())

  // 触发类型启用状态
  const { data: enabledTriggerTypes, isFinished: isTriggersLoaded } = useIDBKeyval<Record<TriggerType, boolean>>('autoAction.enabledTriggers', {
    [TriggerType.DANMAKU]: true,
    [TriggerType.GIFT]: true,
    [TriggerType.GUARD]: true,
    [TriggerType.FOLLOW]: true,
    [TriggerType.ENTER]: true,
    [TriggerType.SCHEDULED]: true,
    [TriggerType.SUPER_CHAT]: true,
  }, {
    onError: err => console.error('[AutoAction] IDB 错误 (触发类型):', err),
  })

  /**
   * 设置触发类型启用状态
   */
  function setTriggerTypeEnabled(triggerType: TriggerType, enabled: boolean) {
    if (enabledTriggerTypes.value) {
      enabledTriggerTypes.value[triggerType] = enabled

      if (triggerType === TriggerType.SCHEDULED) {
        if (enabled) {
          startIndividualScheduledActions()
          startGlobalTimer()
        } else {
          stopAllIndividualScheduledActions()
        }
      }
    }
  }

  // 全局定时器设置
  const { data: globalIntervalSeconds, isFinished: isIntervalLoaded } = useIDBKeyval<number>('autoAction.globalInterval', 300, {
    onError: err => console.error('[AutoAction] IDB 错误 (间隔):', err),
  })
  const { data: globalSchedulingMode, isFinished: isModeLoaded } = useIDBKeyval<'random' | 'sequential'>('autoAction.globalMode', 'random', {
    onError: err => console.error('[AutoAction] IDB 错误 (模式):', err),
  })
  const { data: lastGlobalActionIndex, isFinished: isIndexLoaded } = useIDBKeyval<number>('autoAction.lastGlobalIndex', -1, {
    onError: err => console.error('[AutoAction] IDB 错误 (上次索引):', err),
  })

  const globalTimer = ref<any | null>(null)

  /**
   * 全局定时器触发处理函数
   */
  function handleGlobalTimerTick() {
    if (!roomId.value || !isActionsLoaded.value) {
      console.warn('[AutoAction] 全局定时器触发跳过: 房间ID或操作项未就绪.')
      return
    }
    if (!enabledTriggerTypes.value || !enabledTriggerTypes.value[TriggerType.SCHEDULED]) {
      console.log('[AutoAction] 全局定时器触发跳过: 定时任务类型已禁用.')
      return
    }

    const eligibleActions = autoActions.value.filter(action =>
      action.triggerType === TriggerType.SCHEDULED
      && action.enabled
      && action.triggerConfig.useGlobalTimer
      && (!action.triggerConfig.onlyDuringLive || isLive.value)
      && (!action.triggerConfig.ignoreTianXuan || !isTianXuanActive.value),
    )

    if (eligibleActions.length > 0) {
      let actionToExecute: AutoActionItem | null = null
      if (globalSchedulingMode.value === 'random') {
        const randomIndex = Math.floor(Math.random() * eligibleActions.length)
        actionToExecute = eligibleActions[randomIndex]
      } else {
        lastGlobalActionIndex.value = (lastGlobalActionIndex.value + 1) % eligibleActions.length
        actionToExecute = eligibleActions[lastGlobalActionIndex.value]
      }

      if (actionToExecute) {
        const context = buildExecutionContext(null, roomId.value, TriggerType.SCHEDULED)
        const template = getRandomTemplate(actionToExecute.template)
        if (template && roomId.value) {
          const formattedContent = evaluateTemplateExpressions(template, context)
          runtimeState.value.lastExecutionTime[actionToExecute.id] = Date.now()
          if (actionToExecute.actionConfig.delaySeconds && actionToExecute.actionConfig.delaySeconds > 0) {
            setTimeout(() => {
              biliFunc.sendLiveDanmaku(roomId.value!, formattedContent).catch(err => console.error('[AutoAction] 发送弹幕失败:', err))
            }, actionToExecute.actionConfig.delaySeconds * 1000)
          } else {
            biliFunc.sendLiveDanmaku(roomId.value, formattedContent).catch(err => console.error('[AutoAction] 发送弹幕失败:', err))
          }
        }
      }
    } else {
      console.log('[AutoAction] 当前没有符合条件的全局定时任务可执行，跳过本次执行。')
    }

    const intervalMs = globalIntervalSeconds.value * 1000
    if (intervalMs > 0) {
      if (globalTimer.value) {
        clearTimeout(globalTimer.value)
      }
      globalTimer.value = setTimeout(handleGlobalTimerTick, intervalMs)
      runtimeState.value.globalTimerStartTime = Date.now()
    } else {
      console.warn('[AutoAction] 全局定时器间隔无效，无法安排下一次触发。')
    }
  }

  /**
   * 启动全局定时器
   */
  function startGlobalTimer() {
    if (globalTimer.value || !isActionsLoaded.value) return
    if (!enabledTriggerTypes.value || !enabledTriggerTypes.value[TriggerType.SCHEDULED]) return

    const needsGlobalTimer = autoActions.value.some(action =>
      action.triggerType === TriggerType.SCHEDULED
      && action.triggerConfig.useGlobalTimer,
    )

    if (needsGlobalTimer && globalIntervalSeconds.value > 0) {
      const intervalMs = globalIntervalSeconds.value * 1000
      if (globalTimer.value) clearTimeout(globalTimer.value)
      globalTimer.value = setTimeout(handleGlobalTimerTick, intervalMs)
      runtimeState.value.globalTimerStartTime = Date.now()
    } else {
      stopGlobalTimer()
    }
  }

  /**
   * 停止全局定时器
   */
  function stopGlobalTimer() {
    if (globalTimer.value) {
      console.log('[AutoAction] 停止全局定时器.')
      clearTimeout(globalTimer.value)
      globalTimer.value = null
      lastGlobalActionIndex.value = -1
      runtimeState.value.globalTimerStartTime = null
    }
  }

  /**
   * 重启全局定时器
   */
  function restartGlobalTimer() {
    stopGlobalTimer()
    if (isActionsLoaded.value) {
      startGlobalTimer()
    }
  }

  /**
   * 停止指定的独立定时器
   */
  function stopIndividualTimer(actionId: string) {
    const timer = runtimeState.value.scheduledTimers[actionId]
    if (timer) {
      clearTimeout(timer)
      delete runtimeState.value.scheduledTimers[actionId]
      delete runtimeState.value.timerStartTimes[actionId]
    }
  }

  /**
   * 为指定的独立定时任务启动定时器
   */
  function startIndividualTimer(action: AutoActionItem) {
    if (runtimeState.value.scheduledTimers[action.id] || !action.enabled || action.triggerConfig.useGlobalTimer) return

    const intervalSeconds = action.triggerConfig.intervalSeconds || 300
    if (intervalSeconds <= 0) return

    const intervalMs = intervalSeconds * 1000

    const timerFunc = () => {
      const currentAction = autoActions.value.find(a => a.id === action.id)
      if (!currentAction) {
        stopIndividualTimer(action.id)
        return
      }
      const shouldExecute = currentAction.enabled
        && !currentAction.triggerConfig.useGlobalTimer
        && (!currentAction.triggerConfig.onlyDuringLive || isLive.value)
        && (!currentAction.triggerConfig.ignoreTianXuan || !isTianXuanActive.value)

      if (shouldExecute) {
        const context = buildExecutionContext(null, roomId.value, TriggerType.SCHEDULED)
        const template = getRandomTemplate(currentAction.template)
        if (template && roomId.value) {
          const formattedContent = evaluateTemplateExpressions(template, context)
          runtimeState.value.lastExecutionTime[currentAction.id] = Date.now()
          if (currentAction.actionConfig.delaySeconds && currentAction.actionConfig.delaySeconds > 0) {
            setTimeout(() => {
              biliFunc.sendLiveDanmaku(roomId.value!, formattedContent).catch(err => console.error('[AutoAction] 发送弹幕失败:', err))
            }, currentAction.actionConfig.delaySeconds * 1000)
          } else {
            biliFunc.sendLiveDanmaku(roomId.value, formattedContent).catch(err => console.error('[AutoAction] 发送弹幕失败:', err))
          }
        }
      }

      if (currentAction.enabled && !currentAction.triggerConfig.useGlobalTimer) {
        const rescheduleIntervalMs = (currentAction.triggerConfig.intervalSeconds || 300) * 1000
        runtimeState.value.scheduledTimers[action.id] = setTimeout(timerFunc, rescheduleIntervalMs)
        runtimeState.value.timerStartTimes[action.id] = Date.now()
      } else {
        stopIndividualTimer(action.id)
      }
    }
    runtimeState.value.scheduledTimers[action.id] = setTimeout(timerFunc, intervalMs)
    runtimeState.value.timerStartTimes[action.id] = Date.now()
  }

  /**
   * 启动所有已启用的独立定时任务
   */
  function startIndividualScheduledActions() {
    if (!roomId.value || !autoActions.value) return
    if (!enabledTriggerTypes.value[TriggerType.SCHEDULED]) return

    const individualActions = autoActions.value.filter(action =>
      action.triggerType === TriggerType.SCHEDULED
      && action.enabled
      && !action.triggerConfig.useGlobalTimer,
    )
    individualActions.forEach(action => startIndividualTimer(action))
  }

  /**
   * 停止所有独立定时任务的定时器
   */
  function stopAllIndividualScheduledActions() {
    console.log('[AutoAction] 停止所有独立定时器.')
    Object.keys(runtimeState.value.scheduledTimers).forEach(stopIndividualTimer)
  }

  // 初始化与事件监听
  let isInited = false
  /**
   * 初始化自动操作系统
   */
  function init() {
    if (isInited) {
      return
    }
    isInited = true
    const allLoaded = computed(() => isActionsLoaded.value && isIntervalLoaded.value && isModeLoaded.value && isIndexLoaded.value && isTriggersLoaded.value)

    watch(allLoaded, (loaded) => {
      if (loaded) {
        console.log('[AutoAction] 所有设置已从 IDB 加载.')
        autoActions.value.forEach((action) => {
          if (!action.triggerConfig) action.triggerConfig = {}
          if (action.triggerType === TriggerType.SCHEDULED) {
            if (action.triggerConfig.useGlobalTimer === undefined) action.triggerConfig.useGlobalTimer = false
            if (action.triggerConfig.intervalSeconds === undefined) action.triggerConfig.intervalSeconds = 300
            if (action.triggerConfig.schedulingMode === undefined) action.triggerConfig.schedulingMode = 'random'
          }
        })

        startGlobalTimer()
        startIndividualScheduledActions()
      }
    }, { immediate: true })

    // 监听直播状态变化
    watch(isLive, (currentState, prevState) => {
      if (currentState && !prevState) {
        console.log('[AutoAction] 检测到直播开始，更新签到模块状态')
        // checkInModule.onLiveStart();
      } else if (!currentState && prevState) {
        console.log('[AutoAction] 检测到直播结束，更新签到模块状态')
        // checkInModule.onLiveEnd();
      }
    }, { immediate: true })

    registerEventListeners()
  }

  // 初始化模块
  const giftThankModule = useGiftThank(isLive, roomId, isTianXuanActive, biliFunc.sendLiveDanmaku)
  const guardPmModule = useGuardPm(
    roomId,
    async (userId: number, message: string) => biliFunc.sendPrivateMessage(userId, message),
    biliFunc.sendLiveDanmaku,
  )
  const followThankModule = useFollowThank(isLive, roomId, isTianXuanActive, biliFunc.sendLiveDanmaku)
  const entryWelcomeModule = useEntryWelcome(isLive, roomId, isTianXuanActive, biliFunc.sendLiveDanmaku)
  const autoReplyModule = useAutoReply(isLive, roomId, biliFunc.sendLiveDanmaku)
  const scheduledDanmakuModule = useScheduledDanmaku(isLive, roomId, biliFunc.sendLiveDanmaku)
  const superChatThankModule = useSuperChatThank(isLive, roomId, isTianXuanActive, biliFunc.sendLiveDanmaku)
  const checkInModule = useCheckIn(isLive, roomId, liveStartTime, isTianXuanActive, biliFunc.sendLiveDanmaku)

  /**
   * 向弹幕客户端注册事件监听器
   */
  function registerEventListeners() {
    if (danmakuClient.state !== 'connected') {
      console.warn('[AutoAction] 弹幕客户端未就绪, 延迟注册监听器.')
    }
    try {
      danmakuClient.onEvent('danmaku', event => processEvent(event, TriggerType.DANMAKU))
      danmakuClient.onEvent('gift', event => processEvent(event, TriggerType.GIFT))
      danmakuClient.onEvent('guard', event => processEvent(event, TriggerType.GUARD))
      danmakuClient.onEvent('sc', event => processEvent(event, TriggerType.SUPER_CHAT))
      danmakuClient.onEvent('enter', event => processEvent(event, TriggerType.ENTER))
      danmakuClient.onEvent('follow', event => processEvent(event, TriggerType.FOLLOW))
      console.log('[AutoAction] 事件监听器已注册.')
    } catch (err) {
      console.error('[AutoAction] 注册事件监听器时出错:', err)
    }
  }

  /**
   * 添加一个新的自动操作项
   */
  function addAutoAction(triggerType: TriggerType): AutoActionItem {
    const newAction = createDefaultAutoAction(triggerType)
    autoActions.value.push(newAction)
    if (triggerType === TriggerType.SCHEDULED) {
      if (newAction.triggerConfig.useGlobalTimer) {
        restartGlobalTimer()
      } else {
        startIndividualTimer(newAction)
      }
    }
    return newAction
  }

  /**
   * 移除一个自动操作项
   */
  function removeAutoAction(id: string) {
    const index = autoActions.value.findIndex(action => action.id === id)
    if (index !== -1) {
      const removedAction = autoActions.value[index]
      const needsGlobalTimerAfterRemoval = false
      const wasGlobalTimerAction = false

      if (removedAction.triggerType === TriggerType.SCHEDULED) {
        stopIndividualTimer(id)
      }

      autoActions.value.splice(index, 1)

      if (wasGlobalTimerAction && needsGlobalTimerAfterRemoval) {
        restartGlobalTimer()
      }
    }
  }

  /**
   * 切换自动操作项的启用/禁用状态
   */
  function toggleAutoAction(id: string, enabled: boolean) {
    const action = autoActions.value.find(action => action.id === id)
    if (action) {
      action.enabled = enabled

      if (action.triggerType === TriggerType.SCHEDULED) {
        if (action.triggerConfig.useGlobalTimer) {
          restartGlobalTimer()
        } else {
          if (enabled) {
            startIndividualTimer(action)
          } else {
            stopIndividualTimer(id)
          }
        }
      }
    }
  }

  // 天选状态检查
  function checkTianXuanStatus() {
    // TODO: 实现检查天选时刻状态的逻辑
  }
  const tianXuanTimer = setInterval(checkTianXuanStatus, 5 * 60 * 1000)

  /**
   * 处理接收到的事件
   */
  function processEvent(event: EventModel, triggerType: TriggerType) {
    if (!roomId.value) return

    // 处理签到功能（独立于触发类型启用状态）
    if (triggerType === TriggerType.DANMAKU) {
      checkInModule.processCheckIn(event, runtimeState.value)
    }

    // 其他功能依赖触发类型启用状态
    if (!enabledTriggerTypes.value[triggerType]) return
    switch (triggerType) {
      case TriggerType.DANMAKU:
        autoReplyModule.onDanmaku(event, autoActions.value, runtimeState.value)
        break
      case TriggerType.GIFT:
        giftThankModule.processGift(event, autoActions.value, runtimeState.value)
        break
      case TriggerType.GUARD:
        guardPmModule.handleGuardBuy(autoActions.value, event, runtimeState.value)
        break
      case TriggerType.FOLLOW:
        followThankModule.processFollow(event, autoActions.value, runtimeState.value)
        break
      case TriggerType.ENTER:
        entryWelcomeModule.processEnter(event, autoActions.value, runtimeState.value)
        break
      case TriggerType.SUPER_CHAT:
        superChatThankModule.processSuperChat(event, autoActions.value, runtimeState.value)
        break
      default:
        console.warn(`[AutoAction] 未知触发类型: ${triggerType}`)
    }
  }

  /**
   * 获取定时任务的计时器信息
   */
  function getScheduledTimerInfo(actionId: string): { actionId: string, intervalMs: number, remainingMs: number } | null {
    const action = autoActions.value.find(a => a.id === actionId)
    if (!action || action.triggerType !== TriggerType.SCHEDULED || !action.enabled) {
      return null
    }

    const usingGlobal = action.triggerConfig.useGlobalTimer ?? false
    let intervalSeconds: number
    let isActive = false
    let startTime: number | null = null

    if (usingGlobal) {
      intervalSeconds = globalIntervalSeconds.value
      isActive = globalTimer.value !== null
      startTime = runtimeState.value.globalTimerStartTime
    } else {
      intervalSeconds = action.triggerConfig.intervalSeconds || 300
      isActive = !!runtimeState.value.scheduledTimers[actionId]
      startTime = runtimeState.value.timerStartTimes[actionId] ?? null
    }

    if (!isActive || intervalSeconds <= 0 || startTime === null) {
      return null
    }

    const intervalMs = intervalSeconds * 1000
    const now = Date.now()
    const remainingMs = Math.max(0, startTime + intervalMs - now)

    return {
      actionId,
      intervalMs,
      remainingMs,
    }
  }

  /**
   * 在列表中向上或向下移动一个操作项
   */
  function moveAction(id: string, direction: 'up' | 'down') {
    const index = autoActions.value.findIndex(action => action.id === id)
    if (index === -1) {
      console.warn(`[AutoAction] 无法移动操作: 未找到 ID ${id}.`)
      return
    }

    const actionToMove = autoActions.value[index]

    let newIndex = index
    if (direction === 'up' && index > 0) {
      newIndex = index - 1
    } else if (direction === 'down' && index < autoActions.value.length - 1) {
      newIndex = index + 1
    }

    if (newIndex !== index) {
      autoActions.value.splice(index, 1)
      autoActions.value.splice(newIndex, 0, actionToMove)
      if (actionToMove.triggerType === TriggerType.SCHEDULED && actionToMove.triggerConfig.useGlobalTimer) {
        lastGlobalActionIndex.value = -1
      }
    }
  }

  // 监听全局间隔设置的变化
  watch(globalIntervalSeconds, (newInterval, oldInterval) => {
    if (newInterval !== oldInterval && newInterval > 0) {
      console.log('[AutoAction] 全局间隔已更改, 重启全局定时器.')
      restartGlobalTimer()
    }
  })

  /**
   * 获取下一个将在全局顺序模式下执行的操作
   */
  const nextScheduledAction = computed<AutoActionItem | null>(() => {
    if (globalSchedulingMode.value !== 'sequential' || !autoActions.value) {
      return null
    }

    const eligibleActions = autoActions.value.filter(action =>
      action.triggerType === TriggerType.SCHEDULED
      && action.enabled
      && action.triggerConfig.useGlobalTimer
      && (!action.triggerConfig.onlyDuringLive || isLive.value)
      && (!action.triggerConfig.ignoreTianXuan || !isTianXuanActive.value),
    )

    if (eligibleActions.length === 0) {
      return null
    }

    const nextIndex = (lastGlobalActionIndex.value + 1) % eligibleActions.length
    return eligibleActions[nextIndex]
  })

  /**
   * 手动设置下一个在全局顺序模式下执行的操作
   */
  function setNextGlobalAction(actionId: string) {
    const targetAction = autoActions.value.find(a => a.id === actionId)
    if (!targetAction || targetAction.triggerType !== TriggerType.SCHEDULED || !targetAction.triggerConfig.useGlobalTimer) {
      console.warn(`[AutoAction] setNextGlobalAction: 无法设置 ID 为 ${actionId} 的操作为下一个全局操作 (不存在、类型错误或未使用全局定时器)`)
      return
    }
    if (globalSchedulingMode.value !== 'sequential') {
      console.warn(`[AutoAction] setNextGlobalAction: 只有在顺序模式下才能手动指定下一个操作。当前模式: ${globalSchedulingMode.value}`)
      return
    }

    const eligibleActions = autoActions.value.filter(action =>
      action.triggerType === TriggerType.SCHEDULED
      && action.enabled
      && action.triggerConfig.useGlobalTimer
      && (!action.triggerConfig.onlyDuringLive || isLive.value)
      && (!action.triggerConfig.ignoreTianXuan || !isTianXuanActive.value),
    )

    const targetIndex = eligibleActions.findIndex(a => a.id === actionId)

    if (targetIndex === -1) {
      console.warn(`[AutoAction] setNextGlobalAction: 指定的操作 ID ${actionId} 当前不符合执行条件，无法设置为下一个。`)
      return
    }

    lastGlobalActionIndex.value = (targetIndex - 1 + eligibleActions.length) % eligibleActions.length
    restartGlobalTimer()
  }

  /**
   * 手动触发指定类型的测试逻辑
   */
  function triggerTestActionByType(triggerType: TriggerType, testUid?: number) {
    console.log(`[AutoAction Test] 准备测试类型: ${triggerType}`)

    const actionsToTest = autoActions.value.filter(a =>
      a.triggerType === triggerType
      && a.enabled
      && enabledTriggerTypes.value[triggerType],
    )

    if (actionsToTest.length === 0) {
      console.warn(`[AutoAction Test] 没有找到启用的 ${triggerType} 类型的操作可供测试。`)
      if (!enabledTriggerTypes.value[triggerType]) {
        console.warn(`[AutoAction Test] 触发类型 ${triggerType} 本身已被禁用。`)
      }
      return
    }

    const baseTestEvent: Partial<EventModel> = {
      uid: testUid || 10000,
      uname: '测试用户',
      uface: '',
      open_id: 'test-open-id',
      ouid: 'test-ouid',
      time: Math.floor(Date.now() / 1000),
      num: 1,
      price: 0,
      guard_level: Math.floor(Math.random() * 3) + 1,
      fans_medal_wearing_status: true,
      fans_medal_name: '测试牌子',
      fans_medal_level: Math.floor(Math.random() * 30) + 1,
    }

    let testEvent: EventModel

    switch (triggerType) {
      case TriggerType.DANMAKU:
        testEvent = {
          ...baseTestEvent,
          type: EventDataTypes.Message,
          msg: '测试弹幕消息',
        } as EventModel
        break
      case TriggerType.GIFT:
        testEvent = {
          ...baseTestEvent,
          type: EventDataTypes.Gift,
          msg: '测试礼物',
          price: 100,
          num: 5,
        } as EventModel
        break
      case TriggerType.GUARD:
        const level = Math.floor(Math.random() * 3) + 1
        testEvent = {
          ...baseTestEvent,
          type: EventDataTypes.Guard,
          msg: '舰长',
          price: level === 1 ? 19998 : level === 2 ? 1998 : 198,
          guard_level: level,
        } as EventModel
        break
      case TriggerType.FOLLOW:
        testEvent = {
          ...baseTestEvent,
          type: EventDataTypes.Follow,
        } as EventModel
        break
      case TriggerType.ENTER:
        testEvent = {
          ...baseTestEvent,
          type: EventDataTypes.Enter,
        } as EventModel
        break
      case TriggerType.SUPER_CHAT:
        testEvent = {
          ...baseTestEvent,
          type: EventDataTypes.SC,
          msg: '这是一条测试SC消息',
          price: Math.floor(Math.random() * 1000) + 10,
        } as EventModel
        break
      case TriggerType.SCHEDULED:
        if (actionsToTest.length > 0) {
          const action = actionsToTest[0]
          const context = buildExecutionContext(null, roomId.value, TriggerType.SCHEDULED)
          const template = getRandomTemplate(action.template)

          if (template && roomId.value) {
            const formattedContent = evaluateTemplateExpressions(template, context)
            runtimeState.value.lastExecutionTime[action.id] = Date.now()

            console.log(`[定时任务测试] 正在测试定时任务: ${action.name}, 内容: ${formattedContent}`)

            if (action.actionConfig.delaySeconds && action.actionConfig.delaySeconds > 0) {
              console.log(`[定时任务测试] 将在 ${action.actionConfig.delaySeconds} 秒后发送弹幕`)
              setTimeout(() => {
                biliFunc.sendLiveDanmaku(roomId.value!, formattedContent)
                  .catch(err => console.error('[AutoAction] 发送弹幕失败:', err))
              }, action.actionConfig.delaySeconds * 1000)
            } else {
              biliFunc.sendLiveDanmaku(roomId.value, formattedContent)
                .catch(err => console.error('[AutoAction] 发送弹幕失败:', err))
            }
          }
        }
        return
      default:
        console.warn(`[AutoAction Test] 未知的触发类型: ${triggerType}`)
        return
    }

    console.log(`[AutoAction Test] 创建测试事件:`, testEvent)
    processEvent(testEvent, triggerType)
  }

  return {
    autoActions,
    runtimeState: computed(() => runtimeState.value),
    globalIntervalSeconds,
    globalSchedulingMode,
    nextScheduledAction,
    isLive,
    isTianXuanActive,
    enabledTriggerTypes,
    checkInModule,
    init,
    addAutoAction,
    removeAutoAction,
    toggleAutoAction,
    moveAction,
    setNextGlobalAction,
    restartGlobalTimer,
    getScheduledTimerInfo,
    setTriggerTypeEnabled,
    startIndividualTimer,
    stopIndividualTimer,
    stopAllIndividualScheduledActions,
    startIndividualScheduledActions,
    triggerTestActionByType,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAutoAction, import.meta.hot))
}

export { ActionType, AutoActionItem, KeywordMatchType, Priority, TriggerType }
