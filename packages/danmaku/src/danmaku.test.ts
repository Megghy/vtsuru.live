import { beforeEach, describe, expect, it, vi } from 'vitest'

import { connectDanmaku, createDanmakuSocket, rawEventText } from './index'

const mocks = vi.hoisted(() => {
  class KeepLiveWSMock extends EventTarget {
    public static instances: KeepLiveWSMock[] = []
    public closed = false

    public constructor(
      public roomId: number,
      public options?: unknown,
    ) {
      super()
      KeepLiveWSMock.instances.push(this)
    }

    public emit(type: string, data?: unknown) {
      const event = new Event(type)
      Object.defineProperty(event, 'data', { value: data })
      this.dispatchEvent(event)
    }

    public override connect() {
      if (this.closed) return
    }

    public override close() {
      if (this.closed) return
      this.closed = true
      this.emit('close')
    }
  }

  return { KeepLiveWSMock }
})

vi.mock('@laplace.live/ws/client', () => ({
  KeepLiveWS: mocks.KeepLiveWSMock,
}))

describe('danmaku socket', () => {
  beforeEach(() => {
    mocks.KeepLiveWSMock.instances.length = 0
  })

  it('passes direct auth through to the live socket', () => {
    createDanmakuSocket({
      type: 'direct',
      roomId: 7,
      token: 'token',
      buvid: 'buvid',
      uid: 9,
    })

    expect(mocks.KeepLiveWSMock.instances[0]).toMatchObject({
      roomId: 7,
      options: { key: 'token', buvid: 'buvid', uid: 9, protover: 3 },
    })
  })

  it('passes open-live auth body and address through to the live socket', () => {
    const authBody = { protover: 3 }
    createDanmakuSocket({
      type: 'openlive',
      roomId: 8,
      authBody,
      address: 'wss://example/sub',
    })

    expect(mocks.KeepLiveWSMock.instances[0]).toMatchObject({
      roomId: 8,
      options: { authBody, address: 'wss://example/sub' },
    })
  })

  it('does not reconnect after the socket is closed', () => {
    const socket = createDanmakuSocket({
      type: 'direct',
      roomId: 1,
      token: 'token',
      buvid: 'buvid',
      uid: 1,
    })
    const connect = vi.spyOn(mocks.KeepLiveWSMock.prototype, 'connect')
    socket.close()
    socket.connect()
    expect(connect).not.toHaveBeenCalled()
  })

  it('stringifies structured frames and keeps raw text frames', () => {
    expect(rawEventText({ cmd: 'DANMU_MSG' })).toBe('{"cmd":"DANMU_MSG"}')
    expect(rawEventText('{"cmd":"DANMU_MSG"}')).toBe('{"cmd":"DANMU_MSG"}')
  })

  it('resolves when the room accepts the join and forwards raw frames', async () => {
    const session = connectDanmaku({
      type: 'direct',
      roomId: 1,
      token: 'token',
      buvid: 'buvid',
      uid: 1,
    })
    const raw = vi.fn()
    session.onRaw(raw)
    const pending = session.start()
    const socket = mocks.KeepLiveWSMock.instances[0]
    socket.emit('msg', { cmd: 'DANMU_MSG', info: [] })
    socket.emit('live')

    await expect(pending).resolves.toEqual({ success: true, message: '' })
    expect(raw).toHaveBeenCalledWith('{"cmd":"DANMU_MSG","info":[]}')
    expect(socket.closed).toBe(false)
  })

  it('closes the socket when the handshake times out', async () => {
    vi.useFakeTimers()
    const session = connectDanmaku({
      type: 'direct',
      roomId: 1,
      token: 'token',
      buvid: 'buvid',
      uid: 1,
    })
    const pending = session.start()
    await vi.advanceTimersByTimeAsync(30_000)
    await expect(pending).resolves.toEqual({ success: false, message: '连接超时' })
    expect(mocks.KeepLiveWSMock.instances[0].closed).toBe(true)
    vi.useRealTimers()
  })

  it('cancels a handshake that has not finished', async () => {
    const controller = new AbortController()
    const session = connectDanmaku({
      type: 'openlive',
      roomId: 1,
      authBody: { ok: true },
      address: 'wss://example/sub',
    })
    const pending = session.start(controller.signal)
    controller.abort()
    await expect(pending).resolves.toEqual({ success: false, message: '弹幕客户端启动已取消' })
    expect(mocks.KeepLiveWSMock.instances[0].closed).toBe(true)
  })
})
