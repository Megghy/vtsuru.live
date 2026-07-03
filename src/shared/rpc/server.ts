// RPC Server (Tauri 客户端侧)
//
// 监听 Rust 中继 emit 的 rpc://open / rpc://message / rpc://close 事件,
// 为每个外部连接 (connId) 建立一个 birpc peer, 把 ServerFunctions 暴露给外部网页。
// 出站数据通过 invoke('rpc_send') 交回 Rust 转发到对应 WebSocket。
import type { BirpcReturn } from 'birpc'
import type { ClientFunctions, ServerFunctions } from './contract'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { createBirpc } from 'birpc'
import { CLIENT_EVENT_NAMES } from './contract'

export interface RpcConnection {
  connId: string
  origin: string
  /** 反向调用外部网页 (推送事件) */
  rpc: BirpcReturn<ClientFunctions, ServerFunctions>
}

interface OpenPayload { conn_id: string, origin: string }
interface MessagePayload { conn_id: string, data: string }
interface ClosePayload { conn_id: string }

/**
 * 启动 RPC server, 返回停止函数。
 * @param resolveFunctions 为每个新连接生成其 ServerFunctions 实现 (可基于 origin 做授权)
 * @param onOpen  新连接建立回调 (拿到 rpc 句柄以便主动推送)
 * @param onClose 连接关闭回调
 */
export async function startRpcServer(options: {
  resolveFunctions: (conn: { connId: string, origin: string }) => ServerFunctions
  onOpen?: (conn: RpcConnection) => void
  onClose?: (connId: string) => void
}) {
  const connections = new Map<string, {
    rpc: BirpcReturn<ClientFunctions, ServerFunctions>
    onMessage: (data: string) => void
  }>()

  const unlistenOpen = await listen<OpenPayload>('rpc://open', (event) => {
    const { conn_id: connId, origin } = event.payload

    let onMessage: (data: string) => void = () => {}
    const rpc = createBirpc<ClientFunctions, ServerFunctions>(
      options.resolveFunctions({ connId, origin }),
      {
        post: data => invoke('rpc_send', { connId, data }),
        on: (fn) => { onMessage = fn },
        // Rust 中继传输的是字符串, 这里做 JSON 编解码
        serialize: v => JSON.stringify(v),
        deserialize: v => JSON.parse(v),
        eventNames: CLIENT_EVENT_NAMES as unknown as (keyof ClientFunctions)[],
      },
    )

    connections.set(connId, { rpc, onMessage: d => onMessage(d) })
    options.onOpen?.({ connId, origin, rpc })
  })

  const unlistenMessage = await listen<MessagePayload>('rpc://message', (event) => {
    const conn = connections.get(event.payload.conn_id)
    conn?.onMessage(event.payload.data)
  })

  const unlistenClose = await listen<ClosePayload>('rpc://close', (event) => {
    const connId = event.payload.conn_id
    connections.get(connId)?.rpc.$close?.()
    connections.delete(connId)
    options.onClose?.(connId)
  })

  return () => {
    unlistenOpen()
    unlistenMessage()
    unlistenClose()
    connections.clear()
  }
}
