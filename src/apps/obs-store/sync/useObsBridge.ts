import {
  onScopeDispose,
  onUnmounted,
  ref,
} from 'vue'

import { getObsSyncState, updateObsSyncState } from '@/api/obs-store'

import type { ObsBridgeOptions, ObsSyncMessage } from './types'

export function useObsBridge<TState extends Record<string, any>, TAction = any>(
  options: ObsBridgeOptions<TState>,
) {
  const {
    componentId,
    channelId = 'default',
    defaultState,
    role = 'auto',
    persist = true,
    storageKeyPrefix = 'vtsuru_obs_state',
  } = options

  const storageKey = `${storageKeyPrefix}:${componentId}:${channelId}`
  const channelName = `vtsuru:obs:${componentId}:${channelId}`

  // 1. 本地持久化恢复
  function loadPersistedState(): TState {
    if (!persist || typeof window === 'undefined' || !window.localStorage) {
      return { ...defaultState }
    }
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (raw) {
        return { ...defaultState, ...JSON.parse(raw) }
      }
    } catch {
      // 忽略解析异常
    }
    return { ...defaultState }
  }

  function savePersistedState(val: TState) {
    if (!persist || typeof window === 'undefined' || !window.localStorage) return
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(val))
    } catch {
      // 忽略写入异常
    }
  }

  const state = ref<TState>(loadPersistedState()) as { value: TState }
  const currentHash = ref<string>('')
  const isSyncing = ref<boolean>(false)
  const lastSyncError = ref<boolean>(false)
  const actionHandlers = new Set<(action: TAction) => void>()

  // 2. BroadcastChannel 同浏览器即时通道
  let channel: BroadcastChannel | null = null

  function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  }

  function postLocalMessage(msg: Omit<ObsSyncMessage<TState, TAction>, 'id' | 'componentId' | 'channelId' | 'timestamp'>) {
    if (!channel) return
    const payload: ObsSyncMessage<TState, TAction> = {
      id: generateId(),
      componentId,
      channelId,
      timestamp: Date.now(),
      ...msg,
    }
    try {
      channel.postMessage(payload)
    } catch {
      // 忽略通道异常
    }
  }

  function handleLocalMessage(event: MessageEvent<ObsSyncMessage<TState, TAction>>) {
    const data = event.data
    if (!data || data.componentId !== componentId || data.channelId !== channelId) {
      return
    }

    if (data.type === 'STATE_UPDATE' && data.state) {
      state.value = { ...state.value, ...data.state }
      savePersistedState(state.value)
    } else if (data.type === 'ACTION' && data.action !== undefined) {
      actionHandlers.forEach((handler) => handler(data.action as TAction))
    }
  }

  // 3. 后端轻量 Hash 同步轮询（解决 OBS 进程隔离问题）
  let pollTimer: any = null
  let isPolling = false

  async function pollRemoteState() {
    if (isPolling) return
    isPolling = true
    try {
      const res = await getObsSyncState(componentId, channelId, currentHash.value)
      lastSyncError.value = false
      if (res.changed && res.data) {
        currentHash.value = res.hash
        try {
          const parsed = JSON.parse(res.data)
          state.value = { ...state.value, ...parsed }
          savePersistedState(state.value)
        } catch {}
      } else if (res.hash) {
        currentHash.value = res.hash
      }
    } catch {
      lastSyncError.value = true
    } finally {
      isPolling = false
    }
  }

  // 启动同步任务
  if (typeof window !== 'undefined') {
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        channel = new BroadcastChannel(channelName)
        channel.onmessage = handleLocalMessage
      } catch {}
    }

    // 立即拉取一次
    pollRemoteState()

    // 若作为 OBS 端或 auto 模式，每 1200ms 进行一次极轻量 Hash 轮询
    pollTimer = setInterval(pollRemoteState, 1200)
  }

  // 4. 控制端写入与同步
  async function syncToRemote(newState: TState) {
    try {
      isSyncing.value = true
      const raw = JSON.stringify(newState)
      const res = await updateObsSyncState(componentId, channelId, raw)
      if (res.hash) {
        currentHash.value = res.hash
      }
      lastSyncError.value = false
    } catch {
      lastSyncError.value = true
    } finally {
      isSyncing.value = false
    }
  }

  function setState(newState: TState) {
    state.value = { ...newState }
    savePersistedState(state.value)
    postLocalMessage({
      type: 'STATE_UPDATE',
      state: state.value,
    })
    syncToRemote(state.value)
  }

  function updateState(partialOrUpdater: Partial<TState> | ((prev: TState) => Partial<TState>)) {
    const partial = typeof partialOrUpdater === 'function' ? partialOrUpdater(state.value) : partialOrUpdater
    state.value = { ...state.value, ...partial }
    savePersistedState(state.value)
    postLocalMessage({
      type: 'STATE_UPDATE',
      state: state.value,
    })
    syncToRemote(state.value)
  }

  function sendAction(action: TAction) {
    postLocalMessage({
      type: 'ACTION',
      action,
    })
  }

  function onAction(handler: (action: TAction) => void): () => void {
    actionHandlers.add(handler)
    return () => {
      actionHandlers.delete(handler)
    }
  }

  function destroy() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    if (channel) {
      try {
        channel.close()
      } catch {}
      channel = null
    }
    actionHandlers.clear()
  }

  if (typeof onScopeDispose === 'function') {
    onScopeDispose(destroy)
  }

  return {
    state,
    setState,
    updateState,
    sendAction,
    onAction,
    currentHash,
    isSyncing,
    lastSyncError,
    channelName,
    storageKey,
    destroy,
  }
}
