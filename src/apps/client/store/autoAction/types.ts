// 统一的自动操作类型定义

import type { EventModel } from '@/api/client-types'
import type { GuardLevel } from '@/api/generated/model'

// 触发条件类型
export enum TriggerType {
  DANMAKU = 'danmaku', // 弹幕
  GIFT = 'gift', // 礼物
  GUARD = 'guard', // 上舰
  FOLLOW = 'follow', // 关注
  ENTER = 'enter', // 进入直播间
  SCHEDULED = 'scheduled', // 定时触发
  SUPER_CHAT = 'super_chat', // SC
  POINT_REDEEM = 'point_redeem', // 积分商品兑换
}

// 操作类型
export enum ActionType {
  SEND_DANMAKU = 'send_danmaku', // 发送弹幕
  SEND_PRIVATE_MSG = 'send_private_msg', // 发送私信
  EXECUTE_COMMAND = 'execute_command', // 执行命令
  PLAY_AUDIO = 'play_audio', // 播放本地/URL 音效（不依赖 VTS）
  PNGTUBER_EXPRESSION = 'pngtuber_expression', // 切换 PNGtuber 表情
  VTS_HOTKEY = 'vts_hotkey', // 触发 VTS hotkey
  VTS_EXPRESSION = 'vts_expression', // 切换 VTS 表情
  VTS_PRESET = 'vts_preset', // 应用 VTS 机位预设
  VTS_DROP_ITEM = 'vts_drop_item', // 掉落 VTS 道具
  VTS_PARAM_ADD = 'vts_param_add', // 注入 VTS 参数
  VTS_MACRO = 'vts_macro', // 运行 VTS 宏
  VTS_ACCESSORY = 'vts_accessory', // 配饰显隐
  VTS_COLOR_TINT = 'vts_color_tint', // 模型染色
  VTS_POST_PROCESSING = 'vts_post_processing', // 后处理滤镜
}

export const VTS_ACTION_TYPES = new Set<ActionType>([
  ActionType.VTS_HOTKEY,
  ActionType.VTS_EXPRESSION,
  ActionType.VTS_PRESET,
  ActionType.VTS_DROP_ITEM,
  ActionType.VTS_PARAM_ADD,
  ActionType.VTS_MACRO,
  ActionType.VTS_ACCESSORY,
  ActionType.VTS_COLOR_TINT,
  ActionType.VTS_POST_PROCESSING,
])

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
  description?: string // 操作描述 (可选)
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

    pngtuberExpressionId?: string
    pngtuberDurationMs?: number
    pngtuberChannel?: string

    // --- 独立音效播放配置 ---
    audioSource?: string
    audioVolume?: number
    audioWaitForEnd?: boolean

    // --- VTS 动作配置（按 actionType 使用） ---
    vtsHotkeyId?: string
    vtsExpressionFile?: string
    vtsExpressionActive?: boolean
    vtsPresetId?: string
    vtsItemFileName?: string
    vtsItemDropX?: number
    vtsItemDropSize?: number
    vtsItemRandomX?: boolean
    vtsParamId?: string
    vtsParamValue?: number
    vtsParamWeight?: number
    vtsParamMode?: 'add' | 'set'
    vtsMacroId?: string
    vtsAccessoryId?: string
    vtsAccessoryVisible?: boolean
    vtsTintColor?: string
    vtsTintRainbow?: boolean
    vtsTintReset?: boolean
    vtsPostProcessingEnabled?: boolean
    vtsPostProcessingPreset?: string
    vtsPostProcessingFadeTime?: number
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
  timerStartTimes: Record<string, number> // 独立定时器启动时间戳
  globalTimerStartTime: number | null // 全局定时器启动时间戳
  sentGuardPms: Set<number> // 兼容旧版：已发送的舰长私信
  sentActionUsers?: Record<string, Set<string>> // 按规则 ID 隔离的已触发用户集合（preventRepeat）
  sequentialLineIndex?: Record<string, number> // 按规则 ID 隔离的顺序多行模板游标
}

export interface SingleActionTestResult {
  matched: boolean
  reason?: string
  renderedText?: string
  executed: boolean
  error?: string
}

export interface TriggerConfig {
  // User filters
  userFilterEnabled?: boolean
  requireMedal?: boolean
  requireCaptain?: boolean

  // Enter welcome: 仅欢迎佩戴勋章用户时的最低牌子等级 (0 表示不限制)
  enterMedalMinLevel?: number

  // Common conditions
  onlyDuringLive?: boolean
  ignoreTianXuan?: boolean

  // Keywords for autoReply
  keywords?: string[]
  keywordMatchType?: KeywordMatchType
  blockwords?: string[]
  blockwordMatchType?: KeywordMatchType

  // Gift filters
  filterMode?: 'blacklist' | 'whitelist' | 'value' | 'none' | 'free' | 'guard' | 'medal'
  filterGiftNames?: string[]
  minValue?: number // For gift and SC minimum value (元)
  includeQuantity?: boolean // 是否包含礼物数量

  // SC相关配置
  scFilterMode?: 'none' | 'price' // SC过滤模式
  scMinPrice?: number // SC最低价格(元)
  scMaxPrice?: number // SC最高价格(元)

  // Scheduled options
  useGlobalTimer?: boolean
  intervalSeconds?: number
  schedulingMode?: 'random' | 'sequential'

  // Guard related
  guardLevels?: GuardLevel[]
  preventRepeat?: boolean
  giftCodes?: { level: number; codes: string[] }[]
  consumeGiftCode?: boolean // 是否消耗礼品码

  // Confirm message options
  sendDanmakuConfirm?: boolean // 是否发送弹幕确认
  isConfirmMessage?: boolean // 标记这是一个确认消息

  // Point redeem filters
  pointGoodsIds?: number[]
  pointGoodsNameKeywords?: string[]
  pointIncludeFree?: boolean
}
