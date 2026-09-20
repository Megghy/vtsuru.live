import { HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr'
import { onScopeDispose, ref, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import { useAccount } from '@/api/account'
import { BASE_HUB_URL, mapToCurrentAPI } from '@/shared/config'

import { DEFAULT_PNGTUBER_RUNTIME } from './types'
import type { PngtuberRuntime } from './types'

type Connection = ReturnType<HubConnectionBuilder['build']>

export function usePngtuberRuntime(
  userId: MaybeRefOrGetter<number>,
  channel: MaybeRefOrGetter<string>,
  controller = false,
) {
  const account = useAccount()
  const runtime = ref<PngtuberRuntime>({ ...DEFAULT_PNGTUBER_RUNTIME })
  const connected = ref(false),
    error = ref('')
  let epoch = 0
  let destroyed = false
  let connection: Connection | undefined
  let timer: ReturnType<typeof setInterval> | undefined
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  // A fresh transport/join gets its own throttle and in-flight flags.
  const newFlight = () => ({ lastSend: -Infinity, publishing: false, heartbeatPending: false })
  let flight = newFlight()
  function failed(cause: unknown) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  }
  function silence() {
    connected.value = false
    flight = newFlight()
    runtime.value = { ...runtime.value, isSpeaking: false, volume: 0, source: '' }
  }
  async function stop(client: Connection) {
    // Cleanup must never reject into a watcher, timer or scope-dispose callback.
    try {
      await client.stop()
    } catch {
      /* The detached connection no longer owns state. */
    }
  }
  async function dispose() {
    epoch++
    clearInterval(timer)
    clearTimeout(retryTimer)
    silence()
    runtime.value = { ...DEFAULT_PNGTUBER_RUNTIME }
    const old = connection
    connection = undefined
    if (old) await stop(old)
  }
  async function connect() {
    const stopping = dispose()
    const version = epoch
    await stopping
    if (version !== epoch || destroyed) return
    const id = toValue(userId),
      room = toValue(channel)
    if (!id || (controller && account.value.id !== id)) return
    const current = () => version === epoch && !destroyed
    const retry = (cause?: unknown) => {
      if (!current()) return
      silence()
      if (cause !== undefined) failed(cause)
      clearTimeout(retryTimer)
      retryTimer = setTimeout(() => {
        if (current()) void connect()
      }, 3000)
    }
    try {
      const url = new URL(mapToCurrentAPI(`${BASE_HUB_URL}pngtuber`))
      if (controller) url.searchParams.set('token', account.value.token)
      const client = new HubConnectionBuilder()
        .withUrl(url.toString())
        .configureLogging(LogLevel.Error)
        .withAutomaticReconnect()
        .build()
      connection = client
      let joiningState: PngtuberRuntime | undefined
      const apply = (value: PngtuberRuntime) => {
        if (!current() || client.state !== HubConnectionState.Connected) return
        if (!connected.value) {
          joiningState = value
          return
        }
        if (value.updatedAt >= runtime.value.updatedAt) runtime.value = value
      }
      client.on('State', apply)
      const join = async () => {
        const pending = flight
        joiningState = undefined
        try {
          await client.invoke('Join', id, room)
          if (current() && pending === flight && client.state === HubConnectionState.Connected) {
            connected.value = true
            if (joiningState) apply(joiningState)
            error.value = ''
            clearTimeout(retryTimer)
          }
        } catch (cause) {
          if (pending === flight) retry(cause)
        }
      }
      client.onreconnecting(() => {
        if (current()) silence()
      })
      client.onreconnected(() => {
        if (current()) void join()
      })
      client.onclose(() => retry())
      await client.start()
      if (!current()) {
        await stop(client)
        return
      }
      await join()
      if (!current()) return
      timer = setInterval(async () => {
        const pending = flight
        if (!current() || !connected.value || pending.heartbeatPending || client.state !== HubConnectionState.Connected)
          return
        pending.heartbeatPending = true
        try {
          const value = await client.invoke<PngtuberRuntime>('Heartbeat')
          if (pending === flight) apply(value)
        } catch (cause) {
          if (current() && pending === flight) failed(cause)
        } finally {
          pending.heartbeatPending = false
        }
      }, 1000)
    } catch (cause) {
      retry(cause)
    }
  }
  async function publish(volume: number, speaking: boolean, source: 'controller' | 'client' | 'obs') {
    const client = connection,
      pending = flight,
      version = epoch
    if (!connected.value || !client || pending.publishing || performance.now() - pending.lastSend < 50) return
    pending.publishing = true
    pending.lastSend = performance.now()
    try {
      await client.invoke('Publish', volume, speaking, source)
    } catch (cause) {
      if (version === epoch && pending === flight && !destroyed) failed(cause)
    } finally {
      pending.publishing = false
    }
  }
  async function control(patch: Partial<Pick<PngtuberRuntime, 'expressionId' | 'muted' | 'away'>>, durationMs = 0) {
    if (!connected.value || !controller) throw new Error('立绘控制连接尚未就绪')
    await connection!.invoke('Control', patch.expressionId ?? null, patch.muted ?? null, patch.away ?? null, durationMs)
  }
  async function stopPublishing() {
    if (connected.value && controller) await connection!.invoke('StopPublishing')
  }
  watch(
    () => [toValue(userId), toValue(channel), controller ? account.value.id : 0, controller ? account.value.token : ''],
    () => void connect(),
    { immediate: true, flush: 'sync' },
  )
  onScopeDispose(() => {
    destroyed = true
    void dispose()
  })
  return { runtime, connected, error, publish, control, stopPublishing, reconnect: connect }
}
