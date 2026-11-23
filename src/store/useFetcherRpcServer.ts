import { getVersion } from '@tauri-apps/api/app'
import { invoke } from '@tauri-apps/api/core'
import { info, warn } from '@tauri-apps/plugin-log'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { useAccount } from '@/api/account'
// 开放 RPC 服务 (Tauri 客户端侧)
//
// 在 Tauri 客户端内启动: 把本地能力 (弹幕订阅、发送弹幕/私信、OBS 场景联动) 通过 birpc 暴露给外部网页。
// server/health 的传输由 Rust rpc_server.rs 负责, 本 store 只提供 ServerFunctions 实现。
import type { EventModel } from '@/api/client-types'
import { useBiliFunction } from '@/apps/client/store/useBiliFunction'
import { stageObsFilterAssetLocally } from '@/apps/client/utils/obsFilterAssetStager'
import { useOBSStore } from '@/apps/client/store/useOBSStore'
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import type {
  DanmakuEventName,
  RpcObsStatus,
  RpcVtsSceneActionParams,
  RpcVtsStatus,
  ServerFunctions,
} from '@/shared/rpc/contract'
import { DANMAKU_EVENT_NAMES } from '@/shared/rpc/contract'
import type { RpcConnection } from '@/shared/rpc/server'
import { startRpcServer } from '@/shared/rpc/server'

import { useDanmakuClient } from './useDanmakuClient'

// 写操作 origin 白名单 (与 Rust 端保持一致; 读操作已由 Rust 层门禁)
const WRITE_ALLOWED_HOSTS = new Set(['vtsuru.suki.club', 'vtsuru.live', 'localhost', '127.0.0.1', 'tauri.localhost'])

function isWriteAllowed(origin: string): boolean {
  if (!origin) return false
  try {
    return WRITE_ALLOWED_HOSTS.has(new URL(origin).hostname)
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
  const lastError = ref<string | null>(null)
  // 连接列表 (响应式, 供 sidebar 展示来源/连接时间); connectionCount 由其长度派生
  const connections = ref<RpcConnectionInfo[]>([])
  const connectionCount = computed(() => connections.value.length)
  let stop: (() => void) | undefined

  async function refreshNativeStatus() {
    try {
      const status = await invoke<{ running: boolean; lastError?: string | null }>('rpc_server_status')
      lastError.value = status.lastError ?? null
    } catch {
      // 旧壳版本可能未暴露该字段
    }
  }

  // 每个连接订阅的事件集合
  const subscriptions = new Map<string, Set<DanmakuEventName>>()
  // 订阅了 OBS / VTS 场景事件的连接集合
  const obsSubscribers = new Set<string>()
  const vtsSubscribers = new Set<string>()
  // connId -> rpc 句柄 (用于推送)
  const conns = new Map<string, RpcConnection>()

  const danmakuClient = useDanmakuClient()
  const obsStore = useOBSStore()
  const vtsStore = useVtsStore()

  function buildVtsStatus(): RpcVtsStatus {
    return {
      connected: vtsStore.connected,
      modelName: vtsStore.currentModelName,
      presets: vtsStore.presets.map((p) => ({ id: p.id, name: p.name })),
      expressions: vtsStore.expressions.map((e) => ({ file: e.file, name: e.name, active: e.active })),
      hotkeys: vtsStore.hotkeys.map((h) => ({ hotkeyID: h.hotkeyID, name: h.name, type: h.type })),
      macros: vtsStore.macros.map((m) => ({ id: m.id, name: m.name })),
      obsLinkEnabled: Boolean(vtsStore.obsLinkConfig.enabled),
    }
  }

  function pushVtsStatusChanged() {
    if (vtsSubscribers.size === 0) return
    const status = buildVtsStatus()
    for (const connId of vtsSubscribers) {
      try {
        conns.get(connId)?.rpc.onVtsStatusChanged?.(status)
      } catch (error) {
        console.error(`[FetcherRpcServer] 推送 VTS 状态失败 (${connId}):`, error)
      }
    }
  }

  async function runVtsSceneAction(params: RpcVtsSceneActionParams): Promise<{ ok: boolean; message?: string }> {
    if (!vtsStore.connected) {
      return { ok: false, message: 'VTube Studio 未连接，请先在桌面客户端中连接 VTS' }
    }
    try {
      if (params.presetId) {
        await vtsStore.applyPreset(params.presetId)
      }
      if (params.expressionFile) {
        await vtsStore.setExpression(params.expressionFile, params.expressionActive !== false)
      }
      if (params.hotkeyId) {
        await vtsStore.triggerHotkey(params.hotkeyId)
      }
      if (params.macroId) {
        await vtsStore.runMacro(params.macroId)
      }
      return { ok: true }
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) }
    }
  }

  async function buildObsStatus(): Promise<RpcObsStatus> {
    const size = obsStore.obsConnected
      ? await obsStore.getVideoCanvasSize()
      : { baseWidth: 1920, baseHeight: 1080 }
    return {
      connected: obsStore.obsConnected,
      address: obsStore.obsAddress,
      scenes: [...obsStore.obsScenes],
      currentScene: obsStore.currentObsScene,
      baseWidth: size.baseWidth,
      baseHeight: size.baseHeight,
    }
  }

  function pushObsSceneChanged(sceneName: string) {
    if (!sceneName) return
    for (const connId of obsSubscribers) {
      try {
        conns.get(connId)?.rpc.onObsSceneChanged?.(sceneName)
      } catch (error) {
        console.error(`[FetcherRpcServer] 推送 OBS 切场失败 (${connId}):`, error)
      }
    }
  }

  async function pushObsStatusChanged() {
    if (obsSubscribers.size === 0) return
    const status = await buildObsStatus()
    for (const connId of obsSubscribers) {
      try {
        conns.get(connId)?.rpc.onObsStatusChanged?.(status)
      } catch (error) {
        console.error(`[FetcherRpcServer] 推送 OBS 状态失败 (${connId}):`, error)
      }
    }
  }

  watch(
    () => obsStore.currentObsScene,
    (sceneName, prev) => {
      if (sceneName && sceneName !== prev) {
        pushObsSceneChanged(sceneName)
        void pushObsStatusChanged()
      }
    },
  )

  watch(
    [() => obsStore.obsConnected, () => obsStore.obsScenes.join('\0')],
    () => {
      void pushObsStatusChanged()
    },
  )

  watch(
    [
      () => vtsStore.connected,
      () => vtsStore.currentModelName,
      () => vtsStore.presets.length,
      () => vtsStore.expressions.length,
      () => vtsStore.hotkeys.length,
      () => vtsStore.macros.length,
      () => vtsStore.obsLinkConfig.enabled,
    ],
    () => {
      pushVtsStatusChanged()
    },
  )

  // 统一的弹幕事件分发: 推给所有订阅了该事件的连接
  function dispatch(eventName: DanmakuEventName, data: EventModel) {
    for (const [connId, events] of subscriptions) {
      if (!events.has(eventName)) continue
      try {
        conns.get(connId)?.rpc.onDanmakuEvent(eventName, data)
      } catch (error) {
        console.error(`[FetcherRpcServer] 向连接 ${connId} 推送 ${eventName} 失败:`, error)
      }
    }
  }

  // 只在总线上注册一次监听 (无论是否有订阅者, 开销极小)
  for (const name of DANMAKU_EVENT_NAMES) {
    danmakuClient.onEvent(name, (data: EventModel) => dispatch(name, data))
  }

  function buildFunctions(conn: { connId: string; origin: string }): ServerFunctions {
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

      obsGetStatus: async () => buildObsStatus(),

      obsSwitchScene: async (sceneName) => {
        requireWrite()
        if (!obsStore.obsConnected) return { ok: false, message: 'OBS 未连接' }
        await obsStore.switchToScene(sceneName)
        return { ok: true }
      },

      obsGetSceneItems: async (sceneName) => obsStore.getSceneItems(sceneName),

      obsUpsertBrowserSource: async (params) => {
        requireWrite()
        return obsStore.upsertBrowserSource(params)
      },

      obsGetSourceScreenshot: async (params) => obsStore.getSourceScreenshot(params),

      obsSyncSceneLayout: async (params) => {
        requireWrite()
        return obsStore.syncSceneLayout(params)
      },

      obsGetFilterCapabilities: async () => obsStore.getFilterCapabilities(),

      obsSyncSourceFilters: async (params) => {
        requireWrite()
        return obsStore.syncSourceFilters(params)
      },

      obsStageFilterAsset: async (params) => {
        requireWrite()
        return stageObsFilterAssetLocally(params)
      },

      obsSubscribeEvents: async () => {
        obsSubscribers.add(conn.connId)
        setSubscribed(conn.connId, true)
        return { ok: true }
      },

      obsUnsubscribeEvents: async () => {
        obsSubscribers.delete(conn.connId)
        if (!subscriptions.has(conn.connId) && !vtsSubscribers.has(conn.connId)) setSubscribed(conn.connId, false)
        return { ok: true }
      },

      vtsGetStatus: async () => buildVtsStatus(),

      vtsRunSceneAction: async (params) => {
        requireWrite()
        return runVtsSceneAction(params)
      },

      vtsSubscribeEvents: async () => {
        vtsSubscribers.add(conn.connId)
        setSubscribed(conn.connId, true)
        return { ok: true }
      },

      vtsUnsubscribeEvents: async () => {
        vtsSubscribers.delete(conn.connId)
        if (!subscriptions.has(conn.connId) && !obsSubscribers.has(conn.connId)) setSubscribed(conn.connId, false)
        return { ok: true }
      },
    }
  }

  function setSubscribed(connId: string, subscribed: boolean) {
    const connInfo = connections.value.find((c) => c.connId === connId)
    if (connInfo) connInfo.subscribed = subscribed
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
        obsSubscribers.delete(connId)
        vtsSubscribers.delete(connId)
        connections.value = connections.value.filter((c) => c.connId !== connId)
        info(`[RPC] 外部连接断开: ${connId}`)
      },
    })
    running.value = true
    await refreshNativeStatus()
    info('[RPC] 开放接口服务已就绪')
  }

  function dispose() {
    stop?.()
    stop = undefined
    conns.clear()
    subscriptions.clear()
    obsSubscribers.clear()
    vtsSubscribers.clear()
    connections.value = []
    running.value = false
    lastError.value = null
    warn('[RPC] 开放接口服务已停止')
  }

  return { running, lastError, connections, connectionCount, start, dispose, refreshNativeStatus }
})
