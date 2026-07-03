// 开放 RPC 服务 (Tauri 客户端侧)
//
// 在 Tauri 客户端内启动: 把本地能力 (弹幕订阅、发送弹幕/私信) 通过 birpc 暴露给外部网页。
// server/health 的传输由 Rust rpc_server.rs 负责, 本 store 只提供 ServerFunctions 实现。
import type { EventModel } from '@/api/api-models'
import type { RpcConnection } from '@/shared/rpc/server'
import type { DanmakuEventName, ServerFunctions } from '@/shared/rpc/contract'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { info, warn } from '@tauri-apps/plugin-log'
import { useAccount } from '@/api/account'
import { getVersion } from '@tauri-apps/api/app'
import { DANMAKU_EVENT_NAMES } from '@/shared/rpc/contract'
import { startRpcServer } from '@/shared/rpc/server'
import { useBiliFunction } from '@/apps/client/store/useBiliFunction'
import { useDanmakuClient } from './useDanmakuClient'

// 写操作 origin 白名单 (与 Rust 端保持一致; 读操作已由 Rust 层门禁)
const WRITE_ALLOWED_HOSTS = ['vtsuru.suki.club', 'vtsuru.live', 'localhost', '127.0.0.1', 'tauri.localhost']

function isWriteAllowed(origin: string): boolean {
  if (!origin) return false
  try {
    return WRITE_ALLOWED_HOSTS.includes(new URL(origin).hostname)
  } catch {
    return false
  }
}

// 供 UI 展示的连接信息 (响应式)
export interface RpcConnectionInfo {
  connId: string
  origin: string
  connectedAt: number
  subscribed: boolean
}

export const useFetcherRpcServer = defineStore('FetcherRpcServer', () => {
  const running = ref(false)
  // 连接列表 (响应式, 供 sidebar 展示来源/连接时间); connectionCount 由其长度派生
  const connections = ref<RpcConnectionInfo[]>([])
  const connectionCount = computed(() => connections.value.length)
  let stop: (() => void) | undefined

  // 每个连接订阅的事件集合
  const subscriptions = new Map<string, Set<DanmakuEventName>>()
  // connId -> rpc 句柄 (用于推送)
  const conns = new Map<string, RpcConnection>()

  const danmakuClient = useDanmakuClient()

  // 统一的弹幕事件分发: 推给所有订阅了该事件的连接
  function dispatch(eventName: DanmakuEventName, data: EventModel) {
    for (const [connId, events] of subscriptions) {
      if (!events.has(eventName)) continue
      conns.get(connId)?.rpc.onDanmakuEvent(eventName, data)
    }
  }

  // 只在总线上注册一次监听 (无论是否有订阅者, 开销极小)
  for (const name of DANMAKU_EVENT_NAMES) {
    danmakuClient.onEvent(name, (data: EventModel) => dispatch(name, data))
  }

  function buildFunctions(conn: { connId: string, origin: string }): ServerFunctions {
    const account = useAccount()
    const biliFunc = useBiliFunction()

    const requireWrite = () => {
      if (!isWriteAllowed(conn.origin)) {
        throw new Error(`origin 未授权写操作: ${conn.origin}`)
      }
    }

    return {
      hello: async () => ({
        version: await getVersion(),
        accountId: account.value?.id,
        uid: biliFunc.uid,
      }),

      danmakuSubscribe: async (events) => {
        subscriptions.set(conn.connId, new Set(events))
        setSubscribed(conn.connId, true)
        return { ok: true }
      },
      danmakuUnsubscribe: async () => {
        subscriptions.delete(conn.connId)
        setSubscribed(conn.connId, false)
        return { ok: true }
      },

      danmakuSend: async (roomId, message) => {
        requireWrite()
        const ok = await biliFunc.sendLiveDanmaku(roomId, message)
        return { code: ok ? 0 : -1, message: ok ? undefined : '发送失败' }
      },
      messageSend: async (userId, message) => {
        requireWrite()
        const ok = await biliFunc.sendPrivateMessage(userId, message)
        return { code: ok ? 0 : -1, message: ok ? undefined : '发送失败' }
      },
    }
  }

  function setSubscribed(connId: string, subscribed: boolean) {
    const info = connections.value.find(c => c.connId === connId)
    if (info) info.subscribed = subscribed
  }

  async function start() {
    if (running.value) return
    stop = await startRpcServer({
      resolveFunctions: buildFunctions,
      onOpen: (conn) => {
        conns.set(conn.connId, conn)
        connections.value.push({
          connId: conn.connId,
          origin: conn.origin,
          connectedAt: Date.now(),
          subscribed: false,
        })
        info(`[RPC] 外部连接接入: ${conn.connId} (${conn.origin})`)
      },
      onClose: (connId) => {
        conns.delete(connId)
        subscriptions.delete(connId)
        connections.value = connections.value.filter(c => c.connId !== connId)
        info(`[RPC] 外部连接断开: ${connId}`)
      },
    })
    running.value = true
    info('[RPC] 开放接口服务已就绪')
  }

  function dispose() {
    stop?.()
    stop = undefined
    conns.clear()
    subscriptions.clear()
    connections.value = []
    running.value = false
    warn('[RPC] 开放接口服务已停止')
  }

  return { running, connections, connectionCount, start, dispose }
})
