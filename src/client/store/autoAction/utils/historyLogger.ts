import { del, get, update } from 'idb-keyval'
import { ActionType } from '../types'

// 历史记录类型常量
export enum HistoryType {
  DANMAKU = 'danmaku',
  PRIVATE_MSG = 'privateMsg',
  COMMAND = 'command',
}

// 历史记录项结构
export interface HistoryItem {
  id: string // 唯一ID
  actionId: string // 操作ID
  actionName: string // 操作名称
  actionType: ActionType // 操作类型
  timestamp: number // 执行时间戳
  content: string // 发送的内容
  target?: string // 目标（如UID或房间ID）
  success: boolean // 是否成功
  error?: string // 错误信息（如果有）
}

// 每种类型的历史记录容量
const HISTORY_CAPACITY = 1000

// 使用IDB存储的键名
const HISTORY_KEYS = {
  [HistoryType.DANMAKU]: 'autoAction_history_danmaku',
  [HistoryType.PRIVATE_MSG]: 'autoAction_history_privateMsg',
  [HistoryType.COMMAND]: 'autoAction_history_command',
}

// 环形队列添加记录
async function addToCircularQueue(key: string, item: HistoryItem, capacity: number): Promise<void> {
  await update<HistoryItem[]>(key, (history = []) => {
    // 添加到队列末尾
    history.push(item)

    // 如果超出容量，移除最旧的记录
    if (history.length > capacity) {
      history.splice(0, history.length - capacity)
    }
    return history
  })
}

/**
 * 记录弹幕发送历史
 */
export async function logDanmakuHistory(
  actionId: string,
  actionName: string,
  content: string,
  roomId: number,
  success: boolean,
  error?: string,
): Promise<void> {
  const historyItem: HistoryItem = {
    id: `d_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    actionId,
    actionName,
    actionType: ActionType.SEND_DANMAKU,
    timestamp: Date.now(),
    content,
    target: roomId.toString(),
    success,
    error,
  }

  await addToCircularQueue(HISTORY_KEYS[HistoryType.DANMAKU], historyItem, HISTORY_CAPACITY)
}

/**
 * 记录私信发送历史
 */
export async function logPrivateMsgHistory(
  actionId: string,
  actionName: string,
  content: string,
  userId: number,
  success: boolean,
  error?: string,
): Promise<void> {
  const historyItem: HistoryItem = {
    id: `p_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    actionId,
    actionName,
    actionType: ActionType.SEND_PRIVATE_MSG,
    timestamp: Date.now(),
    content,
    target: userId.toString(),
    success,
    error,
  }

  await addToCircularQueue(HISTORY_KEYS[HistoryType.PRIVATE_MSG], historyItem, HISTORY_CAPACITY)
}

/**
 * 记录命令执行历史
 */
export async function logCommandHistory(
  actionId: string,
  actionName: string,
  content: string,
  success: boolean,
  error?: string,
): Promise<void> {
  const historyItem: HistoryItem = {
    id: `c_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    actionId,
    actionName,
    actionType: ActionType.EXECUTE_COMMAND,
    timestamp: Date.now(),
    content,
    success,
    error,
  }

  await addToCircularQueue(HISTORY_KEYS[HistoryType.COMMAND], historyItem, HISTORY_CAPACITY)
}

/**
 * 获取历史记录
 */
export async function getHistoryByType(type: HistoryType): Promise<HistoryItem[]> {
  return await get<HistoryItem[]>(HISTORY_KEYS[type]) || []
}

/**
 * 清除历史记录
 */
export async function clearHistory(type: HistoryType): Promise<void> {
  await del(HISTORY_KEYS[type])
}

/**
 * 清除所有历史记录
 */
export async function clearAllHistory(): Promise<void> {
  await Promise.all(
    Object.values(HistoryType).map(async type => clearHistory(type as HistoryType)),
  )
}
