/** 聊天消息角色 */
export type MessageRole = 'user' | 'assistant'

/** 聊天消息发送/接收状态 */
export type MessageStatus = 'sending' | 'streaming' | 'done' | 'error'

/** 审批卡片状态机, 与后端提案状态对应 */
export const ACTION_STATUSES = [
  'draft',
  'requires_confirmation',
  'scheduled',
  'running',
  'completed',
  'failed',
  'rejected',
] as const
export type ActionStatus = (typeof ACTION_STATUSES)[number]

/** 操作风险等级, 高风险需二次确认 */
export type ActionRisk = 'low' | 'medium' | 'high'
