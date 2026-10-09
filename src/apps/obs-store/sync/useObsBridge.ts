import { computed, onActivated, onDeactivated, onScopeDispose, ref, toValue, watch } from 'vue'
import type { Ref } from 'vue'
import { useRoute } from 'vue-router'

import { useAccount } from '@/api/account'
import { getObsSyncState, ObsSyncConflict, updateObsSyncState } from '@/api/obs-store'
import type { ObsSyncStateResponse } from '@/api/obs-store'
import { parsePositiveId } from '@/shared/obs/obsUrl'

import { isObsSyncChannel } from './channel'
import type { ObsBridgeOptions } from './types'

export function useObsBridge<TState extends Record<string, any>, TAction = unknown>(options: ObsBridgeOptions<TState>) {
  const account = useAccount()
  const route = useRoute()
  const writable = options.role !== 'viewer'
  const userId = computed(
    () =>
      toValue(options.userId) ??
      (writable ? account.value.id : Number(parsePositiveId(route?.query.id)) || account.value.id) ??
      0,
  )
  const channelId = computed(() => toValue(options.channelId) || 'default')
  const channelName = computed(() => `vtsuru:obs:${userId.value}:${options.componentId}:${channelId.value}`)
  const storageKey = computed(
    () => `${options.storageKeyPrefix || 'vtsuru_obs_state'}:${userId.value}:${options.componentId}:${channelId.value}`,
  )
  const state = ref(structuredClone(options.defaultState)) as Ref<TState>
  const currentHash = ref('')
  const isSyncing = ref(false)
  const isReady = ref(false)
  const lastSyncError = ref(false)
  const errorMessage = ref('')
  const hasPendingChanges = ref(false)
  const actionHandlers = new Set<(action: TAction) => void>()
  let generation = 0
  let revision = 0
  let pending: Partial<TState> = {}
  let channel: BroadcastChannel | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let writeTask: Promise<void> | undefined
  let destroyed = false
  let active = true

  function saveLocal() {
    if (options.persist === false) return
    // Storage quotas/private-mode restrictions must not stop server synchronization.
    try {
      localStorage.setItem(storageKey.value, JSON.stringify(state.value))
    } catch (error) {
      console.warn('OBS 本地缓存不可用', error)
    }
  }
  function apply(snapshot: ObsSyncStateResponse) {
    currentHash.value = snapshot.hash
    if (snapshot.changed && snapshot.data)
      state.value = { ...structuredClone(options.defaultState), ...JSON.parse(snapshot.data), ...pending }
    isReady.value = true
    saveLocal()
  }
  function fail(error: unknown) {
    lastSyncError.value = true
    errorMessage.value = error instanceof Error ? error.message : String(error)
  }
  async function poll(epoch = generation) {
    if (!active || !userId.value || !isObsSyncChannel(channelId.value) || writeTask || destroyed || Object.keys(pending).length) return
    const requestedRevision = revision
    try {
      const snapshot = await getObsSyncState(options.componentId, channelId.value, currentHash.value, userId.value)
      if (!active || epoch !== generation || writeTask || requestedRevision !== revision) return
      apply(snapshot)
      lastSyncError.value = false
      errorMessage.value = ''
    } catch (error) {
      if (epoch === generation) fail(error)
    }
  }
  async function flush(epoch: number, owner: number, targetChannel: string) {
    isSyncing.value = true
    try {
      if (!isReady.value) {
        const snapshot = await getObsSyncState(options.componentId, targetChannel, undefined, owner)
        if (epoch !== generation) return
        apply(snapshot)
      }
      let conflicts = 0
      while (epoch === generation && Object.keys(pending).length) {
        const patch = pending
        pending = {}
        try {
          const snapshot = await updateObsSyncState(
            options.componentId,
            targetChannel,
            JSON.stringify(state.value),
            currentHash.value,
          )
          if (epoch !== generation) return
          currentHash.value = snapshot.hash
          conflicts = 0
          channel?.postMessage({ type: 'refresh' })
        } catch (error) {
          if (epoch !== generation) return
          pending = { ...patch, ...pending }
          if (!(error instanceof ObsSyncConflict) || ++conflicts > 3) throw error
          apply(error.snapshot)
        }
      }
      lastSyncError.value = false
      errorMessage.value = ''
      hasPendingChanges.value = Object.keys(pending).length > 0
      saveLocal()
    } catch (error) {
      if (epoch === generation) fail(error)
    } finally {
      if (epoch === generation) isSyncing.value = false
    }
  }
  async function retry() {
    if (destroyed) return Promise.resolve()
    if (!writable) return poll()
    if (writeTask || !userId.value || !isObsSyncChannel(channelId.value)) return writeTask ?? Promise.resolve()
    const epoch = generation
    writeTask = flush(epoch, userId.value, channelId.value).finally(() => {
      if (epoch === generation) writeTask = undefined
    })
    return writeTask
  }
  // This boundary intentionally throws synchronously so button handlers and callers can reject invalid writes immediately.
  // eslint-disable-next-line ts/promise-function-async
  function updateState(value: Partial<TState> | ((previous: TState) => Partial<TState>)) {
    if (destroyed || !writable || !userId.value || userId.value !== account.value.id)
      throw new Error('请登录后修改自己的组件配置')
    revision++
    const patch = typeof value === 'function' ? value(state.value) : value
    pending = { ...pending, ...patch }
    hasPendingChanges.value = true
    state.value = { ...state.value, ...patch }
    return retry()
  }
  function sendAction(action: TAction) {
    if (!writable) throw new Error('展示页不能发送控制操作')
    channel?.postMessage({ type: 'action', action })
  }
  function onAction(handler: (action: TAction) => void) {
    actionHandlers.add(handler)
    return () => actionHandlers.delete(handler)
  }
  function cleanup() {
    generation++
    clearTimeout(timer)
    channel?.close()
    channel = undefined
    writeTask = undefined
  }
  async function cycle(epoch: number) {
    await poll(epoch)
    if (active && epoch === generation && !destroyed) timer = setTimeout(() => void cycle(epoch), 1200)
  }

  function pausePolling() {
    active = false
    clearTimeout(timer)
    timer = undefined
  }

  function resumePolling() {
    if (destroyed || active) return
    active = true
    if (userId.value) void cycle(generation)
  }
  watch(
    [userId, channelId],
    () => {
      cleanup()
      pending = {}
      hasPendingChanges.value = false
      state.value = structuredClone(options.defaultState)
      currentHash.value = ''
      isReady.value = false
      isSyncing.value = false
      lastSyncError.value = false
      errorMessage.value = ''
      if (!userId.value || !isObsSyncChannel(channelId.value)) return
      if (options.persist !== false) {
        try {
          const saved = localStorage.getItem(storageKey.value)
          if (saved) state.value = { ...state.value, ...JSON.parse(saved) }
        } catch (error) {
          console.warn('OBS 本地缓存读取失败', error)
        }
      }
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel(channelName.value)
        channel.onmessage = ({ data }) => {
          if (data.type === 'refresh') void poll()
          if (data.type === 'action') actionHandlers.forEach((handler) => handler(data.action))
        }
      }
      void cycle(generation)
    },
    { immediate: true },
  )
  function destroy() {
    destroyed = true
    cleanup()
    actionHandlers.clear()
  }
  onActivated(resumePolling)
  onDeactivated(pausePolling)
  onScopeDispose(destroy)
  return {
    state,
    updateState,
    // eslint-disable-next-line ts/promise-function-async
    setState: (value: TState) => updateState(value),
    sendAction,
    onAction,
    currentHash,
    isSyncing,
    isReady,
    lastSyncError,
    errorMessage,
    hasPendingChanges,
    retry,
    userId,
    channelName,
    storageKey,
    destroy,
  }
}
