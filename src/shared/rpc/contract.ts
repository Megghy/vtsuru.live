// 开放 RPC 接口契约 —— 唯一真源
//
// Tauri 客户端 (server 端) 与外部网页 (client 端) 都 import 本文件, 从而获得端到端强类型。
// 新增一个开放接口 = 在 ServerFunctions 里加一个方法签名 + 在 server 实现里补上对应函数,
// Rust 中继层完全无需改动。
import type { EventModel } from '@/api/api-models'

/** 事件订阅时可选的事件名 (与 useDanmakuClient 的 MODEL_EVENT_NAMES 对齐) */
export type DanmakuEventName
  = 'danmaku' | 'gift' | 'sc' | 'guard' | 'enter' | 'scDel' | 'follow' | 'like'

export const DANMAKU_EVENT_NAMES: readonly DanmakuEventName[]
  = ['danmaku', 'gift', 'sc', 'guard', 'enter', 'scDel', 'follow', 'like']

/** 发送类结果 (0 表示成功, 与 B 站 API code 语义一致) */
export interface SendResult {
  code: number
  message?: string
}

/**
 * ServerFunctions —— 由 Tauri 客户端实现, 供外部网页调用。
 * 加接口就在这里加一行, 两端自动获得类型提示。
 */
export interface ServerFunctions {
  /** 探测/握手: 返回客户端信息与当前登录账号, 供外部页面确认可用性 */
  hello: () => Promise<{ version: string, accountId?: number, uid?: number }>

  /** 订阅弹幕事件流。订阅后服务端通过 ClientFunctions.onDanmakuEvent 持续推送 */
  danmakuSubscribe: (events: DanmakuEventName[]) => Promise<{ ok: true }>
  /** 取消订阅 */
  danmakuUnsubscribe: () => Promise<{ ok: true }>

  /** 发送直播弹幕 (写操作, 需授权) */
  danmakuSend: (roomId: number, message: string) => Promise<SendResult>
  /** 发送私信 (写操作, 需授权) */
  messageSend: (userId: number, message: string) => Promise<SendResult>
}

/**
 * ClientFunctions —— 由外部网页实现, 供 Tauri 客户端 (server) 反向调用 / 推送。
 * 这些是 fire-and-forget 事件 (见 EVENT_NAMES), 不等待返回。
 */
export interface ClientFunctions {
  /** 服务端推送的弹幕事件 */
  onDanmakuEvent: (eventName: DanmakuEventName, data: EventModel) => void
}

/** birpc eventNames: 声明为单向事件的方法 (调用即发, 不等 round-trip) */
export const CLIENT_EVENT_NAMES = ['onDanmakuEvent'] as const

/** 本地 RPC 服务监听端口 (须与 Rust rpc_server.rs 的 RPC_PORT 保持一致) */
export const RPC_PORT = 29304
export const RPC_HEALTH_URL = `http://127.0.0.1:${RPC_PORT}/health`
export const RPC_WS_URL = `ws://127.0.0.1:${RPC_PORT}/rpc`
