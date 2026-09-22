import { connectDanmaku } from '@vtsuru/danmaku'

import { fetchAccount } from './account'
import type { createApiSelector } from './api'
import type { CookieCloudConfig } from './config'
import { fetchCookieCloud } from './cookieCloud'
import { resolveDirectAuth } from './direct'
import { openLiveHeartbeat, resolveOpenLiveAuth } from './openLive'
import type { FetcherDeps, LiveSession } from './session'
import { ErrorCodes } from './version'

type ApiSelector = ReturnType<typeof createApiSelector>

export interface LiveState {
  signal: AbortSignal
  token: string
  cookieCloud?: CookieCloudConfig
  cookieEnabled: boolean
  getCookie: () => string
  setCookie: (cookie: string) => void
  queue: string[]
  errors: Map<string, string>
  api: ApiSelector
  fetch: typeof fetch
  connectLive: NonNullable<FetcherDeps['connectLive']>
  schedule: NonNullable<FetcherDeps['schedule']>
  sleep: (ms: number) => Promise<void>
  log: (message: string) => void
  live?: LiveSession
  generation: number
  heartbeatStop: () => void
}

export function stopLive(state: LiveState) {
  state.heartbeatStop()
  state.heartbeatStop = () => undefined
  state.live?.stop()
  state.live = undefined
}

export function rememberLiveError(state: LiveState, error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (error instanceof Error && error.name === ErrorCodes.ACCOUNT_NOT_BIND) {
    state.errors.set(ErrorCodes.ACCOUNT_NOT_BIND, message)
    return
  }
  if (message.includes('Cookie')) state.errors.set(ErrorCodes.COOKIE_CLIENT_UNABLE_GET_COOKIE, message)
  else if (state.cookieEnabled) state.errors.set(ErrorCodes.ACCOUNT_UNABLE_GET_INFO, message)
  else state.errors.set(ErrorCodes.OPEN_LIVE_UNABLE_START_GAME, `[OpenLive] 无法开启场次: ${message}`)
  state.log(message)
}

export async function refreshCookie(state: LiveState) {
  if (!state.cookieCloud) return
  state.setCookie(await fetchCookieCloud({ ...state.cookieCloud, fetch: state.fetch }))
  state.errors.delete(ErrorCodes.COOKIE_CLIENT_UNABLE_GET_COOKIE)
}

async function startLive(state: LiveState, generation: number) {
  const base = state.api.current()
  const account = await fetchAccount(base, state.token, state.fetch)
  state.errors.delete(ErrorCodes.ACCOUNT_NOT_BIND)
  state.errors.delete(ErrorCodes.ACCOUNT_UNABLE_GET_INFO)
  const auth = state.cookieEnabled
    ? await resolveDirectAuth({
        roomId: account.roomId,
        uid: account.uid,
        cookie: state.getCookie(),
        fetch: state.fetch,
      })
    : await resolveOpenLiveAuth(base, state.token, state.fetch)
  if (state.signal.aborted || generation !== state.generation) return
  const session = state.connectLive(auth)
  session.onRaw((raw) => {
    if (raw) state.queue.push(raw)
  })
  const started = await session.start(state.signal)
  if (generation !== state.generation) {
    session.stop()
    return
  }
  if (!started.success) {
    session.stop()
    throw new Error(started.message)
  }
  state.live = session
  state.errors.delete(ErrorCodes.CLIENT_DISCONNECTED)
  state.errors.delete(ErrorCodes.OPEN_LIVE_UNABLE_START_GAME)
  if (state.cookieEnabled) return
  state.heartbeatStop = state.schedule(20_000, () => {
    void openLiveHeartbeat(base, state.token, state.fetch).then(
      (ok) => {
        if (!ok) void restartLive(state, '直播场认证信息已过期')
      },
      () => {
        void restartLive(state, '直播场心跳失败')
      },
    )
  })
}

export async function restartLive(state: LiveState, reason: string) {
  state.generation += 1
  const generation = state.generation
  stopLive(state)
  state.log(reason)
  while (!state.signal.aborted && generation === state.generation && !state.live) {
    try {
      if (state.cookieCloud) await refreshCookie(state)
      await startLive(state, generation)
    } catch (error) {
      rememberLiveError(state, error)
      await state.sleep(10_000)
    }
  }
}

export function watchCookie(state: LiveState) {
  if (!state.cookieCloud) return () => undefined
  return state.schedule(600_000, () => void refreshCookie(state).catch((error) => rememberLiveError(state, error)))
}

export function createLiveState(
  input: Omit<LiveState, 'live' | 'generation' | 'heartbeatStop' | 'connectLive'>,
  connectLive: FetcherDeps['connectLive'],
): LiveState {
  return {
    ...input,
    connectLive: connectLive ?? connectDanmaku,
    generation: 0,
    heartbeatStop: () => undefined,
  }
}
