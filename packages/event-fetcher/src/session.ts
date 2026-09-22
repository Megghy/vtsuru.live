import { createApiSelector } from './api'
import { requestBilibili } from './bilibili'
import type { CookieCloudConfig } from './config'
import { createLiveState, restartLive, stopLive, watchCookie } from './live'
import type { LiveState } from './live'
import { createUploader, shouldUpload } from './uploader'
import { ErrorCodes, FETCHER_VERSION } from './version'

export interface EventHub {
  readonly state: 'connected' | 'disconnected'
  start: () => Promise<void>
  stop: () => Promise<void>
  on: (method: string, handler: (...args: unknown[]) => unknown) => void
  send: (method: string, ...args: unknown[]) => Promise<void>
  invoke: (method: string, ...args: unknown[]) => Promise<unknown>
}

export interface LiveSession {
  onRaw: (listener: (raw: string) => void) => () => void
  start: (signal?: AbortSignal) => Promise<{ success: boolean; message: string }>
  stop: () => void
}

export interface FetcherRuntimeSettings {
  token: string
  cookie?: string
  cookieCloud?: CookieCloudConfig
  apiBaseUrl?: string
  failoverBaseUrl?: string
}

export interface FetcherDeps {
  fetch?: typeof fetch
  connectHub: (url: string) => EventHub
  connectLive?: (auth: import('@vtsuru/danmaku').DanmakuAuth) => LiveSession
  sleep?: (ms: number) => Promise<void>
  schedule?: (ms: number, fn: () => void) => () => void
  osInfo?: string
  version?: string
  log?: (message: string) => void
}

function defaultSchedule(ms: number, fn: () => void) {
  const timer = setInterval(fn, ms)
  return () => clearInterval(timer)
}

export function startFetcher(settings: FetcherRuntimeSettings, deps: FetcherDeps) {
  const controller = new AbortController()
  const done = runFetcher(settings, deps, controller.signal)
  return {
    done,
    stop: async () => {
      controller.abort()
      await done
    },
  }
}

async function runFetcher(settings: FetcherRuntimeSettings, deps: FetcherDeps, signal: AbortSignal) {
  const errors = new Map<string, string>()
  const queue: string[] = []
  const fetchImpl = deps.fetch ?? fetch
  const schedule = deps.schedule ?? defaultSchedule
  const version = deps.version ?? FETCHER_VERSION
  let cookie = settings.cookie ?? ''
  const sleep = async (ms: number) => {
    if (signal.aborted) return
    await (deps.sleep ?? ((delay: number) => new Promise((resolve) => setTimeout(resolve, delay))))(ms)
  }
  const live = createLiveState(
    {
      signal,
      token: settings.token,
      cookieCloud: settings.cookieCloud,
      cookieEnabled: Boolean(settings.cookie || settings.cookieCloud),
      getCookie: () => cookie,
      setCookie: (value) => {
        cookie = value
      },
      queue,
      errors,
      api: createApiSelector(settings.apiBaseUrl, settings.failoverBaseUrl),
      fetch: fetchImpl,
      schedule,
      sleep,
      log: deps.log ?? (() => undefined),
    },
    deps.connectLive,
  )
  const runtime: FetcherRuntime = {
    hub: undefined,
    connecting: false,
    uploadStop: () => undefined,
    lastUpload: 0,
    live,
    queue,
    schedule,
    sleep,
    version,
    deps,
    uploader: undefined as never,
  }
  runtime.uploader = createUploader({
    queue,
    errors,
    osInfo: deps.osInfo ?? 'unknown',
    version,
    sleep,
    useCookie: () => live.cookieEnabled,
    onRoomChange: () => {
      void restartLive(live, '房间号改变')
    },
    invoke: (bytes) => invokeUpload(runtime.hub, bytes),
  })
  const cookieStop = watchCookie(live)
  signal.addEventListener(
    'abort',
    () => {
      live.generation += 1
      runtime.uploadStop()
      cookieStop()
      stopLive(live)
      void runtime.hub?.stop()
    },
    { once: true },
  )

  await connectHub(runtime)
  await untilAborted(signal)
}

async function invokeUpload(hub: EventHub | undefined, bytes: Uint8Array) {
  if (!hub || hub.state !== 'connected') throw new Error('hub disconnected')
  return (await hub.invoke('UploadEvents', bytes)) as { Success: boolean; Message: string; Version?: string }
}

function untilAborted(signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal.aborted) resolve()
    else signal.addEventListener('abort', () => resolve(), { once: true })
  })
}

interface FetcherRuntime {
  hub?: EventHub
  connecting: boolean
  uploadStop: () => void
  lastUpload: number
  live: LiveState
  queue: string[]
  schedule: NonNullable<FetcherDeps['schedule']>
  sleep: (ms: number) => Promise<void>
  version: string
  deps: FetcherDeps
  uploader: { flush: () => Promise<boolean> }
}

async function connectHub(runtime: FetcherRuntime) {
  if (runtime.connecting || runtime.live.signal.aborted) return
  runtime.connecting = true
  try {
    while (!runtime.live.signal.aborted) {
      const connection = runtime.deps.connectHub(
        `${runtime.live.api.current()}hub/event-fetcher?token=${encodeURIComponent(runtime.live.token)}`,
      )
      bindHub(connection, runtime)
      try {
        await connection.start()
        runtime.hub = connection
        runtime.live.errors.delete(ErrorCodes.UNABLE_CONNECTTOHUB)
        await connection.send('ConnectFinished', runtime.version, runtime.live.cookieEnabled)
        runtime.uploadStop()
        runtime.uploadStop = runtime.schedule(1_000, () => {
          if (!shouldUpload(runtime.queue.length, Date.now() - runtime.lastUpload)) return
          runtime.lastUpload = Date.now()
          void runtime.uploader.flush()
        })
        void restartLive(runtime.live, '连接弹幕')
        return
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        runtime.live.errors.set(ErrorCodes.UNABLE_CONNECTTOHUB, `无法连接至 VTsuru 服务器: ${message}`)
        runtime.live.api.fail()
        runtime.live.log(message)
        await connection.stop().catch(() => undefined)
        await runtime.sleep(5_000)
      }
    }
  } finally {
    runtime.connecting = false
  }
}

function bindHub(connection: EventHub, runtime: FetcherRuntime) {
  connection.on('Disconnect', async (...args) => {
    const message = String(args[0] ?? '')
    runtime.live.log(`被服务端断开连接: ${message}`)
    stopLive(runtime.live)
    runtime.uploadStop()
    runtime.hub = undefined
    await connection.stop().catch(() => undefined)
    await runtime.sleep(message.includes('Token') || message.includes('未认证') ? 30_000 : 5_000)
    if (!runtime.live.signal.aborted) void connectHub(runtime)
  })
  connection.on('Request', (...args) =>
    requestBilibili({
      url: String(args[0] ?? ''),
      method: String(args[1] || 'GET'),
      body: typeof args[2] === 'string' ? args[2] : null,
      useCookie: Boolean(args[3]),
      cookieEnabled: runtime.live.cookieEnabled,
      cookie: runtime.live.getCookie(),
      fetch: runtime.live.fetch,
    }),
  )
}

