export type ObsSyncMessageType =
  | 'STATE_UPDATE'
  | 'ACTION'
  | 'SYNC_REQUEST'
  | 'SYNC_RESPONSE'
  | 'PING'
  | 'PONG'

export interface ObsSyncMessage<TState = any, TAction = any> {
  /** 消息唯一 ID */
  id: string
  /** 组件标识符，如 'counter', 'clock', 'wheel' */
  componentId: string
  /** 实例通道 ID，默认 'default' */
  channelId: string
  /** 消息类型 */
  type: ObsSyncMessageType
  /** 时间戳 */
  timestamp: number
  /** 当前全量或部分状态 */
  state?: TState
  /** 瞬态操作/事件数据 */
  action?: TAction
}

export interface ObsBridgeOptions<TState> {
  /** 组件唯一 ID，如 'counter' */
  componentId: string
  /** 频道 ID，默认 'default'，支持多个独立实例 */
  channelId?: string
  /** 默认初始状态 */
  defaultState: TState
  /** 角色：'controller' (网页控制台，主动写入) | 'viewer' (OBS展示端，主要消费) | 'auto' */
  role?: 'controller' | 'viewer' | 'auto'
  /** 是否启用本地持久化存储（默认 true） */
  persist?: boolean
  /** 持久化 Storage Key 前缀（默认 'vtsuru_obs_state'） */
  storageKeyPrefix?: string
}
