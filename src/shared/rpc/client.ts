// RPC Client (外部网页侧)
//
// 探测本地 eventfetcher 是否可用, 可用则通过 WebSocket 连上其开放接口,
// 拿到一个强类型的 ServerFunctions 代理 (rpc.danmakuSend(...) 全程有类型提示)。
import type { BirpcReturn } from 'birpc'
import type { ClientFunctions, ServerFunctions } from './contract'
import { createBirpc } from 'birpc'
import { compareVersion, RPC_MIN_CLIENT_VERSION } from '@/shared/config/clientVersion'
import { RPC_HEALTH_URL, RPC_WS_URL } from './contract'

export interface RpcHealth {
  name: string
  version: string
  rpc: boolean
}

/** 探测本地是否安装并运行了 eventfetcher。超时或失败返回 null */
export async function probeLocalFetcher(timeoutMs = 800): Promise<RpcHealth | null> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    const resp = await fetch(RPC_HEALTH_URL, { signal: ctrl.signal })
    clearTimeout(timer)
    if (!resp.ok) return null
    const health = await resp.json() as RpcHealth
    if (!health.rpc) return null
    // 版本门禁: 老 client 即便应答也可能缺少所需接口能力, 视为不可用
    if (compareVersion(health.version, RPC_MIN_CLIENT_VERSION) < 0) {
      console.warn(`[RPC] 本地 eventfetcher 版本 ${health.version} 过旧 (需 ${RPC_MIN_CLIENT_VERSION}+), 忽略`)
      return null
    }
    return health
  } catch {
    return null
  }
}

export interface RpcClient {
  rpc: BirpcReturn<ServerFunctions, ClientFunctions>
  close: () => void
}

/**
 * 连接本地 eventfetcher 的开放 RPC 接口。
 * @param clientFunctions 本端实现 (接收弹幕推送等), 默认空实现
 * @param onClose 连接断开回调 (本地 fetcher 关闭时触发, 供上层降级)
 */
export function connectLocalFetcher(
  clientFunctions: Partial<ClientFunctions> = {},
  onClose?: () => void,
): Promise<RpcClient> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(RPC_WS_URL)
    let onMessage: (data: string) => void = () => {}
    let opened = false

    ws.addEventListener('message', ev => onMessage(ev.data))
    ws.addEventListener('error', () => {
      if (!opened) reject(new Error('无法连接本地 eventfetcher'))
    })
    ws.addEventListener('close', () => {
      if (opened) onClose?.()
    })
    ws.addEventListener('open', () => {
      opened = true
      const rpc = createBirpc<ServerFunctions, ClientFunctions>(
        clientFunctions as ClientFunctions,
        {
          post: data => ws.readyState === WebSocket.OPEN && ws.send(data),
          on: (fn) => { onMessage = fn },
          serialize: v => JSON.stringify(v),
          deserialize: v => JSON.parse(v),
        },
      )
      resolve({ rpc, close: () => ws.close() })
    })
  })
}
