import { nanoid } from 'nanoid'

import {
  AUTO_ACTION_USER_DATA_PREFIX,
  persistedGetJson,
  persistedListKeys,
  persistedRemoveItem,
  persistedRemoveKeys,
  persistedSetJson,
} from '@/shared/storage/persist'

import type { AutoActionItem, ExecutionContext, RuntimeState } from './types'
import { ActionType, LIFECYCLE_TRIGGER_TYPES, Priority, TriggerType } from './types'

function userDataKey(key: string): string {
  return key.startsWith(AUTO_ACTION_USER_DATA_PREFIX) ? key : `${AUTO_ACTION_USER_DATA_PREFIX}${key}`
}

// --- 定义运行时数据的前缀 (避免与页面其他 sessionStorage 冲突) ---
const RUNTIME_STORAGE_PREFIX = 'autoaction_runtime_'

/**
 * 创建默认的运行时状态
 */
export function createDefaultRuntimeState(): RuntimeState {
  return {
    lastExecutionTime: {},
    scheduledTimers: {},
    timerStartTimes: {},
    globalTimerStartTime: null,
    sentGuardPms: new Set(),
    sentActionUsers: {},
    sequentialLineIndex: {},
    aggregatedEvents: {},
  }
}

/**
 * 创建默认的自动操作项
 * @param triggerType 触发类型
 */
export function createDefaultAutoAction(triggerType: TriggerType): AutoActionItem {
  const id = `auto-action-${nanoid(8)}`

  // 根据不同触发类型设置默认模板
  const defaultTemplates: Record<TriggerType, string> = {
    [TriggerType.DANMAKU]: '收到 {{user.name}} 的弹幕: {{danmaku.msg}}',
    [TriggerType.GIFT]: '感谢 {{user.name}} 赠送的 {{gift.summary}}',
    [TriggerType.GUARD]: '感谢 {{user.name}} 开通了{{guard.levelName}}！',
    [TriggerType.FOLLOW]: '感谢 {{user.name}} 的关注！',
    [TriggerType.ENTER]: '欢迎 {{user.name}} 进入直播间',
    [TriggerType.SCHEDULED]: '这是一条定时消息，当前时间: {{date.formatted}}',
    [TriggerType.SUPER_CHAT]: '感谢 {{user.name}} 的SC!',
    [TriggerType.POINT_REDEEM]: '感谢 {{user.name}} 兑换了 {{pointOrder.goodsName}} x{{pointOrder.count}}！',
    [TriggerType.SONG_REQUEST]: '已收到 {{song.requester}} 点歌《{{song.name}}》，当前排第 {{song.queueCount}} 位！',
    [TriggerType.SONG_START]: '现在开始演唱《{{song.name}}》（点歌：{{song.requester}}）',
    [TriggerType.LIVE_START]: '直播已开始：{{live.title}}（{{date.formatted}}）',
    [TriggerType.LIVE_END]: '直播已结束（{{date.formatted}}）',
    [TriggerType.DANMAKU_DISCONNECTED]: '弹幕连接异常：{{system.reason}}',
    [TriggerType.COOKIE_INVALID]: '账号 {{system.accountName}} 的 B 站 Cookie 已失效，请及时重新登录',
  }

  // 根据不同触发类型设置默认名称
  const defaultNames: Record<TriggerType, string> = {
    [TriggerType.DANMAKU]: '弹幕回复',
    [TriggerType.GIFT]: '礼物感谢',
    [TriggerType.GUARD]: '舰长感谢',
    [TriggerType.FOLLOW]: '关注感谢',
    [TriggerType.ENTER]: '入场欢迎',
    [TriggerType.SCHEDULED]: '定时消息',
    [TriggerType.SUPER_CHAT]: 'SC感谢',
    [TriggerType.POINT_REDEEM]: '积分兑换互动',
    [TriggerType.SONG_REQUEST]: '点歌成功反馈',
    [TriggerType.SONG_START]: '开始演唱播报',
    [TriggerType.LIVE_START]: '开播自动提醒',
    [TriggerType.LIVE_END]: '下播自动提醒',
    [TriggerType.DANMAKU_DISCONNECTED]: '弹幕断连告警',
    [TriggerType.COOKIE_INVALID]: 'Cookie 失效告警',
  }

  const isLifecycle = LIFECYCLE_TRIGGER_TYPES.has(triggerType)
  const defaultActionType =
    triggerType === TriggerType.GUARD
      ? ActionType.SEND_PRIVATE_MSG
      : isLifecycle
        ? ActionType.SEND_NOTIFICATION
        : ActionType.SEND_DANMAKU

  return {
    id,
    name: defaultNames[triggerType] || '新建自动操作',
    enabled: true,
    triggerType,
    actionType: defaultActionType,
    priority: Priority.NORMAL,
    template: defaultTemplates[triggerType] || '默认模板',
    logicalExpression: '',
    executeCommand: '',
    ignoreCooldown: false,
    triggerConfig: {
      onlyDuringLive: !isLifecycle,
      ignoreTianXuan: !isLifecycle,
      userFilterEnabled: false,
      requireMedal: false,
      requireCaptain: false,
      preventRepeat: triggerType === TriggerType.GUARD,
      filterMode:
        triggerType === TriggerType.GIFT || triggerType === TriggerType.ENTER ? 'none' : undefined,
      scFilterMode: triggerType === TriggerType.SUPER_CHAT ? 'none' : undefined,
      useGlobalTimer: triggerType === TriggerType.SCHEDULED ? false : undefined,
      intervalSeconds: triggerType === TriggerType.SCHEDULED ? 300 : undefined,
      schedulingMode: triggerType === TriggerType.SCHEDULED ? 'random' : undefined,
    },
    actionConfig: {
      delaySeconds: 0,
      cooldownSeconds: isLifecycle ? 15 : 5,
      maxUsersPerMsg: 5,
      maxItemsPerUser: 3,
      audioVolume: 0.8,
      audioWaitForEnd: false,
      notificationShowDesktop: true,
      notificationShowToast: true,
      notificationPlaySound: true,
      notificationToastLevel: isLifecycle && triggerType !== TriggerType.LIVE_START && triggerType !== TriggerType.LIVE_END ? 'warning' : 'info',
      notificationSoundPreset:
        triggerType === TriggerType.DANMAKU_DISCONNECTED || triggerType === TriggerType.COOKIE_INVALID ? 'alert' : 'chime',
    },
  }
}

/**
 * 处理模板字符串
 * @param template 模板字符串
 */
export function getRandomTemplate(template: string): string | null {
  if (!template) return null
  const lines = template
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  if (lines.length === 0) return null
  if (lines.length === 1) return lines[0]
  return lines[Math.floor(Math.random() * lines.length)]
}

/**
 * 顺序选取多行模板中的下一行
 */
export function getSequentialTemplate(template: string, currentIndex = 0): { line: string; nextIndex: number } | null {
  if (!template) return null
  const lines = template
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  if (lines.length === 0) return null
  const safeIndex = ((currentIndex % lines.length) + lines.length) % lines.length
  return {
    line: lines[safeIndex],
    nextIndex: (safeIndex + 1) % lines.length,
  }
}

const VALID_JS_IDENTIFIER_RE = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/

/**
 * 仅做语法校验，不执行表达式；返回 null 表示合法，否则返回错误消息
 */
export function validateLogicalExpression(expression: string): string | null {
  if (!expression || expression.trim() === '') return null
  try {
    // eslint-disable-next-line ts/no-implied-eval, no-new-func
    void new Function(`return (${expression});`)
    return null
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

export function evaluateExpression(expression: string, context: ExecutionContext): boolean {
  if (!expression || expression.trim() === '') return true

  try {
    const utils = {
      inDanmaku: (keyword: string) => {
        if (!context.event?.msg) return false
        return context.event.msg.includes(keyword)
      },
      giftValue: () => {
        if (!context.event) return 0
        return Math.abs(context.event.price || 0)
      },
      giftName: () => context.event?.msg || '',
      giftCount: () => context.event?.num || 0,
      hasMedal: () => context.event?.fans_medal_wearing_status || false,
      medalLevel: () => context.event?.fans_medal_level || 0,
      isCaptain: () => (context.event?.guard_level || 0) > 0,
      time: {
        hour: new Date().getHours(),
        minute: new Date().getMinutes(),
      },
      str: {
        includes: (str: string, search: string) => str.includes(search),
        startsWith: (str: string, search: string) => str.startsWith(search),
        endsWith: (str: string, search: string) => str.endsWith(search),
      },
    }

    const reservedNames = new Set(['context', 'event', ...Object.keys(utils)])
    const variableEntries = Object.entries(context.variables ?? {}).filter(
      ([key]) => VALID_JS_IDENTIFIER_RE.test(key) && !reservedNames.has(key),
    )

    const scopeKeys = [...Object.keys(utils), ...variableEntries.map(([k]) => k)]
    const scopeValues = [...Object.values(utils), ...variableEntries.map(([, v]) => v)]

    // eslint-disable-next-line ts/no-implied-eval, no-new-func
    const evalFunc = new Function(
      'context',
      'event',
      ...scopeKeys,
      `try { return (${expression}); } catch(e) { console.error('表达式评估错误:', e); return false; }`,
    )

    return Boolean(evalFunc(context, context.event, ...scopeValues))
  } catch (error) {
    console.error('表达式评估错误:', error)
    return false
  }
}

/**
 * 构建执行上下文对象
 * @param event 事件对象
 * @param roomId 房间ID
 * @param triggerType 触发类型
 * @param additionalContext 附加的上下文数据，将被合并到上下文中
 * @param options dryRun=true 时读写数据仅作用于内存沙盒，不污染真实 sessionStorage / 持久化存储
 * @returns 标准化的执行上下文
 */
export function buildExecutionContext(
  event: any,
  roomId: number | undefined,
  triggerType?: TriggerType,
  additionalContext?: Record<string, any>,
  options?: { dryRun?: boolean },
): ExecutionContext {
  const now = Date.now()
  const dateObj = new Date(now)
  const isDryRun = Boolean(options?.dryRun)
  const dryRuntimeMap = new Map<string, unknown>()
  const dryStorageMap = new Map<string, unknown>()

  const context: ExecutionContext = {
    event,
    roomId,
    timestamp: now,
    variables: {
      // 日期相关变量
      date: {
        formatted: dateObj.toLocaleString('zh-CN'),
        year: dateObj.getFullYear(),
        month: dateObj.getMonth() + 1,
        day: dateObj.getDate(),
        hour: dateObj.getHours(),
        minute: dateObj.getMinutes(),
        second: dateObj.getSeconds(),
      },
      // 时段函数
      timeOfDay: () => {
        const hour = dateObj.getHours()
        if (hour < 6) return '凌晨'
        if (hour < 9) return '早上'
        if (hour < 12) return '上午'
        if (hour < 14) return '中午'
        if (hour < 18) return '下午'
        if (hour < 22) return '晚上'
        return '深夜'
      },
    },
    // --- 实现运行时数据管理函数 (使用 sessionStorage，dryRun 时隔离在内存) ---
    getData: <T>(key: string, defaultValue?: T): T | undefined => {
      if (isDryRun) {
        if (dryRuntimeMap.has(key)) return dryRuntimeMap.get(key) as T
        const prefixedKey = RUNTIME_STORAGE_PREFIX + key
        try {
          const storedValue = sessionStorage.getItem(prefixedKey)
          if (storedValue === null) return defaultValue
          return JSON.parse(storedValue) as T
        } catch {
          return defaultValue
        }
      }
      const prefixedKey = RUNTIME_STORAGE_PREFIX + key
      try {
        const storedValue = sessionStorage.getItem(prefixedKey)
        if (storedValue === null) {
          return defaultValue
        }
        return JSON.parse(storedValue) as T
      } catch (error) {
        console.error(`[Runtime SessionStorage] Error getting/parsing key '${key}':`, error)
        return defaultValue
      }
    },
    setData: <T>(key: string, value: T): void => {
      if (isDryRun) {
        if (value === undefined) dryRuntimeMap.delete(key)
        else dryRuntimeMap.set(key, value)
        return
      }
      const prefixedKey = RUNTIME_STORAGE_PREFIX + key
      try {
        // 不存储 undefined
        if (value === undefined) {
          sessionStorage.removeItem(prefixedKey)
          return
        }
        sessionStorage.setItem(prefixedKey, JSON.stringify(value))
      } catch (error) {
        console.error(`[Runtime SessionStorage] Error setting key '${key}':`, error)
        // 如果序列化失败，可以选择移除旧键或保留
        sessionStorage.removeItem(prefixedKey)
      }
    },
    containsData: (key: string): boolean => {
      if (isDryRun) {
        if (dryRuntimeMap.has(key)) return true
        return sessionStorage.getItem(RUNTIME_STORAGE_PREFIX + key) !== null
      }
      const prefixedKey = RUNTIME_STORAGE_PREFIX + key
      return sessionStorage.getItem(prefixedKey) !== null
    },
    removeData: (key: string): void => {
      if (isDryRun) {
        dryRuntimeMap.delete(key)
        return
      }
      const prefixedKey = RUNTIME_STORAGE_PREFIX + key
      sessionStorage.removeItem(prefixedKey)
    },
    // --- 持久化数据管理函数 (dryRun 时只读回退，不写入真实存储) ---
    getStorageData: async <T>(key: string, defaultValue?: T): Promise<T | undefined> => {
      if (isDryRun && dryStorageMap.has(key)) return dryStorageMap.get(key) as T
      const value = await persistedGetJson<T>(userDataKey(key))
      return value === undefined ? defaultValue : value
    },
    setStorageData: async <T>(key: string, value: T): Promise<void> => {
      if (isDryRun) {
        dryStorageMap.set(key, value)
        return
      }
      await persistedSetJson(userDataKey(key), value)
    },
    hasStorageData: async (key: string): Promise<boolean> => {
      if (isDryRun && dryStorageMap.has(key)) return true
      return (await persistedGetJson(userDataKey(key))) !== undefined
    },
    removeStorageData: async (key: string): Promise<void> => {
      if (isDryRun) {
        dryStorageMap.delete(key)
        return
      }
      await persistedRemoveItem(userDataKey(key))
    },
    clearStorageData: async (): Promise<void> => {
      if (isDryRun) {
        dryStorageMap.clear()
        return
      }
      await persistedRemoveKeys(await persistedListKeys(AUTO_ACTION_USER_DATA_PREFIX))
    },
  }

  // 如果有事件对象，添加用户信息
  if (event) {
    context.variables.user = {
      name: event.uname,
      uid: event.uid,
      guardLevel: event.guard_level,
      hasMedal: event.fans_medal_wearing_status,
      medalLevel: event.fans_medal_level,
      medalName: event.fans_medal_name,
    }
    context.variables.danmaku = event
    context.variables.message = event.msg

    // 根据不同触发类型添加特定变量
    if (triggerType === TriggerType.GIFT) {
      const count = event.num || 1
      const totalPrice = event.price || 0
      context.variables.gift = {
        name: event.msg, // 礼物名称通常存在msg字段
        count,
        // EventModel.price 在当前实现中已统一为 “元”
        // - 礼物：总价值（元，可能为负数表示非付费/抵扣类礼物）
        price: totalPrice / count, // 单价（元）
        totalPrice, // 总价值（元）
        summary: `${count}个${event.msg || '礼物'}`,
      }
    } else if (triggerType === TriggerType.GUARD) {
      const guardLevelMap: Record<number, string> = {
        1: '总督',
        2: '提督',
        3: '舰长',
        0: '无舰长',
      }
      context.variables.guard = {
        level: event.guard_level || 0,
        levelName: guardLevelMap[event.guard_level || 0] || '未知舰长等级',
        giftCode: '',
      }
    } else if (triggerType === TriggerType.SUPER_CHAT) {
      context.variables.sc = {
        message: event.msg,
        // EventModel.price 在当前实现中已统一为 “元”
        price: event.price || 0,
      }
    }
  }

  // 合并附加的上下文数据（如果存在）
  if (additionalContext) {
    context.variables = {
      ...context.variables,
      ...additionalContext,
    }
  }

  return context
}
