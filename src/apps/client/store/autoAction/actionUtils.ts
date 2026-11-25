import type { Ref } from 'vue'
import { toast } from 'vue-sonner'

import type { EventModel } from '@/api/client-types'
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import { canUseVts } from '@/shared/config'

import { useBiliCookie } from '../useBiliCookie'
import { evaluateTemplateExpressions } from './expressionEvaluator'
import type { AutoActionItem, ExecutionContext, RuntimeState, TriggerType } from './types'
import { ActionType, Priority } from './types'
import { buildExecutionContext, evaluateExpression, getRandomTemplate, getSequentialTemplate } from './utils'
import { logCommandHistory, logDanmakuHistory, logPrivateMsgHistory } from './utils/historyLogger'

export interface ExecuteActionHandlers {
  sendLiveDanmaku?: (roomId: number, message: string) => Promise<boolean>
  sendPrivateMessage?: (userId: number, message: string) => Promise<boolean>
}

export interface ExecuteActionOptions {
  customContextBuilder?: (
    event: EventModel | null,
    roomId: number,
    triggerType: TriggerType,
    action: AutoActionItem,
  ) => ExecutionContext
  customFilters?: Array<(action: AutoActionItem, context: ExecutionContext) => boolean>
  skipUserFilters?: boolean
  skipCooldownCheck?: boolean
  useSequentialTemplate?: boolean
  isTest?: boolean
  onSuccess?: (action: AutoActionItem, context: ExecutionContext) => void
  onError?: (action: AutoActionItem, context: ExecutionContext, error: unknown) => void
}

export function filterValidActions(
  actions: AutoActionItem[],
  triggerType: TriggerType,
  isLive: Ref<boolean>,
  isTianXuanActive?: Ref<boolean>,
  options?: {
    actionType?: ActionType
    customFilter?: (action: AutoActionItem) => boolean
    enabledTriggerTypes?: Ref<Record<TriggerType, boolean>>
    isTest?: boolean
  },
): AutoActionItem[] {
  return actions.filter((action) => {
    if (action.triggerType !== triggerType || !action.enabled) return false
    if (options?.enabledTriggerTypes && !options.enabledTriggerTypes.value[triggerType]) return false
    if (options?.isTest) return true
    if (action.triggerConfig.onlyDuringLive && !isLive.value) return false
    if (isTianXuanActive && action.triggerConfig.ignoreTianXuan && isTianXuanActive.value) return false
    if (options?.actionType && action.actionType !== options.actionType) return false
    if (options?.customFilter && !options.customFilter(action)) return false
    return true
  })
}

export function checkUserFilters(action: AutoActionItem, event: EventModel): boolean {
  if (!action.triggerConfig.userFilterEnabled) return true
  if (action.triggerConfig.requireMedal && !event.fans_medal_wearing_status) return false
  if (action.triggerConfig.requireCaptain && !event.guard_level) return false
  return true
}

export function checkCooldown(action: AutoActionItem, runtimeState: RuntimeState): boolean {
  if (action.ignoreCooldown) return true
  const now = Date.now()
  const lastExecTime = runtimeState.lastExecutionTime[action.id] || 0
  const cooldownMs = (action.actionConfig.cooldownSeconds || 0) * 1000
  return now - lastExecTime >= cooldownMs
}

function getUserRepeatKey(event: EventModel | null): string {
  if (!event) return ''
  if (event.uid) return String(event.uid)
  return event.ouid || event.uname || ''
}

function hasSentToUser(action: AutoActionItem, event: EventModel | null, runtimeState: RuntimeState): boolean {
  if (!action.triggerConfig.preventRepeat) return false
  const userKey = getUserRepeatKey(event)
  if (!userKey) return false
  return Boolean(runtimeState.sentActionUsers?.[action.id]?.has(userKey))
}

function markSentToUser(action: AutoActionItem, event: EventModel | null, runtimeState: RuntimeState): void {
  if (!action.triggerConfig.preventRepeat) return
  const userKey = getUserRepeatKey(event)
  if (!userKey) return
  runtimeState.sentActionUsers ??= {}
  runtimeState.sentActionUsers[action.id] ??= new Set()
  runtimeState.sentActionUsers[action.id].add(userKey)
}

export function processTemplate(
  action: AutoActionItem,
  context: ExecutionContext,
  options?: {
    useRandomTemplate?: boolean
    useSequentialTemplate?: boolean
    runtimeState?: RuntimeState
    defaultValue?: string
  },
): string | null {
  if (!action.template || action.template.trim() === '') {
    console.warn(`跳过操作 "${action.name || '未命名'}"：未设置有效模板`)
    return options?.defaultValue || null
  }

  try {
    let template: string
    if (options?.useSequentialTemplate) {
      const state = options.runtimeState
      const currentIdx = state?.sequentialLineIndex?.[action.id] ?? 0
      const picked = getSequentialTemplate(action.template, currentIdx)
      if (!picked) return options?.defaultValue || null
      if (state) {
        state.sequentialLineIndex ??= {}
        state.sequentialLineIndex[action.id] = picked.nextIndex
      }
      template = picked.line
    } else if (options?.useRandomTemplate !== false) {
      const randomTemplate = getRandomTemplate(action.template)
      if (!randomTemplate) return options?.defaultValue || null
      template = randomTemplate
    } else {
      template = action.template
    }
    return evaluateTemplateExpressions(template, context)
  } catch (error) {
    console.error(`模板处理错误 (${action.name || action.id}):`, error)
    return options?.defaultValue || null
  }
}

// 全局弹幕发送速率限制器
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_SENDS = 12
const sendTimestamps: number[] = []

function canSendWithRateLimit(): boolean {
  const now = Date.now()
  while (sendTimestamps.length > 0 && now - sendTimestamps[0] > RATE_LIMIT_WINDOW_MS) {
    sendTimestamps.shift()
  }
  return sendTimestamps.length < RATE_LIMIT_MAX_SENDS
}

function scheduleWithDelay(delaySeconds: number | undefined, fn: () => void) {
  if (delaySeconds && delaySeconds > 0) {
    setTimeout(fn, delaySeconds * 1000)
  } else {
    fn()
  }
}

async function sendAndLogDanmaku(
  sendHandler: (roomId: number, message: string) => Promise<boolean>,
  action: AutoActionItem,
  roomId: number,
  message: string,
): Promise<boolean> {
  if (!canSendWithRateLimit()) {
    console.warn(`[AutoAction] 速率限制：每分钟最多 ${RATE_LIMIT_MAX_SENDS} 条弹幕，跳过: ${action.name || action.id}`)
    void logDanmakuHistory(action.id, action.name || '未命名操作', message, roomId, false, '速率限制')
    return false
  }
  try {
    sendTimestamps.push(Date.now())
    const success = await sendHandler(roomId, message)
    void logDanmakuHistory(
      action.id,
      action.name || '未命名操作',
      message,
      roomId,
      success,
      success ? undefined : '发送失败',
    )
    if (!success) {
      toast.error('自动回复发送失败', { description: message, duration: 5000 })
    }
    return success
  } catch (err) {
    console.error(`[AutoAction] 发送弹幕失败 (${action.name || action.id}):`, err)
    void logDanmakuHistory(
      action.id,
      action.name || '未命名操作',
      message,
      roomId,
      false,
      err instanceof Error ? err.message : String(err),
    )
    return false
  }
}

function runDanmakuAction(
  action: AutoActionItem,
  context: ExecutionContext,
  roomId: number,
  runtimeState: RuntimeState,
  handlers: ExecuteActionHandlers,
  options: ExecuteActionOptions | undefined,
  isCookieValid: boolean,
) {
  const message = processTemplate(action, context, {
    useSequentialTemplate: options?.useSequentialTemplate,
    runtimeState,
  })
  if (!message) return

  if (!isCookieValid) {
    void logDanmakuHistory(action.id, action.name || '未命名操作', message, roomId, false, 'Cookie 未就绪或无效')
    toast.error('自动回复发送失败', { description: 'Cookie 未就绪或无效', duration: 5000 })
    return
  }

  if (!handlers.sendLiveDanmaku) {
    console.warn(`[AutoAction] 未提供弹幕发送处理器，无法执行操作: ${action.name || action.id}`)
    void logDanmakuHistory(action.id, action.name || '未命名操作', message, roomId, false, '未提供弹幕发送处理器')
    return
  }

  runtimeState.lastExecutionTime[action.id] = Date.now()
  const sendHandler = handlers.sendLiveDanmaku
  scheduleWithDelay(action.actionConfig.delaySeconds, () => {
    void sendAndLogDanmaku(sendHandler, action, roomId, message).then((ok) => {
      if (ok) options?.onSuccess?.(action, context)
    })
  })
}

function runPrivateMsgAction(
  action: AutoActionItem,
  event: EventModel | null,
  context: ExecutionContext,
  runtimeState: RuntimeState,
  handlers: ExecuteActionHandlers,
  options: ExecuteActionOptions | undefined,
  isCookieValid: boolean,
) {
  const message = processTemplate(action, context, {
    useSequentialTemplate: options?.useSequentialTemplate,
    runtimeState,
  })
  if (!message) return

  if (!isCookieValid) {
    void logPrivateMsgHistory(
      action.id,
      action.name || '未命名操作',
      message,
      event?.uid ?? 0,
      false,
      'Cookie 未就绪或无效',
    )
    toast.error('私信发送失败', { description: 'Cookie 未就绪或无效', duration: 5000 })
    return
  }
  if (!handlers.sendPrivateMessage || !event?.uid) {
    console.warn(`[AutoAction] 未提供私信发送处理器或事件缺少UID，无法执行操作: ${action.name || action.id}`)
    void logPrivateMsgHistory(
      action.id,
      action.name || '未命名操作',
      message,
      event?.uid ?? 0,
      false,
      '未提供私信发送处理器或缺少目标 UID',
    )
    return
  }

  runtimeState.lastExecutionTime[action.id] = Date.now()
  const sendPm = handlers.sendPrivateMessage
  const targetUid = event.uid

  scheduleWithDelay(action.actionConfig.delaySeconds, () => {
    void sendPm(targetUid, message)
      .then((success) => {
        void logPrivateMsgHistory(
          action.id,
          action.name || '未命名操作',
          message,
          targetUid,
          success,
          success ? undefined : '发送失败',
        )
        if (success) options?.onSuccess?.(action, context)
      })
      .catch((err) => {
        console.error(`[AutoAction] 发送私信失败 (${action.name || action.id}):`, err)
        void logPrivateMsgHistory(
          action.id,
          action.name || '未命名操作',
          message,
          targetUid,
          false,
          err instanceof Error ? err.message : String(err),
        )
      })
  })
}

function runAsyncSideEffectAction(
  action: AutoActionItem,
  context: ExecutionContext,
  runtimeState: RuntimeState,
  options: ExecuteActionOptions | undefined,
  executor: () => Promise<string>,
  fallbackTitle: string,
) {
  runtimeState.lastExecutionTime[action.id] = Date.now()
  scheduleWithDelay(action.actionConfig.delaySeconds, () => {
    void (async () => {
      let failure: unknown
      let summary = fallbackTitle
      try {
        summary = await executor()
        options?.onSuccess?.(action, context)
      } catch (cause) {
        failure = cause
        console.error(`[AutoAction] ${action.actionType} 执行失败:`, cause)
        options?.onError?.(action, context, cause)
        if (options?.isTest) toast.error(cause instanceof Error ? cause.message : String(cause))
      }
      await logCommandHistory(
        action.id,
        action.name || fallbackTitle,
        summary,
        !failure,
        failure ? (failure instanceof Error ? failure.message : String(failure)) : undefined,
        action.actionType,
      )
    })().catch((err) => console.error(`[AutoAction] 记录 ${action.actionType} 历史失败:`, err))
  })
}

async function executeVtsAction(action: AutoActionItem): Promise<string> {
  if (!canUseVts()) throw new Error('非桌面客户端环境，跳过 VTS 动作')
  const vts = useVtsStore()
  if (!vts.connected) throw new Error('VTS 未连接')

  const cfg = action.actionConfig as Record<string, unknown>
  switch (action.actionType) {
    case ActionType.VTS_HOTKEY: {
      const hotkeyID = cfg.vtsHotkeyId as string | undefined
      if (!hotkeyID) throw new Error(`VTS_HOTKEY 缺少 vtsHotkeyId: ${action.name || action.id}`)
      await vts.triggerHotkey(hotkeyID)
      return `VTS_HOTKEY ${hotkeyID}`
    }
    case ActionType.VTS_EXPRESSION: {
      const file = cfg.vtsExpressionFile as string | undefined
      const active = (cfg.vtsExpressionActive as boolean | undefined) ?? true
      if (!file) throw new Error(`VTS_EXPRESSION 缺少 vtsExpressionFile: ${action.name || action.id}`)
      await vts.setExpression(file, active)
      return `VTS_EXPRESSION ${file} (${active ? 'on' : 'off'})`
    }
    case ActionType.VTS_PRESET: {
      const presetId = cfg.vtsPresetId as string | undefined
      if (!presetId) throw new Error(`VTS_PRESET 缺少 vtsPresetId: ${action.name || action.id}`)
      await vts.applyPreset(presetId)
      return `VTS_PRESET ${presetId}`
    }
    case ActionType.VTS_DROP_ITEM: {
      const fileName = cfg.vtsItemFileName as string | undefined
      if (!fileName) throw new Error(`VTS_DROP_ITEM 缺少 vtsItemFileName: ${action.name || action.id}`)
      await vts.dropItem(fileName, {
        x: cfg.vtsItemDropX as number | undefined,
        size: cfg.vtsItemDropSize as number | undefined,
        randomX: Boolean(cfg.vtsItemRandomX),
      })
      return `VTS_DROP_ITEM ${fileName}`
    }
    case ActionType.VTS_PARAM_ADD: {
      const paramId = cfg.vtsParamId as string | undefined
      const value = cfg.vtsParamValue as number | undefined
      const weight = cfg.vtsParamWeight as number | undefined
      const mode = (cfg.vtsParamMode as 'add' | 'set' | undefined) ?? 'add'
      if (!paramId || value === undefined) {
        throw new Error(`VTS_PARAM_ADD 缺少 vtsParamId/vtsParamValue: ${action.name || action.id}`)
      }
      await vts.injectParameters([{ id: paramId, value, weight }], { mode })
      return `VTS_PARAM_ADD ${paramId}=${value} (${mode})`
    }
    case ActionType.VTS_MACRO: {
      const macroId = cfg.vtsMacroId as string | undefined
      if (!macroId) throw new Error(`VTS_MACRO 缺少 vtsMacroId: ${action.name || action.id}`)
      await vts.runMacro(macroId)
      return `VTS_MACRO ${macroId}`
    }
    case ActionType.VTS_ACCESSORY: {
      const accessoryId = cfg.vtsAccessoryId as string | undefined
      const visible = (cfg.vtsAccessoryVisible as boolean | undefined) ?? true
      if (!accessoryId) throw new Error(`VTS_ACCESSORY 缺少 vtsAccessoryId: ${action.name || action.id}`)
      await vts.toggleAccessory(accessoryId, visible)
      return `VTS_ACCESSORY ${accessoryId} (${visible ? 'show' : 'hide'})`
    }
    case ActionType.VTS_COLOR_TINT: {
      const reset = Boolean(cfg.vtsTintReset)
      const rainbow = Boolean(cfg.vtsTintRainbow)
      const colorHex = (cfg.vtsTintColor as string | undefined) || '#ffffff'
      await vts.tintModel({ colorHex, rainbow, reset })
      return `VTS_COLOR_TINT ${reset ? 'reset' : rainbow ? 'rainbow' : colorHex}`
    }
    case ActionType.VTS_POST_PROCESSING: {
      const enabled = (cfg.vtsPostProcessingEnabled as boolean | undefined) ?? true
      const preset = cfg.vtsPostProcessingPreset as string | undefined
      const fadeTime = cfg.vtsPostProcessingFadeTime as number | undefined
      await vts.updatePostProcessing({ enabled, preset, fadeTime })
      return `VTS_POST_PROCESSING ${enabled ? preset || 'on' : 'off'}`
    }
    default:
      throw new Error(`未知 VTS 动作类型: ${action.actionType}`)
  }
}

async function executeObsAction(action: AutoActionItem): Promise<string> {
  const cfg = action.actionConfig

  // VTsuru 云端 obs-scene 子场景切换走 HTTP API，不强依赖本地 OBS 已连接
  if (action.actionType === ActionType.OBS_SCENE_SWITCH) {
    const projectId = cfg.obsSceneProjectId
    const sceneId = cfg.obsSubSceneId?.trim()
    if (!projectId || !sceneId) {
      throw new Error(`OBS_SCENE_SWITCH 缺少场景项目或子场景: ${action.name || action.id}`)
    }
    const { useObsSceneControl } = await import('@/apps/client/store/useObsSceneControl')
    await useObsSceneControl().switchSubScene(projectId, sceneId, { silent: true })
    return `OBS_SCENE_SWITCH ${projectId}:${sceneId}`
  }

  const { useOBSStore } = await import('@/apps/client/store/useOBSStore')
  const obs = useOBSStore()
  if (!obs.obsConnected) {
    throw new Error(`OBS 未连接，无法执行: ${action.name || action.actionType}`)
  }

  switch (action.actionType) {
    case ActionType.OBS_SWITCH_SCENE: {
      const sceneName = cfg.obsSceneName?.trim()
      if (!sceneName) throw new Error(`OBS_SWITCH_SCENE 缺少场景名: ${action.name || action.id}`)
      await obs.switchToScene(sceneName)
      return `OBS_SWITCH_SCENE ${sceneName}`
    }
    case ActionType.OBS_SOURCE_VISIBLE: {
      const sourceName = cfg.obsSourceName?.trim()
      if (!sourceName) throw new Error(`OBS_SOURCE_VISIBLE 缺少源名称: ${action.name || action.id}`)
      const visible = cfg.obsSourceVisible ?? true
      await obs.setSceneItemEnabledByName(sourceName, visible, cfg.obsSceneName?.trim() || undefined)
      return `OBS_SOURCE_VISIBLE ${sourceName} (${visible ? 'show' : 'hide'})`
    }
    case ActionType.OBS_FILTER_ENABLED: {
      const sourceName = cfg.obsSourceName?.trim()
      const filterName = cfg.obsFilterName?.trim()
      if (!sourceName || !filterName) {
        throw new Error(`OBS_FILTER_ENABLED 缺少源名称或滤镜名称: ${action.name || action.id}`)
      }
      const enabled = cfg.obsFilterEnabled ?? true
      await obs.setSourceFilterEnabled(sourceName, filterName, enabled)
      return `OBS_FILTER_ENABLED ${sourceName}/${filterName} (${enabled ? 'on' : 'off'})`
    }
    case ActionType.OBS_SAVE_REPLAY: {
      const res = await obs.saveReplayBuffer()
      if (!res.ok) throw new Error(res.message)
      return `OBS_SAVE_REPLAY ${res.savedPath || 'ok'}`
    }
    default:
      throw new Error(`未知 OBS 动作类型: ${action.actionType}`)
  }
}

export function executeActions(
  actions: AutoActionItem[],
  event: EventModel | null,
  triggerType: TriggerType,
  roomId: number,
  runtimeState: RuntimeState,
  handlers: ExecuteActionHandlers,
  options?: ExecuteActionOptions,
) {
  if (!roomId || actions.length === 0) return
  const biliCookie = useBiliCookie()

  // 按优先级升序排序（数值越小优先级越高：0=最高 .. 4=最低）
  const sortedActions = [...actions].sort(
    (a, b) => Number(a.priority ?? Priority.NORMAL) - Number(b.priority ?? Priority.NORMAL),
  )

  for (const action of sortedActions) {
    const context = options?.customContextBuilder
      ? options.customContextBuilder(event, roomId, triggerType, action)
      : buildExecutionContext(event, roomId, triggerType)

    if (!options?.isTest) {
      if (options?.customFilters && !options.customFilters.every((filter) => filter(action, context))) {
        continue
      }
      if (!options?.skipUserFilters && event && !checkUserFilters(action, event)) {
        continue
      }
      if (action.logicalExpression && event && !evaluateExpression(action.logicalExpression, context)) {
        continue
      }
      if (!options?.skipCooldownCheck && !checkCooldown(action, runtimeState)) {
        continue
      }
      if (hasSentToUser(action, event, runtimeState)) {
        continue
      }
      markSentToUser(action, event, runtimeState)
    }

    switch (action.actionType) {
      case ActionType.SEND_DANMAKU:
        runDanmakuAction(action, context, roomId, runtimeState, handlers, options, biliCookie.isCookieValid)
        break

      case ActionType.SEND_PRIVATE_MSG:
        runPrivateMsgAction(action, event, context, runtimeState, handlers, options, biliCookie.isCookieValid)
        break

      case ActionType.EXECUTE_COMMAND: {
        const command = processTemplate(action, context)
        if (command) {
          runtimeState.lastExecutionTime[action.id] = Date.now()
          const msg = '出于安全考虑，当前版本暂不支持执行自定义命令'
          void logCommandHistory(action.id, action.name || '自定义命令', command, false, msg)
          if (options?.isTest) toast.warning(msg)
        }
        break
      }

      case ActionType.PLAY_AUDIO:
        runAsyncSideEffectAction(
          action,
          context,
          runtimeState,
          options,
          async () => {
            const { executePlayAudio } = await import('./modules/audioPlayer')
            const source = await executePlayAudio(action)
            return `PLAY_AUDIO ${source}`
          },
          '播放音效',
        )
        break

      case ActionType.PNGTUBER_EXPRESSION:
        runAsyncSideEffectAction(
          action,
          context,
          runtimeState,
          options,
          async () => {
            const { executePngtuberExpression } = await import('./modules/pngtuber')
            await executePngtuberExpression(action)
            return `PNGtuber ${action.actionConfig.pngtuberChannel || 'default'} / ${action.actionConfig.pngtuberExpressionId || ''} (${action.actionConfig.pngtuberDurationMs ?? 5000}ms)`
          },
          'PNGtuber 表情',
        )
        break

      case ActionType.VTS_HOTKEY:
      case ActionType.VTS_EXPRESSION:
      case ActionType.VTS_PRESET:
      case ActionType.VTS_DROP_ITEM:
      case ActionType.VTS_PARAM_ADD:
      case ActionType.VTS_MACRO:
      case ActionType.VTS_ACCESSORY:
      case ActionType.VTS_COLOR_TINT:
      case ActionType.VTS_POST_PROCESSING:
        runAsyncSideEffectAction(
          action,
          context,
          runtimeState,
          options,
          () => executeVtsAction(action),
          action.actionType,
        )
        break

      case ActionType.OBS_SWITCH_SCENE:
      case ActionType.OBS_SCENE_SWITCH:
      case ActionType.OBS_SOURCE_VISIBLE:
      case ActionType.OBS_FILTER_ENABLED:
      case ActionType.OBS_SAVE_REPLAY:
        runAsyncSideEffectAction(
          action,
          context,
          runtimeState,
          options,
          () => executeObsAction(action),
          action.actionType,
        )
        break

      case ActionType.SEND_NOTIFICATION:
        runAsyncSideEffectAction(
          action,
          context,
          runtimeState,
          options,
          async () => {
            const { executeSendNotificationAction } = await import('./modules/notificationActions')
            return executeSendNotificationAction(action, context, runtimeState, options?.useSequentialTemplate)
          },
          '发送通知',
        )
        break

      case ActionType.OBS_NOTIFY:
        runAsyncSideEffectAction(
          action,
          context,
          runtimeState,
          options,
          async () => {
            const { executeObsNotifyAction } = await import('./modules/notificationActions')
            return executeObsNotifyAction(action, context, runtimeState, options?.useSequentialTemplate)
          },
          'OBS 浮窗通知',
        )
        break

      case ActionType.SPEAK_TTS:
        runAsyncSideEffectAction(
          action,
          context,
          runtimeState,
          options,
          async () => {
            const { executeSpeakTtsAction } = await import('./modules/notificationActions')
            return executeSpeakTtsAction(action, context, runtimeState, options?.useSequentialTemplate)
          },
          'TTS 语音播报',
        )
        break

      case ActionType.SEND_WEBHOOK:
        runAsyncSideEffectAction(
          action,
          context,
          runtimeState,
          options,
          async () => {
            const { executeSendWebhookAction } = await import('./modules/notificationActions')
            return executeSendWebhookAction(action, context, runtimeState, options?.useSequentialTemplate)
          },
          'Webhook 请求',
        )
        break

      case ActionType.BAN_USER:
        runAsyncSideEffectAction(
          action,
          context,
          runtimeState,
          options,
          async () => {
            if (!event || !event.uid || event.uid <= 0) {
              throw new Error('触发事件缺少有效的用户 UID，无法执行禁言')
            }
            if (action.actionConfig.banSkipGuard !== false && (event.guard_level ?? 0) > 0) {
              return `已跳过大航海用户 ${event.uname} (${event.uid})`
            }
            const { banLiveRoomUser } = await import('@/apps/client/api/room-control')
            const hours = action.actionConfig.banHours ?? 1
            await banLiveRoomUser(roomId, event.uid, hours, event.msg || '')
            const label = hours === -1 ? '永久' : hours === 0 ? '本场' : `${hours}小时`
            return `已禁言 ${event.uname || event.uid} (${label})`
          },
          '直播间禁言',
        )
        break

      case ActionType.PUBLISH_DYNAMIC:
        runAsyncSideEffectAction(
          action,
          context,
          runtimeState,
          options,
          async () => {
            const text = processTemplate(action, context)
            const { useBiliDynamicAutomation } = await import('@/apps/client/store/useBiliDynamicAutomation')
            const dynStore = useBiliDynamicAutomation()
            const dynId = await dynStore.publishLiveDynamic(text, {
              pin: action.actionConfig.dynamicPinOnPublish,
              recordAsLivePost: action.actionConfig.dynamicRecordAsLivePost !== false,
              roomId,
            })
            return `已发布动态 ${dynId}`
          },
          '发布 B 站动态',
        )
        break

      case ActionType.DELETE_LIVE_DYNAMIC:
        runAsyncSideEffectAction(
          action,
          context,
          runtimeState,
          options,
          async () => {
            const { useBiliDynamicAutomation } = await import('@/apps/client/store/useBiliDynamicAutomation')
            const dynStore = useBiliDynamicAutomation()
            const res = await dynStore.cleanupLastLiveDynamic()
            return res.deleted ? `已删除开播动态 ${res.dynId}` : '无待清理开播动态'
          },
          '删除开播动态',
        )
        break

      case ActionType.SAVE_STREAM_CLIP:
        runAsyncSideEffectAction(
          action,
          context,
          runtimeState,
          options,
          async () => {
            const { useStreamClipRecorder } = await import('@/apps/client/store/useStreamClipRecorder')
            const recorder = useStreamClipRecorder()
            const label = action.actionConfig.clipLabel || action.name || '自动高光切片'
            const clip = await recorder.saveClip(label, action.actionConfig.clipDurationSeconds)
            return `已保存切片 ${clip.filePath}`
          },
          '保存直播流高光切片',
        )
        break

      default:
        console.warn(`[AutoAction] 未知的操作类型: ${action.actionType}`)
    }
  }
}
