import { nanoid } from 'nanoid'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, onScopeDispose, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { useAccount } from '@/api/account.js'
import type { EventModel, SongRequestInfo } from '@/api/client-types'
import { getApiLiveRequestGetActive } from '@/api/generated/live-request/live-request'
import { EventDataTypes, SongRequestStatus } from '@/api/generated/model'
import { canUseVts } from '@/shared/config'
import { useRealtimeTopic } from '@/shared/realtime'
import { persistLoaded, usePersistedStorage } from '@/shared/storage/persist'
import { useDanmakuClient } from '@/store/useDanmakuClient.js'

import { isLiveStreaming, liveStartTimeMs, roomInfo } from '../data/info'
import { checkUserFilters, executeActions, filterValidActions, processTemplate } from './autoAction/actionUtils'
import { evaluateTemplateExpressions } from './autoAction/expressionEvaluator'
import { matchesDanmakuTrigger, useAutoReply } from './autoAction/modules/autoReply'
import type { CheckInHubEvent } from './autoAction/modules/checkin'
import { useCheckIn } from './autoAction/modules/checkin'
import { matchesEnterTrigger, useEntryWelcome } from './autoAction/modules/entryWelcome'
import { useFollowThank } from './autoAction/modules/followThank'
import { matchesGiftTrigger, useGiftThank } from './autoAction/modules/giftThank'
import { matchesGuardTrigger, pickGuardGiftCode, useGuardPm } from './autoAction/modules/guardPm'
import type { PointOrderRedeemedHubEvent } from './autoAction/modules/pointRedeem'
import { matchesPointRedeemTrigger, normalizePointRedeemEvent, usePointRedeem } from './autoAction/modules/pointRedeem'
import {
  buildMockSongRequestEvent,
  normalizeSongRequestEvent,
  useSongRequestAutoAction,
} from './autoAction/modules/songRequest'
import { matchesSuperChatTrigger, useSuperChatThank } from './autoAction/modules/superChatThank'
import { syncNowPlayingFile, useNowPlayingSettings } from '../utils/nowPlayingWriter'
import type { AutoActionItem, RuntimeState, SingleActionTestResult } from './autoAction/types.js'
import {
  ActionType,
  KeywordMatchType,
  LIFECYCLE_TRIGGER_TYPES,
  OBS_ACTION_TYPES,
  Priority,
  TriggerType,
  VTS_ACTION_TYPES,
} from './autoAction/types.js'
import {
  buildExecutionContext,
  createDefaultAutoAction,
  createDefaultRuntimeState,
  evaluateExpression,
  validateLogicalExpression,
} from './autoAction/utils'
import { useBiliAccountManager } from './useBiliAccountManager'
import { useBiliCookie } from './useBiliCookie'
import { useBiliFunction } from './useBiliFunction.js'
import { useVtsStore } from './useVtsStore'

export const useAutoAction = defineStore('autoAction', () => {
  const danmakuClient = useDanmakuClient()
  const biliFunc = useBiliFunction()
  const account = useAccount()
  const accountManager = useBiliAccountManager()
  const userEventsTopic = computed(() => (account.value.id > 0 ? `user:events:${account.value.id}` : ''))
  const { on: onUserEvent } = useRealtimeTopic(userEventsTopic)
  const liveRequestTopic = computed(() =>
    account.value.id > 0 ? `obs:display:live-request:${account.value.id}` : '',
  )
  const { on: onLiveRequestEvent } = useRealtimeTopic(liveRequestTopic)
  const nowPlayingSettings = useNowPlayingSettings()
  let userEventsRegistered = false
  let hasHydratedSongRequests = false
  let knownSongRequestIds = new Set<number>()
  let lastSingingRequestId: number | null = null

  // 共享状态（统一消费 info.ts 全局单一在播真源）
  const isLive = computed(() => isLiveStreaming.value)
  const roomId = computed(() => account.value.streamerInfo?.roomId || account.value.biliRoomId)
  const isTianXuanActive = ref(false)
  const fallbackLiveStartTime = ref<number | null>(null)
  const liveStartTime = computed<number | null>(() => {
    if (!isLive.value) return null
    return liveStartTimeMs.value ?? fallbackLiveStartTime.value
  })

  const scheduledHandlers = {
    sendLiveDanmaku: biliFunc.sendLiveDanmaku,
    sendPrivateMessage: biliFunc.sendPrivateMessage,
  }

  const autoActions = usePersistedStorage<AutoActionItem[]>('autoAction.items', [])
  const isActionsLoaded = persistLoaded(autoActions)

  // 运行时状态
  const runtimeState = ref<RuntimeState>(createDefaultRuntimeState())

  // 触发类型启用状态
  const enabledTriggerTypes = usePersistedStorage<Record<TriggerType, boolean>>('autoAction.enabledTriggers', {
    [TriggerType.DANMAKU]: true,
    [TriggerType.GIFT]: true,
    [TriggerType.GUARD]: true,
    [TriggerType.FOLLOW]: true,
    [TriggerType.ENTER]: true,
    [TriggerType.SCHEDULED]: true,
    [TriggerType.SUPER_CHAT]: true,
    [TriggerType.POINT_REDEEM]: true,
    [TriggerType.SONG_REQUEST]: true,
    [TriggerType.SONG_START]: true,
    [TriggerType.LIVE_START]: true,
    [TriggerType.LIVE_END]: true,
    [TriggerType.DANMAKU_DISCONNECTED]: true,
    [TriggerType.COOKIE_INVALID]: true,
  })
  const isTriggersLoaded = persistLoaded(enabledTriggerTypes)

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
  const globalIntervalSeconds = usePersistedStorage<number>('autoAction.globalInterval', 300)
  const isIntervalLoaded = persistLoaded(globalIntervalSeconds)
  const globalSchedulingMode = usePersistedStorage<'random' | 'sequential'>('autoAction.globalMode', 'random')
  const isModeLoaded = persistLoaded(globalSchedulingMode)
  const lastGlobalActionIndex = usePersistedStorage<number>('autoAction.lastGlobalIndex', -1)
  const isIndexLoaded = persistLoaded(lastGlobalActionIndex)

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

    const eligibleActions = autoActions.value.filter(
      (action) =>
        action.triggerType === TriggerType.SCHEDULED &&
        action.enabled &&
        action.triggerConfig.useGlobalTimer &&
        (!action.triggerConfig.onlyDuringLive || isLive.value) &&
        (!action.triggerConfig.ignoreTianXuan || !isTianXuanActive.value),
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
        executeActions(
          [actionToExecute],
          null,
          TriggerType.SCHEDULED,
          roomId.value,
          runtimeState.value,
          scheduledHandlers,
        )
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

    const needsGlobalTimer = autoActions.value.some(
      (action) => action.triggerType === TriggerType.SCHEDULED && action.triggerConfig.useGlobalTimer,
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
      const currentAction = autoActions.value.find((a) => a.id === action.id)
      if (!currentAction) {
        stopIndividualTimer(action.id)
        return
      }
      const shouldExecute =
        currentAction.enabled &&
        !currentAction.triggerConfig.useGlobalTimer &&
        (!currentAction.triggerConfig.onlyDuringLive || isLive.value) &&
        (!currentAction.triggerConfig.ignoreTianXuan || !isTianXuanActive.value)

      if (shouldExecute && roomId.value) {
        executeActions(
          [currentAction],
          null,
          TriggerType.SCHEDULED,
          roomId.value,
          runtimeState.value,
          scheduledHandlers,
          {
            useSequentialTemplate: currentAction.triggerConfig.schedulingMode === 'sequential',
          },
        )
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

    const individualActions = autoActions.value.filter(
      (action) =>
        action.triggerType === TriggerType.SCHEDULED && action.enabled && !action.triggerConfig.useGlobalTimer,
    )
    individualActions.forEach((action) => startIndividualTimer(action))
  }

  /**
   * 停止所有独立定时任务的定时器
   */
  function stopAllIndividualScheduledActions() {
    console.log('[AutoAction] 停止所有独立定时器.')
    Object.keys(runtimeState.value.scheduledTimers).forEach(stopIndividualTimer)
  }

  function syncScheduledTimers() {
    if (!isActionsLoaded.value || !isTriggersLoaded.value) return
    const scheduledEnabled = Boolean(enabledTriggerTypes.value?.[TriggerType.SCHEDULED])

    if (!scheduledEnabled) {
      stopGlobalTimer()
      stopAllIndividualScheduledActions()
      return
    }

    const scheduledActions = autoActions.value.filter((a) => a.triggerType === TriggerType.SCHEDULED)
    const validIndividualIds = new Set<string>()

    for (const action of scheduledActions) {
      if (action.enabled && !action.triggerConfig.useGlobalTimer) {
        validIndividualIds.add(action.id)
      }
    }

    // 停掉已删除、已禁用或改用全局定时的独立定时器
    for (const runningId of Object.keys(runtimeState.value.scheduledTimers)) {
      if (!validIndividualIds.has(runningId)) {
        stopIndividualTimer(runningId)
      }
    }

    // 启动未运行的独立定时器
    for (const action of scheduledActions) {
      if (validIndividualIds.has(action.id) && !runtimeState.value.scheduledTimers[action.id]) {
        startIndividualTimer(action)
      }
    }

    // 同步全局定时器启停
    const needsGlobal = scheduledActions.some((a) => a.enabled && a.triggerConfig.useGlobalTimer)
    if (needsGlobal) {
      startGlobalTimer()
    } else {
      stopGlobalTimer()
    }
  }

  // 自动监听定时规则的关键配置变化，避免编辑器直接修改字段后与运行中定时器失步
  const scheduledConfigSnapshot = computed(() =>
    autoActions.value
      .filter((a) => a.triggerType === TriggerType.SCHEDULED)
      .map((a) => ({
        id: a.id,
        enabled: a.enabled,
        useGlobal: Boolean(a.triggerConfig?.useGlobalTimer),
        interval: a.triggerConfig?.intervalSeconds || 300,
      })),
  )

  watch(
    scheduledConfigSnapshot,
    (nextList, prevList) => {
      if (!isActionsLoaded.value || !isTriggersLoaded.value) return
      const prevMap = new Map((prevList ?? []).map((item) => [item.id, item]))
      for (const item of nextList) {
        const prev = prevMap.get(item.id)
        // 独立定时器间隔变化时重启对应定时器
        if (prev && !item.useGlobal && item.enabled && prev.interval !== item.interval) {
          stopIndividualTimer(item.id)
        }
      }
      syncScheduledTimers()
    },
    { deep: true },
  )

  // 初始化与事件监听
  let isInited = false
  const eventUnlistens: Array<() => void> = []

  onScopeDispose(() => {
    stopGlobalTimer()
    stopAllIndividualScheduledActions()
    for (const unlisten of eventUnlistens) unlisten()
    eventUnlistens.length = 0
    isInited = false
    userEventsRegistered = false
  })

  /**
   * 初始化自动操作系统
   */
  function init() {
    if (isInited) {
      return
    }
    isInited = true
    const allLoaded = computed(
      () =>
        isActionsLoaded.value &&
        isIntervalLoaded.value &&
        isModeLoaded.value &&
        isIndexLoaded.value &&
        isTriggersLoaded.value,
    )

    watch(
      allLoaded,
      (loaded) => {
        if (loaded) {
          console.log('[AutoAction] 所有设置已加载.')
          autoActions.value.forEach((action) => {
            if (!action.triggerConfig) action.triggerConfig = {}
            if (action.triggerType === TriggerType.SCHEDULED) {
              if (action.triggerConfig.useGlobalTimer === undefined) action.triggerConfig.useGlobalTimer = false
              if (action.triggerConfig.intervalSeconds === undefined) action.triggerConfig.intervalSeconds = 300
              if (action.triggerConfig.schedulingMode === undefined) action.triggerConfig.schedulingMode = 'random'
            }
          })

          // 兼容旧版本：触发类型启用状态可能缺少新字段（例如 gift / super_chat / 生命周期触发器）
          const defaultEnabled: Record<TriggerType, boolean> = {
            [TriggerType.DANMAKU]: true,
            [TriggerType.GIFT]: true,
            [TriggerType.GUARD]: true,
            [TriggerType.FOLLOW]: true,
            [TriggerType.ENTER]: true,
            [TriggerType.SCHEDULED]: true,
            [TriggerType.SUPER_CHAT]: true,
            [TriggerType.POINT_REDEEM]: true,
            [TriggerType.SONG_REQUEST]: true,
            [TriggerType.SONG_START]: true,
            [TriggerType.LIVE_START]: true,
            [TriggerType.LIVE_END]: true,
            [TriggerType.DANMAKU_DISCONNECTED]: true,
            [TriggerType.COOKIE_INVALID]: true,
          }
          let patched = false
          for (const triggerType of Object.values(TriggerType)) {
            const t = triggerType
            if (enabledTriggerTypes.value[t] === undefined) {
              enabledTriggerTypes.value[t] = defaultEnabled[t]
              patched = true
            }
          }
          if (patched) {
            enabledTriggerTypes.value = { ...enabledTriggerTypes.value }
            console.log('[AutoAction] 已补全缺失的触发类型启用配置.')
          }

          startGlobalTimer()
          startIndividualScheduledActions()
        }
      },
      { immediate: true },
    )

    // 监听直播状态变化，维护开播时间并触发开播/下播生命周期规则
    let hasHydratedLive = false
    let prevHydratedLive = false
    eventUnlistens.push(
      watch(
        () => [Boolean(roomInfo.value), isLive.value] as const,
        ([hasRoom, currentState]) => {
          if (currentState) {
            fallbackLiveStartTime.value ??= liveStartTimeMs.value ?? Date.now()
          } else {
            fallbackLiveStartTime.value = null
          }

          if (!hasRoom) return
          if (!hasHydratedLive) {
            hasHydratedLive = true
            prevHydratedLive = currentState
            return
          }
          if (currentState !== prevHydratedLive) {
            prevHydratedLive = currentState
            if (currentState) {
              console.log('[AutoAction] 检测到直播开始，已同步开播时间')
              dispatchLifecycleTrigger(TriggerType.LIVE_START, {
                event: 'live_start',
                reason: '直播间已开播',
              })
            } else {
              console.log('[AutoAction] 检测到直播结束，已重置开播时间')
              dispatchLifecycleTrigger(TriggerType.LIVE_END, {
                event: 'live_end',
                reason: '直播间已下播',
              })
            }
          }
        },
        { immediate: true },
      ),
    )

    // 监听弹幕客户端连接异常断开
    let lastDanmakuDisconnectAlertAt = 0
    eventUnlistens.push(
      watch(
        () => danmakuClient.phase,
        (nextPhase, prevPhase) => {
          if (prevPhase === 'connected' && (nextPhase === 'reconnecting' || nextPhase === 'error')) {
            const now = Date.now()
            if (now - lastDanmakuDisconnectAlertAt < 15_000) return
            lastDanmakuDisconnectAlertAt = now
            dispatchLifecycleTrigger(TriggerType.DANMAKU_DISCONNECTED, {
              event: 'danmaku_disconnected',
              reason: danmakuClient.lastError || (nextPhase === 'reconnecting' ? '弹幕连接已断开，正在重连' : '弹幕连接出错'),
            })
          }
        },
      ),
    )

    // 监听 B 站主账号 Cookie 失效
    let prevMainCookieValid: boolean | null = null
    eventUnlistens.push(
      watch(
        () => accountManager.mainAccount,
        (acc) => {
          if (!acc) {
            prevMainCookieValid = null
            return
          }
          if (prevMainCookieValid === true && !acc.isValid) {
            dispatchLifecycleTrigger(TriggerType.COOKIE_INVALID, {
              event: 'cookie_invalid',
              accountName: acc.alias ? `${acc.name} (${acc.alias})` : acc.name || acc.id,
              reason: '主账号 Cookie 验证失败',
            })
          }
          prevMainCookieValid = acc.isValid
        },
        { deep: true, immediate: true },
      ),
    )

    registerEventListeners()
    void registerCheckInResultListener()
  }

  function buildLiveVariables() {
    return {
      isLive: isLive.value,
      roomId: roomId.value ?? 0,
      title: roomInfo.value?.title || '',
      areaName: roomInfo.value?.area_name || '',
      startTime: liveStartTime.value ?? null,
    }
  }

  function buildSystemMockVariables(triggerType: TriggerType): Record<string, unknown> {
    switch (triggerType) {
      case TriggerType.LIVE_START:
        return { event: 'live_start', reason: '直播间已开播（测试）' }
      case TriggerType.LIVE_END:
        return { event: 'live_end', reason: '直播间已下播（测试）' }
      case TriggerType.DANMAKU_DISCONNECTED:
        return { event: 'danmaku_disconnected', reason: '模拟弹幕连接中断（测试）' }
      case TriggerType.COOKIE_INVALID:
        return {
          event: 'cookie_invalid',
          accountName: accountManager.mainAccount?.name || '测试主账号',
          reason: '模拟 Cookie 验证失效（测试）',
        }
      default:
        return { event: triggerType, reason: '状态事件（测试）' }
    }
  }

  function dispatchLifecycleTrigger(
    triggerType: TriggerType,
    systemVars?: Record<string, unknown>,
    isTest = false,
  ) {
    if (!isActionsLoaded.value || !isTriggersLoaded.value) return
    if (!isTest && !enabledTriggerTypes.value?.[triggerType]) return

    const validActions = filterValidActions(autoActions.value, triggerType, isLive, isTianXuanActive, {
      enabledTriggerTypes: isTest ? undefined : enabledTriggerTypes,
      isTest,
    })
    if (validActions.length === 0) return

    const effectiveRoomId = roomId.value || 10000
    const liveVars = buildLiveVariables()
    executeActions(validActions, null, triggerType, effectiveRoomId, runtimeState.value, scheduledHandlers, {
      isTest,
      skipUserFilters: true,
      customContextBuilder: (ev, rid, tt) =>
        buildExecutionContext(ev, rid, tt, {
          live: liveVars,
          system: systemVars ?? buildSystemMockVariables(triggerType),
        }),
    })
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
  const superChatThankModule = useSuperChatThank(isLive, roomId, isTianXuanActive, biliFunc.sendLiveDanmaku)
  const checkInModule = useCheckIn(
    isLive,
    roomId,
    liveStartTime,
    isTianXuanActive,
    biliFunc.sendLiveDanmaku,
    async (userId: number, message: string) => biliFunc.sendPrivateMessage(userId, message),
  )
  const pointRedeemModule = usePointRedeem(
    isLive,
    roomId,
    isTianXuanActive,
    biliFunc.sendLiveDanmaku,
    async (userId: number, message: string) => biliFunc.sendPrivateMessage(userId, message),
  )
  const songRequestModule = useSongRequestAutoAction(
    isLive,
    roomId,
    isTianXuanActive,
    biliFunc.sendLiveDanmaku,
    async (userId: number, message: string) => biliFunc.sendPrivateMessage(userId, message),
  )

  /**
   * 向弹幕客户端注册事件监听器
   */
  function registerEventListeners() {
    if (danmakuClient.state !== 'connected') {
      console.warn('[AutoAction] 弹幕客户端未就绪, 延迟注册监听器.')
    }
    try {
      const bindings: Array<[Parameters<typeof danmakuClient.onEvent>[0], TriggerType]> = [
        ['danmaku', TriggerType.DANMAKU],
        ['gift', TriggerType.GIFT],
        ['guard', TriggerType.GUARD],
        ['sc', TriggerType.SUPER_CHAT],
        ['enter', TriggerType.ENTER],
        ['follow', TriggerType.FOLLOW],
      ]
      for (const [evt, trigger] of bindings) {
        const handler = (event: EventModel) => processEvent(event, trigger)
        danmakuClient.onEvent(evt, handler)
        eventUnlistens.push(() => danmakuClient.offEvent(evt, handler))
      }
      console.log('[AutoAction] 事件监听器已注册.')
    } catch (err) {
      console.error('[AutoAction] 注册事件监听器时出错:', err)
    }
  }

  async function syncSongRequestChanges() {
    const uid = account.value.id
    if (!uid) return
    const hasSongRules = autoActions.value.some(
      (a) =>
        a.enabled &&
        (a.triggerType === TriggerType.SONG_REQUEST || a.triggerType === TriggerType.SONG_START),
    )
    if (!hasSongRules && !nowPlayingSettings.value.enabled) return

    try {
      const resp = await getApiLiveRequestGetActive({ id: uid })
      if (resp.code !== 200 || !Array.isArray(resp.data)) return
      const activeList = resp.data as unknown as SongRequestInfo[]
      const singing = activeList.find((s) => s.status === SongRequestStatus.Singing) ?? null
      const waiting = activeList.filter((s) => s.status === SongRequestStatus.Waiting)

      if (nowPlayingSettings.value.enabled) {
        void syncNowPlayingFile(singing, waiting.length, nowPlayingSettings.value)
      }

      const currentIds = new Set(activeList.map((s) => s.id))
      if (!hasHydratedSongRequests) {
        hasHydratedSongRequests = true
        knownSongRequestIds = currentIds
        lastSingingRequestId = singing?.id ?? null
        return
      }

      if (enabledTriggerTypes.value?.[TriggerType.SONG_REQUEST]) {
        for (const item of activeList) {
          if (!knownSongRequestIds.has(item.id)) {
            songRequestModule.processSongRequestTrigger(
              TriggerType.SONG_REQUEST,
              normalizeSongRequestEvent(item, waiting.length),
              autoActions.value,
              runtimeState.value,
            )
          }
        }
      }

      if (
        singing &&
        singing.id !== lastSingingRequestId &&
        enabledTriggerTypes.value?.[TriggerType.SONG_START]
      ) {
        songRequestModule.processSongRequestTrigger(
          TriggerType.SONG_START,
          normalizeSongRequestEvent(singing, waiting.length),
          autoActions.value,
          runtimeState.value,
        )
      }

      knownSongRequestIds = currentIds
      lastSingingRequestId = singing?.id ?? null
    } catch {
      // 网络波动时忽略，等待下一次实时事件同步
    }
  }

  async function registerCheckInResultListener() {
    if (userEventsRegistered) return
    userEventsRegistered = true
    onUserEvent<CheckInHubEvent>('CheckInResult', onCheckInResult)
    onUserEvent<PointOrderRedeemedHubEvent>('PointOrderRedeemed', onPointOrderRedeemed)
    onLiveRequestEvent('Changed', () => {
      void syncSongRequestChanges()
    })
    void syncSongRequestChanges()
    console.log('[AutoAction] Hub 事件监听器已注册.')
  }

  function onCheckInResult(payload: CheckInHubEvent) {
    checkInModule.processCheckInResult(payload, runtimeState.value)
  }

  function onPointOrderRedeemed(payload: PointOrderRedeemedHubEvent) {
    if (!enabledTriggerTypes.value?.[TriggerType.POINT_REDEEM]) return
    pointRedeemModule.processPointRedeem(payload, autoActions.value, runtimeState.value)
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
   * 复制一个自动操作项
   */
  function duplicateAutoAction(id: string): AutoActionItem | null {
    const source = autoActions.value.find((action) => action.id === id)
    if (!source) return null
    const cloned = JSON.parse(JSON.stringify(source)) as AutoActionItem
    cloned.id = `auto-action-${nanoid(8)}`
    cloned.name = `${source.name || '未命名规则'} (副本)`
    cloned.enabled = false
    const idx = autoActions.value.findIndex((action) => action.id === id)
    autoActions.value.splice(idx + 1, 0, cloned)
    return cloned
  }

  /**
   * 移除一个自动操作项
   */
  function removeAutoAction(id: string) {
    const index = autoActions.value.findIndex((action) => action.id === id)
    if (index !== -1) {
      const removedAction = autoActions.value[index]

      if (removedAction.triggerType === TriggerType.SCHEDULED) {
        stopIndividualTimer(id)
      }

      autoActions.value.splice(index, 1)

      if (removedAction.triggerType === TriggerType.SCHEDULED && removedAction.triggerConfig.useGlobalTimer) {
        restartGlobalTimer()
      }
    }
  }

  /**
   * 切换自动操作项的启用/禁用状态
   */
  function toggleAutoAction(id: string, enabled: boolean) {
    const action = autoActions.value.find((item) => item.id === id)
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

  /**
   * 处理接收到的事件
   */
  function processEvent(event: EventModel, triggerType: TriggerType, isTest = false) {
    if (!roomId.value) return

    // 其他功能依赖触发类型启用状态
    if (!enabledTriggerTypes.value[triggerType]) return
    switch (triggerType) {
      case TriggerType.DANMAKU:
        autoReplyModule.onDanmaku(event, autoActions.value, runtimeState.value, isTest)
        break
      case TriggerType.GIFT:
        giftThankModule.processGift(event, autoActions.value, runtimeState.value, isTest)
        break
      case TriggerType.GUARD:
        guardPmModule.handleGuardBuy(autoActions.value, event, runtimeState.value, isTest)
        break
      case TriggerType.FOLLOW:
        followThankModule.processFollow(event, autoActions.value, runtimeState.value, isTest)
        break
      case TriggerType.ENTER:
        entryWelcomeModule.processEnter(event, autoActions.value, runtimeState.value, isTest)
        break
      case TriggerType.SUPER_CHAT:
        superChatThankModule.processSuperChat(event, autoActions.value, runtimeState.value, isTest)
        break
      default:
        console.warn(`[AutoAction] 未知触发类型: ${triggerType}`)
    }
  }

  /**
   * 获取定时任务的计时器信息
   */
  function getScheduledTimerInfo(
    actionId: string,
  ): { actionId: string; intervalMs: number; remainingMs: number } | null {
    const action = autoActions.value.find((a) => a.id === actionId)
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
   * 在同触发类型列表中向上或向下移动一个操作项
   */
  function moveAction(id: string, direction: 'up' | 'down') {
    const index = autoActions.value.findIndex((action) => action.id === id)
    if (index === -1) {
      console.warn(`[AutoAction] 无法移动操作: 未找到 ID ${id}.`)
      return
    }

    const actionToMove = autoActions.value[index]
    let targetIndex = -1
    if (direction === 'up') {
      for (let i = index - 1; i >= 0; i--) {
        if (autoActions.value[i].triggerType === actionToMove.triggerType) {
          targetIndex = i
          break
        }
      }
    } else {
      for (let i = index + 1; i < autoActions.value.length; i++) {
        if (autoActions.value[i].triggerType === actionToMove.triggerType) {
          targetIndex = i
          break
        }
      }
    }

    if (targetIndex !== -1) {
      const [moved] = autoActions.value.splice(index, 1)
      autoActions.value.splice(targetIndex, 0, moved)
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

    const eligibleActions = autoActions.value.filter(
      (action) =>
        action.triggerType === TriggerType.SCHEDULED &&
        action.enabled &&
        action.triggerConfig.useGlobalTimer &&
        (!action.triggerConfig.onlyDuringLive || isLive.value) &&
        (!action.triggerConfig.ignoreTianXuan || !isTianXuanActive.value),
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
    const targetAction = autoActions.value.find((a) => a.id === actionId)
    if (
      !targetAction ||
      targetAction.triggerType !== TriggerType.SCHEDULED ||
      !targetAction.triggerConfig.useGlobalTimer
    ) {
      console.warn(
        `[AutoAction] setNextGlobalAction: 无法设置 ID 为 ${actionId} 的操作为下一个全局操作 (不存在、类型错误或未使用全局定时器)`,
      )
      return
    }
    if (globalSchedulingMode.value !== 'sequential') {
      console.warn(
        `[AutoAction] setNextGlobalAction: 只有在顺序模式下才能手动指定下一个操作。当前模式: ${globalSchedulingMode.value}`,
      )
      return
    }

    const eligibleActions = autoActions.value.filter(
      (action) =>
        action.triggerType === TriggerType.SCHEDULED &&
        action.enabled &&
        action.triggerConfig.useGlobalTimer &&
        (!action.triggerConfig.onlyDuringLive || isLive.value) &&
        (!action.triggerConfig.ignoreTianXuan || !isTianXuanActive.value),
    )

    const targetIndex = eligibleActions.findIndex((a) => a.id === actionId)

    if (targetIndex === -1) {
      console.warn(`[AutoAction] setNextGlobalAction: 指定的操作 ID ${actionId} 当前不符合执行条件，无法设置为下一个。`)
      return
    }

    lastGlobalActionIndex.value = (targetIndex - 1 + eligibleActions.length) % eligibleActions.length
    restartGlobalTimer()
  }

  function buildDefaultMockEvent(triggerType: TriggerType, overrides?: Partial<EventModel>): EventModel {
    const base: Partial<EventModel> = {
      uid: 10000,
      uname: '测试用户',
      uface: '',
      open_id: 'test-open-id',
      ouid: 'test-ouid',
      time: Math.floor(Date.now() / 1000),
      num: 1,
      price: 0,
      guard_level: 3,
      fans_medal_wearing_status: true,
      fans_medal_name: '测试牌子',
      fans_medal_level: 10,
    }

    let specific: Partial<EventModel> = {}
    switch (triggerType) {
      case TriggerType.DANMAKU:
        specific = { type: EventDataTypes.Message, msg: '测试弹幕消息' }
        break
      case TriggerType.GIFT:
        specific = { type: EventDataTypes.Gift, msg: '测试礼物', price: 100, num: 5 }
        break
      case TriggerType.GUARD:
        specific = { type: EventDataTypes.Guard, msg: '舰长', price: 198, guard_level: 3 }
        break
      case TriggerType.FOLLOW:
        specific = { type: EventDataTypes.Follow }
        break
      case TriggerType.ENTER:
        specific = { type: EventDataTypes.Enter }
        break
      case TriggerType.SUPER_CHAT:
        specific = { type: EventDataTypes.SC, msg: '这是一条测试SC消息', price: 50 }
        break
      default:
        specific = { type: EventDataTypes.Message, msg: '' }
    }

    return { ...base, ...specific, ...overrides } as EventModel
  }

  /**
   * 单条规则沙盒测试（支持 Dry-Run 模拟匹配与渲染预览，以及真实触发执行）
   */
  function testSingleAction(
    action: AutoActionItem,
    options?: {
      dryRun?: boolean
      mockEvent?: Partial<EventModel>
      mockPointOrder?: Partial<PointOrderRedeemedHubEvent>
    },
  ): SingleActionTestResult {
    const dryRun = options?.dryRun ?? true
    const triggerType = action.triggerType
    const effectiveRoomId = roomId.value || 10000

    let event: EventModel | null = null
    let extraVars: Record<string, unknown> | undefined

    if (triggerType === TriggerType.POINT_REDEEM) {
      const order = normalizePointRedeemEvent({
        OrderId: 99999,
        GoodsId: 1,
        GoodsName: '测试整活道具',
        GoodsType: 0,
        Count: 1,
        Point: 100,
        IsFree: false,
        BuyerName: options?.mockEvent?.uname || '测试用户',
        BuyerUid: options?.mockEvent?.uid || 10000,
        BuyerOpenId: 'test-open-id',
        Remark: '测试下单备注',
        SelectedSubItems: ['默认款式'],
        Timestamp: Date.now(),
        ...options?.mockPointOrder,
      })
      event = {
        ...buildDefaultMockEvent(TriggerType.GIFT, options?.mockEvent),
        uname: order.buyerName,
        uid: order.buyerUid,
        msg: order.goodsName,
        num: order.count,
        price: order.point,
      }
      extraVars = { pointOrder: order, live: buildLiveVariables() }
    } else if (triggerType === TriggerType.SONG_REQUEST || triggerType === TriggerType.SONG_START) {
      const mockSong = buildMockSongRequestEvent({
        requester: options?.mockEvent?.uname || '测试观众',
        requesterUid: options?.mockEvent?.uid || 10000,
      })
      event = {
        ...buildDefaultMockEvent(TriggerType.DANMAKU, options?.mockEvent),
        uname: mockSong.requester,
        uid: mockSong.requesterUid,
        msg: mockSong.name,
      }
      extraVars = { song: mockSong, live: buildLiveVariables() }
    } else if (LIFECYCLE_TRIGGER_TYPES.has(triggerType)) {
      extraVars = {
        live: buildLiveVariables(),
        system: buildSystemMockVariables(triggerType),
      }
    } else if (triggerType !== TriggerType.SCHEDULED) {
      event = buildDefaultMockEvent(triggerType, options?.mockEvent)
      extraVars = { live: buildLiveVariables() }
    } else {
      extraVars = { live: buildLiveVariables() }
    }

    // 1. 触发条件校验
    if (event) {
      if (triggerType === TriggerType.DANMAKU && !matchesDanmakuTrigger(action, event.msg || '')) {
        return { matched: false, reason: '弹幕内容未命中关键词或命中了屏蔽词', executed: false }
      }
      if (triggerType === TriggerType.GIFT && !matchesGiftTrigger(action, event)) {
        return { matched: false, reason: '礼物被过滤规则拦截（免费/黑名单/白名单/最低价值）', executed: false }
      }
      if (triggerType === TriggerType.ENTER && !matchesEnterTrigger(action, event)) {
        return { matched: false, reason: '入场用户未满足筛选条件（黑/白名单、大航海或勋章等级）', executed: false }
      }
      if (triggerType === TriggerType.SUPER_CHAT && !matchesSuperChatTrigger(action, event)) {
        return { matched: false, reason: 'SC 金额不在设定的价格区间内', executed: false }
      }
      if (triggerType === TriggerType.GUARD && !matchesGuardTrigger(action, event)) {
        return { matched: false, reason: '上舰等级未包含在目标大航海等级内', executed: false }
      }
      if (triggerType === TriggerType.POINT_REDEEM && extraVars?.pointOrder) {
        if (!matchesPointRedeemTrigger(action, extraVars.pointOrder as ReturnType<typeof normalizePointRedeemEvent>)) {
          return { matched: false, reason: '兑换商品未满足过滤条件（免费/商品 ID/名称关键词）', executed: false }
        }
      }
      if (!checkUserFilters(action, event)) {
        return { matched: false, reason: '用户未满足通用筛选（佩戴粉丝勋章或大航海要求）', executed: false }
      }
    }

    // 2. 构建沙盒上下文（dryRun 读取只读隔离，不污染真实存储）
    const context = buildExecutionContext(event, effectiveRoomId, triggerType, extraVars, { dryRun: true })
    if (triggerType === TriggerType.GUARD && event && context.variables.guard) {
      const picked = pickGuardGiftCode(action, event.guard_level)
      if (picked) {
        context.variables.guard.giftCode = picked.code
        context.variables.guard.selectedGiftCode = picked
      }
    }

    // 3. 逻辑表达式校验与求值
    if (action.logicalExpression?.trim()) {
      const syntaxErr = validateLogicalExpression(action.logicalExpression)
      if (syntaxErr) {
        return { matched: false, reason: `逻辑表达式语法错误：${syntaxErr}`, executed: false, error: syntaxErr }
      }
      if (event && !evaluateExpression(action.logicalExpression, context)) {
        return { matched: false, reason: '高级逻辑表达式返回 false，规则被跳过', executed: false }
      }
    }

    // 4. 模板渲染预览
    const needsTemplate =
      action.actionType === ActionType.SEND_DANMAKU || action.actionType === ActionType.SEND_PRIVATE_MSG
    let renderedText: string | undefined
    if (needsTemplate) {
      const rendered = processTemplate(action, context, { useRandomTemplate: true })
      if (!rendered) {
        return { matched: false, reason: '模板内容为空，无法生成消息', executed: false }
      }
      renderedText = rendered
    } else if (action.actionType === ActionType.SEND_NOTIFICATION) {
      const rawTitle = action.actionConfig.notificationTitle?.trim()
      const title = rawTitle ? evaluateTemplateExpressions(rawTitle, context).trim() : action.name || '自动提醒'
      const body = processTemplate(action, context, { useRandomTemplate: true, defaultValue: '' })?.trim() ?? ''
      if (!title && !body) {
        return { matched: false, reason: '通知标题与正文不能同时为空', executed: false }
      }
      renderedText = `[${title}] ${body}`.trim()
    } else if (action.actionType === ActionType.OBS_NOTIFY) {
      const body = processTemplate(action, context, { useRandomTemplate: true })?.trim()
      if (!body) {
        return { matched: false, reason: 'OBS 浮窗通知内容不能为空', executed: false }
      }
      const rawTitle = action.actionConfig.obsNotifyTitle?.trim()
      const title = rawTitle ? evaluateTemplateExpressions(rawTitle, context).trim() : action.name || '直播提醒'
      renderedText = `[OBS 通知] ${title}: ${body}`
    } else if (action.actionType === ActionType.SPEAK_TTS) {
      const text = processTemplate(action, context, { useRandomTemplate: true })?.trim()
      if (!text) {
        return { matched: false, reason: 'TTS 语音播报内容不能为空', executed: false }
      }
      renderedText = `朗读：${text}`
    } else if (action.actionType === ActionType.SEND_WEBHOOK) {
      const rawUrl = action.actionConfig.webhookUrl?.trim()
      if (!rawUrl) {
        return { matched: false, reason: '尚未配置 Webhook URL', executed: false }
      }
      const renderedUrl = evaluateTemplateExpressions(rawUrl, context).trim()
      renderedText = `${action.actionConfig.webhookMethod ?? 'POST'} ${renderedUrl}`
    } else if (action.actionType === ActionType.PLAY_AUDIO) {
      renderedText = action.actionConfig.audioSource ? `播放音效：${action.actionConfig.audioSource}` : '未配置音效来源'
      if (!action.actionConfig.audioSource) {
        return { matched: false, reason: '尚未配置音效文件路径或 URL', executed: false }
      }
    } else if (action.actionType === ActionType.PNGTUBER_EXPRESSION) {
      renderedText = `切换 PNGtuber 表情：${action.actionConfig.pngtuberExpressionId || '未选择'} (${action.actionConfig.pngtuberDurationMs ?? 5000}ms)`
    } else if (OBS_ACTION_TYPES.has(action.actionType)) {
      renderedText = `触发 OBS 动作：${action.actionType}`
    } else if (VTS_ACTION_TYPES.has(action.actionType)) {
      renderedText = `触发 VTS 动作：${action.actionType}`
    }

    if (dryRun) {
      return { matched: true, renderedText, executed: false }
    }

    // 5. 真实触发前置检查
    if (needsTemplate) {
      const biliCookie = useBiliCookie()
      if (!biliCookie.isCookieValid) {
        return { matched: true, renderedText, executed: false, error: 'B 站 Cookie 未就绪或无效，无法真实发送' }
      }
      if (!roomId.value && action.actionType === ActionType.SEND_DANMAKU) {
        return { matched: true, renderedText, executed: false, error: '尚未绑定直播间 ID，无法发送弹幕' }
      }
    } else if (VTS_ACTION_TYPES.has(action.actionType)) {
      if (!canUseVts()) {
        return { matched: true, renderedText, executed: false, error: 'VTS 动作仅在桌面客户端中可执行' }
      }
      if (!useVtsStore().connected) {
        return { matched: true, renderedText, executed: false, error: 'VTube Studio 未连接' }
      }
    }

    executeActions([action], event, triggerType, effectiveRoomId, runtimeState.value, scheduledHandlers, {
      isTest: true,
      customContextBuilder: (ev, rid, tt, act) => {
        const realCtx = buildExecutionContext(ev, rid, tt, extraVars)
        if (tt === TriggerType.GUARD && ev && realCtx.variables.guard) {
          const picked = pickGuardGiftCode(act, ev.guard_level)
          if (picked) {
            realCtx.variables.guard.giftCode = picked.code
            realCtx.variables.guard.selectedGiftCode = picked
          }
        }
        return realCtx
      },
    })

    return { matched: true, renderedText, executed: true }
  }

  /**
   * 手动触发指定类型的测试逻辑
   */
  function triggerTestActionByType(triggerType: TriggerType, testUid?: number) {
    if (!enabledTriggerTypes.value[triggerType]) {
      toast.warning('该触发类型的总开关当前已关闭，请先开启后再测试')
      return
    }

    const actionsToTest = autoActions.value.filter(
      (a) => a.triggerType === triggerType && a.enabled && enabledTriggerTypes.value[triggerType],
    )

    if (actionsToTest.length === 0) {
      toast.warning('当前分类下没有已启用的规则可供测试')
      return
    }

    const needsCookie = actionsToTest.some(
      (a) => a.actionType === ActionType.SEND_DANMAKU || a.actionType === ActionType.SEND_PRIVATE_MSG,
    )
    if (needsCookie && !useBiliCookie().isCookieValid) {
      toast.error('当前分类包含发弹幕/私信规则，请先在账号设置中配置有效 Cookie')
      return
    }

    if (triggerType === TriggerType.POINT_REDEEM) {
      const testPayload: PointOrderRedeemedHubEvent = {
        OrderId: 99999,
        GoodsId: 1,
        GoodsName: '测试整活道具',
        GoodsType: 0,
        Count: 1,
        Point: 100,
        IsFree: false,
        BuyerName: '测试用户',
        BuyerUid: testUid || 10000,
        BuyerOpenId: 'test-open-id',
        Remark: '测试下单备注',
        SelectedSubItems: ['默认款式'],
        Timestamp: Date.now(),
      }
      pointRedeemModule.processPointRedeem(testPayload, autoActions.value, runtimeState.value, true)
      toast.success('已发送积分兑换测试事件')
      return
    }

    if (triggerType === TriggerType.SONG_REQUEST || triggerType === TriggerType.SONG_START) {
      const mockSong = buildMockSongRequestEvent({
        requesterUid: testUid || 10000,
      })
      songRequestModule.processSongRequestTrigger(triggerType, mockSong, autoActions.value, runtimeState.value, true)
      toast.success(triggerType === TriggerType.SONG_REQUEST ? '已发送收到点歌测试事件' : '已发送开始演唱测试事件')
      return
    }

    if (LIFECYCLE_TRIGGER_TYPES.has(triggerType)) {
      dispatchLifecycleTrigger(triggerType, buildSystemMockVariables(triggerType), true)
      toast.success(`已触发 ${actionsToTest.length} 条状态规则的测试执行`)
      return
    }

    if (triggerType === TriggerType.SCHEDULED) {
      if (!roomId.value) {
        toast.warning('尚未获取到直播间 ID，无法触发定时消息')
        return
      }
      executeActions(
        [actionsToTest[0]],
        null,
        TriggerType.SCHEDULED,
        roomId.value,
        runtimeState.value,
        scheduledHandlers,
        {
          isTest: true,
        },
      )
      toast.success(`已触发定时规则「${actionsToTest[0].name || '未命名'}」`)
      return
    }

    const testEvent = buildDefaultMockEvent(triggerType, {
      uid: testUid || 10000,
      guard_level: Math.floor(Math.random() * 3) + 1,
      fans_medal_level: Math.floor(Math.random() * 30) + 1,
      ...(triggerType === TriggerType.SUPER_CHAT ? { price: Math.floor(Math.random() * 100) + 30 } : {}),
    })
    processEvent(testEvent, triggerType, true)
    toast.success(`已向 ${actionsToTest.length} 条启用规则发送测试事件`)
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
    duplicateAutoAction,
    removeAutoAction,
    toggleAutoAction,
    moveAction,
    setNextGlobalAction,
    restartGlobalTimer,
    syncScheduledTimers,
    getScheduledTimerInfo,
    setTriggerTypeEnabled,
    startIndividualTimer,
    stopIndividualTimer,
    stopAllIndividualScheduledActions,
    startIndividualScheduledActions,
    triggerTestActionByType,
    testSingleAction,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAutoAction, import.meta.hot))
}

export { ActionType, AutoActionItem, KeywordMatchType, Priority, TriggerType }
