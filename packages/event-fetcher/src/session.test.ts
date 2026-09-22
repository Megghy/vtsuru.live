import { describe, expect, it, vi } from 'vitest'

import { decodeClientUpload } from './upload'
import { startFetcher } from './session'
import type { EventHub, LiveSession } from './session'
import { ErrorCodes } from './version'

interface Timer {
  ms: number
  fn: () => void
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function createHarness(fetchImpl: typeof fetch) {
  const timers: Timer[] = []
  const hubs: Array<EventHub & { handlers: Map<string, (...args: unknown[]) => unknown> }> = []
  const lives: Array<LiveSession & { stop: ReturnType<typeof vi.fn>; raw?: (raw: string) => void }> = []
  const urls: string[] = []
  const invokes: Uint8Array[] = []
  let uploadResponse = { Success: true, Message: 'room-a', Version: '1.0.0.0', EventCount: 0 }

  const deps = {
    fetch: fetchImpl,
    sleep: () => new Promise((resolve) => setTimeout(resolve, 0)),
    schedule: (ms: number, fn: () => void) => {
      const timer = { ms, fn }
      timers.push(timer)
      return () => {
        const index = timers.indexOf(timer)
        if (index >= 0) timers.splice(index, 1)
      }
    },
    connectHub: (url: string) => {
      urls.push(url)
      const handlers = new Map<string, (...args: unknown[]) => unknown>()
      const hub = {
        state: 'disconnected' as 'connected' | 'disconnected',
        handlers,
        async start() {
          this.state = 'connected'
        },
        async stop() {
          this.state = 'disconnected'
        },
        on(method: string, handler: (...args: unknown[]) => unknown) {
          handlers.set(method, handler)
        },
        async send() {},
        async invoke(_method: string, bytes: unknown) {
          invokes.push(bytes as Uint8Array)
          return uploadResponse
        },
      }
      hubs.push(hub)
      return hub
    },
    connectLive: () => {
      const live = {
        raw: undefined as ((raw: string) => void) | undefined,
        onRaw(listener: (raw: string) => void) {
          live.raw = listener
          return () => undefined
        },
        async start() {
          return { success: true, message: '' }
        },
        stop: vi.fn(),
      }
      lives.push(live)
      return live
    },
  }

  return {
    deps,
    timers,
    hubs,
    lives,
    urls,
    invokes,
    setUploadResponse(response: typeof uploadResponse) {
      uploadResponse = response
    },
  }
}

const openLiveFetch: typeof fetch = async (url) => {
  const href = String(url)
  if (href.includes('account/self')) {
    return jsonResponse({ code: 200, data: { biliAuthCode: 'auth', biliId: 3, biliRoomId: 8 } })
  }
  if (href.includes('open-live/start')) {
    return jsonResponse({
      code: 200,
      data: {
        websocket_info: { auth_body: '{"ok":true}', wss_link: ['wss://open.example/sub'] },
        anchor_info: { room_id: 8 },
      },
    })
  }
  if (href.includes('heartbeat-internal')) return jsonResponse({ code: 500 })
  return jsonResponse({ code: 200 })
}

describe('event fetcher session', () => {
  it('connects open live, uploads raw frames, and restarts when the room code changes', async () => {
    const harness = createHarness(openLiveFetch)
    const fetcher = startFetcher({ token: 'token' }, harness.deps)
    await vi.waitFor(() => expect(harness.lives).toHaveLength(1))
    harness.lives[0].raw?.('{"cmd":"LIVE_OPEN_PLATFORM_DM"}')
    harness.timers.find((timer) => timer.ms === 1_000)?.fn()
    await vi.waitFor(() => expect(harness.invokes).toHaveLength(1))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(decodeClientUpload(harness.invokes[0]).Events).toEqual(['{"cmd":"LIVE_OPEN_PLATFORM_DM"}'])

    harness.lives[0].raw?.('next')
    harness.setUploadResponse({ Success: true, Message: 'room-b', Version: '1.0.0.0', EventCount: 0 })
    harness.timers.find((timer) => timer.ms === 1_000)?.fn()
    await vi.waitFor(() => expect(harness.lives).toHaveLength(2))
    expect(harness.lives[0].stop).toHaveBeenCalled()
    await fetcher.stop()
  })

  it('restarts open live when the heartbeat is no longer accepted', async () => {
    const harness = createHarness(openLiveFetch)
    const fetcher = startFetcher({ token: 'token' }, harness.deps)
    await vi.waitFor(() => expect(harness.timers.some((timer) => timer.ms === 20_000)).toBe(true))
    harness.timers.find((timer) => timer.ms === 20_000)?.fn()
    await vi.waitFor(() => expect(harness.lives).toHaveLength(2))
    await fetcher.stop()
  })

  it('uses the failover hub after the primary connection fails', async () => {
    let failed = false
    const harness = createHarness(openLiveFetch)
    harness.deps.connectHub = (url: string) => {
      harness.urls.push(url)
      const hub = {
        state: 'disconnected' as const,
        handlers: new Map<string, (...args: unknown[]) => unknown>(),
        async start() {
          if (!failed) {
            failed = true
            throw new Error('offline')
          }
          this.state = 'connected'
        },
        async stop() {},
        on(method: string, handler: (...args: unknown[]) => unknown) {
          this.handlers.set(method, handler)
        },
        async send() {},
        async invoke() {
          return { Success: true, Message: 'room-a', Version: '1.0.0.0' }
        },
      }
      harness.hubs.push(hub)
      return hub
    }
    const fetcher = startFetcher({ token: 'token' }, harness.deps)
    await vi.waitFor(() => expect(harness.hubs.some((hub) => hub.state === 'connected')).toBe(true))
    await vi.waitFor(() => expect(harness.lives).toHaveLength(1))
    expect(harness.urls[0]).toContain('https://api.vtsuru.suki.club/hub/event-fetcher?token=token')
    expect(harness.urls.at(-1)).toContain('https://failover-api.vtsuru.suki.club/hub/event-fetcher?token=token')
    await fetcher.stop()
  })

  it('reports an unbound account without opening a live socket', async () => {
    const harness = createHarness(async () => jsonResponse({ code: 200, data: { biliAuthCode: null } }))
    const fetcher = startFetcher({ token: 'token' }, harness.deps)
    await vi.waitFor(() => expect(harness.timers.some((timer) => timer.ms === 1_000)).toBe(true))
    await vi.waitFor(() => {
      harness.timers.find((timer) => timer.ms === 1_000)?.fn()
      const uploaded = harness.invokes.at(-1)
      expect(uploaded && decodeClientUpload(uploaded).Error[ErrorCodes.ACCOUNT_NOT_BIND]).toContain('尚未绑定')
    })
    expect(harness.lives).toHaveLength(0)
    await fetcher.stop()
  })

  it('connects a direct room when a cookie is configured', async () => {
    const harness = createHarness(async (url) => {
      const href = String(url)
      if (href.includes('account/self')) {
        return jsonResponse({ code: 200, data: { biliAuthCode: 'auth', biliId: 3, biliRoomId: 8 } })
      }
      if (href.includes('/nav')) {
        return jsonResponse({
          code: 0,
          data: {
            mid: 99,
            wbi_img: {
              img_url: 'https://i0.hdslb.com/bfs/wbi/abcdefghijklmnopqrstuvwxyz012345.png',
              sub_url: 'https://i0.hdslb.com/bfs/wbi/ABCDEFGHIJKLMNOPQRSTUVWXYZ678901.png',
            },
          },
        })
      }
      if (href.includes('getbuvid')) return jsonResponse({ code: 0, data: { buvid: 'buvid' } })
      return jsonResponse({
        code: 0,
        data: { token: 'room-token', host_list: [{ host: 'broadcastlv.chat.bilibili.com', wss_port: 443 }] },
      })
    })
    const auths: unknown[] = []
    harness.deps.connectLive = (auth) => {
      auths.push(auth)
      const live = {
        onRaw: () => () => undefined,
        async start() {
          return { success: true, message: '' }
        },
        stop: vi.fn(),
      }
      harness.lives.push(live)
      return live
    }
    const fetcher = startFetcher({ token: 'token', cookie: 'SESSDATA=abc' }, harness.deps)
    await vi.waitFor(() => expect(auths).toHaveLength(1))
    expect(auths[0]).toMatchObject({ type: 'direct', roomId: 8, token: 'room-token', uid: 3 })
    await fetcher.stop()
  })

  it('answers a hub request through the bilibili proxy', async () => {
    const harness = createHarness(async (url) => {
      const href = String(url)
      if (href.includes('account/self')) {
        return jsonResponse({ code: 200, data: { biliAuthCode: 'auth', biliId: 3, biliRoomId: 8 } })
      }
      if (href.includes('open-live/start')) {
        return jsonResponse({
          code: 200,
          data: {
            websocket_info: { auth_body: '{"ok":true}', wss_link: ['wss://open.example/sub'] },
            anchor_info: { room_id: 8 },
          },
        })
      }
      return new Response('{"code":0}', { status: 200 })
    })
    const fetcher = startFetcher({ token: 'token', cookie: 'SESSDATA=abc' }, harness.deps)
    await vi.waitFor(() => expect(harness.hubs).toHaveLength(1))
    const result = await harness.hubs[0].handlers.get('Request')?.(
      'https://api.bilibili.com/x/relation/stat?vmid=1',
      'GET',
      null,
      true,
    )
    expect(result).toMatchObject({ Success: true, Data: '{"code":0}' })
    await fetcher.stop()
  })
})
