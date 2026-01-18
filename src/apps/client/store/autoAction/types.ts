// 统一的自动操作类型定义

import type { EventModel, GuardLevel } from '@/api/api-models'

// 触发条件类型
export enum TriggerType {
  DANMAKU = 'danmaku', // 弹幕
  GIFT = 'gift', // 礼物
  GUARD = 'guard', // 上舰
  FOLLOW = 'follow', // 关注
  ENTER = 'enter', // 进入直播间
  SCHEDULED = 'scheduled', // 定时触发
  SUPER_CHAT = 'super_chat', // SC
}

// 操作类型
export enum ActionType {
  SEND_DANMAKU = 'send_danmaku', // 发送弹幕
  SEND_PRIVATE_MSG = 'send_private_msg', // 发送私信
  EXECUTE_COMMAND = 'execute_command', // 执行命令
  VTS_HOTKEY = 'vts_hotkey', // 触发 VTS hotkey
  VTS_PRESET = 'vts_preset', // 应用 VTS 机位预设
  VTS_DROP_ITEM = 'vts_drop_item', // 掉落 VTS 道具
  VTS_PARAM_ADD = 'vts_param_add', // 注入 VTS 参数（mode=add）
}

// 关键词匹配类型
export enum KeywordMatchType {
  Full = 'full', // 完全匹配
  Contains = 'contains', // 包含匹配
  Regex = 'regex', // 正则匹配
}

// 优先级
export enum Priority {
  HIGHEST = 0,
  HIGH = 1,
  NORMAL = 2,
  LOW = 3,
  LOWEST = 4,
}

// 统一的自动操作定义
export interface AutoActionItem {
  id: string // 唯一ID
  name: string // 操作名称
  enabled: boolean // 是否启用
  triggerType: TriggerType // 触发类型
  actionType: ActionType // 操作类型
  template: string // 模板
  priority: Priority // 优先级

  // 高级配置
  logicalExpression: string // 逻辑表达式，为真时才执行此操作
  ignoreCooldown: boolean // 是否忽略冷却时间
  executeCommand: string // 要执行的JS代码

  // 触发器特定配置
  triggerConfig: TriggerConfig

  // 动作特定配置
  actionConfig: {
    delaySeconds?: number // 延迟执行秒数
    maxUsersPerMsg?: number // 每条消息最大用户数
    maxItemsPerUser?: number // 每用户最大项目数 (礼物等)
    cooldownSeconds?: number // 冷却时间(秒)

    // --- VTS 动作配置（按 actionType 使用） ---
    vtsHotkeyId?: string
    vtsPresetId?: string
    vtsItemFileName?: string
    vtsItemDropX?: number
    vtsItemDropSize?: number
    vtsParamId?: string
    vtsParamValue?: number
    vtsParamWeight?: number
  }
}

// 执行上下文，包含事件信息和可用变量
export interface ExecutionContext {
  event?: EventModel // 触发事件
  roomId?: number // 直播间ID
  variables: Record<string, any> // 额外变量
  timestamp: number // 时间戳

  // --- 新增运行时数据管理函数 ---
  /** 获取运行时数据 */
  getData: <T>(key: string, defaultValue?: T) => T | undefined
  /** 设置运行时数据 */
  setData: <T>(key: string, value: T) => void
  /** 检查运行时数据是否存在 */
  containsData: (key: string) => boolean
  /** 移除运行时数据 */
  removeData: (key: string) => void

  // --- 新增持久化数据管理函数 ---
  /** 获取持久化存储的数据 */
  getStorageData: <T>(key: string, defaultValue?: T) => Promise<T | undefined>
  /** 设置持久化存储的数据 */
  setStorageData: <T>(key: string, value: T) => Promise<void>
  /** 检查持久化存储中是否存在指定的键 */
  hasStorageData: (key: string) => Promise<boolean>
  /** 从持久化存储中删除数据 */
  removeStorageData: (key: string) => Promise<void>
  /** 清除所有持久化存储的数据 */
  clearStorageData: () => Promise<void>
}

// 运行状态接口
export interface RuntimeState {
  lastExecutionTime: Record<string, number> // 上次执行时间
  aggregatedEvents: Record<string, any[]> // 聚合的事件
  scheduledTimers: Record<string, any | null> // 定时器 ID
  timerStartTimes: Record<string, number> // <--- 新增：独立定时器启动时间戳
  globalTimerStartTime: number | null // <--- 新增：全局定时器启动时间戳
  sentGuardPms: Set<number> // 已发送的舰长私信
}

export interface TriggerConfig {
  // User filters
  userFilterEnabled?: boolean
  requireMedal?: boolean
  requireCaptain?: boolean

  // Common conditions
  onlyDuringLive?: boolean
  ignoreTianXuan?: boolean

  // Keywords for autoReply
  keywords?: string[]
  keywordMatchType?: KeywordMatchType
  blockwords?: string[]
  blockwordMatchType?: KeywordMatchType

  // Gift filters
  filterMode?: 'blacklist' | 'whitelist' | 'value' | 'none' | 'free'
  filterGiftNames?: string[]
  minValue?: number // For gift and SC minimum value (元)
  includeQuantity?: boolean // 是否包含礼物数量

  // SC相关配置
  scFilterMode?: 'none' | 'price' // SC过滤模式
  scMinPrice?: number // SC最低价格(元)

  // Scheduled options
  useGlobalTimer?: boolean
  intervalSeconds?: number
  schedulingMode?: 'random' | 'sequential'

  // Guard related
  guardLevels?: GuardLevel[]
  preventRepeat?: boolean
  giftCodes?: { level: number, codes: string[] }[]
  consumeGiftCode?: boolean // 是否消耗礼品码

  // Confirm message options
  sendDanmakuConfirm?: boolean // 是否发送弹幕确认
  isConfirmMessage?: boolean // 标记这是一个确认消息
}
