import { Field, Root, Type } from 'protobufjs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { EventDataTypes } from '@/api/api-models'

import DirectClient from '../DanmakuClients/DirectClient'
import type { AuthInfo } from '../DanmakuClients/OpenLiveClient'
import OpenLiveClient from '../DanmakuClients/OpenLiveClient'

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

    public connect() {}

    public close() {
      if (this.closed) return
      this.closed = true
      this.emit('close')
    }
  }

  return {
    KeepLiveWSMock,
    queryGet: vi.fn(),
    queryPost: vi.fn(),
  }
})

vi.mock('@laplace.live/ws/client', () => ({
  KeepLiveWS: mocks.KeepLiveWSMock,
}))

vi.mock('worker-timers', () => ({
  clearTimeout: (timer: ReturnType<typeof globalThis.setTimeout>) => globalThis.clearTimeout(timer),
  setTimeout: (callback: () => void, delay: number) => globalThis.setTimeout(callback, delay),
}))

vi.mock('@/api/query', () => ({
  QueryGetAPI: mocks.queryGet,
  QueryPostAPI: mocks.queryPost,
}))

const giftMedalType = new Type('GiftMedal')
  .add(new Field('uid', 1, 'int64'))
  .add(new Field('level', 5, 'int32'))
  .add(new Field('medalName', 6, 'string'))
const giftInfoType = new Type('GiftInfo')
  .add(new Field('giftId', 1, 'int32'))
  .add(new Field('giftName', 2, 'string'))
  .add(new Field('num', 3, 'int32'))
  .add(new Field('price', 5, 'int32'))
  .add(new Field('timestamp', 10, 'int32'))
const giftMessageType = new Type('GiftMessage')
  .add(new Field('uid', 1, 'int64'))
  .add(new Field('uname', 2, 'string'))
  .add(new Field('face', 3, 'string'))
  .add(new Field('guardLevel', 5, 'int32'))
  .add(new Field('medal', 8, 'GiftMedal'))
  .add(new Field('giftInfo', 10, 'GiftInfo', 'repeated'))

new Root().add(giftMedalType).add(giftInfoType).add(giftMessageType).resolveAll()

function encodeGiftV2() {
  const bytes = giftMessageType
    .encode({
      uid: 42,
      uname: '礼物用户',
      face: 'http://example.com/avatar.jpg',
      guardLevel: 3,
      medal: { uid: 42, level: 8, medalName: '测试牌' },
      giftInfo: [
        { giftId: 1, giftName: '小花', num: 2, price: 1000, timestamp: 1_700_000_000 },
        { giftId: 2, giftName: '星星', num: 3, price: 2000, timestamp: 1_700_000_001 },
      ],
    })
    .finish()
  return Buffer.from(bytes).toString('base64')
}

async function startClient(client: DirectClient | OpenLiveClient) {
  const startPromise = client.Start()
  await vi.waitFor(() => expect(mocks.KeepLiveWSMock.instances.length).toBeGreaterThan(0))
  const socket = mocks.KeepLiveWSMock.instances.at(-1)!
  socket.emit('live')
  expect(await startPromise).toEqual({ success: true, message: '' })
  return socket
}

describe('direct danmaku event adapter', () => {
  beforeEach(() => {
    mocks.KeepLiveWSMock.instances.length = 0
  })

  it('maps current gift, SC, like and SC delete payloads through their socket events', async () => {
    const client = new DirectClient({ token: 'token', roomId: 1, tokenUserId: 2, buvid: 'buvid' })
    const gifts = vi.fn()
    const sc = vi.fn()
    const likes = vi.fn()
    const scDeletes = vi.fn()
    client.onEvent('gift', gifts).onEvent('sc', sc).onEvent('like', likes).onEvent('scDel', scDeletes)

    const socket = await startClient(client)
    socket.emit('SEND_GIFT', {
      cmd: 'SEND_GIFT',
      data: {
        uid: 10,
        uname: '旧礼物用户',
        giftName: '辣条',
        total_coin: 2000,
        num: 2,
        timestamp: 1_700_000_000,
        guard_level: 1,
        medal_info: { medal_level: 6, medal_name: '旧勋章', is_lighted: 1 },
        face: 'http://example.com/gift.jpg',
      },
    })
    socket.emit('SUPER_CHAT_MESSAGE', {
      cmd: 'SUPER_CHAT_MESSAGE',
      data: {
        uid: 11,
        message: '无勋章 SC',
        price: 30,
        medal_info: null,
        user_info: { uname: 'SC 用户', face: 'http://example.com/sc.jpg', guard_level: 0 },
      },
    })
    socket.emit('LIKE_INFO_V3_CLICK', {
      cmd: 'LIKE_INFO_V3_CLICK',
      data: {
        uid: 12,
        uname: '点赞用户',
        fans_medal: { medal_level: 4, medal_name: '点赞牌', is_lighted: 1 },
        uinfo: { base: { face: 'http://example.com/like.jpg' }, guard: { level: 2 } },
      },
    })
    socket.emit('SUPER_CHAT_MESSAGE_DELETE', {
      cmd: 'SUPER_CHAT_MESSAGE_DELETE',
      data: { ids: [100, 101] },
    })

    expect(gifts).toHaveBeenCalledWith(
      expect.objectContaining({
        fans_medal_level: 6,
        fans_medal_name: '旧勋章',
        fans_medal_wearing_status: true,
      }),
      expect.anything(),
    )
    expect(sc).toHaveBeenCalledWith(
      expect.objectContaining({ fans_medal_level: 0, fans_medal_name: '', fans_medal_wearing_status: false }),
      expect.anything(),
    )
    expect(likes).toHaveBeenCalledWith(
      expect.objectContaining({
        guard_level: 2,
        fans_medal_level: 4,
        fans_medal_name: '点赞牌',
        uface: 'https://example.com/like.jpg',
      }),
      expect.anything(),
    )
    expect(scDeletes).toHaveBeenCalledWith(
      expect.objectContaining({ type: EventDataTypes.SCDel, msg: '[100,101]' }),
      expect.anything(),
    )
    client.Stop()
  })

  it('decodes every gift in a SEND_GIFT_V2 protobuf payload', async () => {
    const client = new DirectClient({ token: 'token', roomId: 1, tokenUserId: 2, buvid: 'buvid' })
    const gifts = vi.fn()
    client.onEvent('gift', gifts)

    const socket = await startClient(client)
    socket.emit('SEND_GIFT_V2', {
      cmd: 'SEND_GIFT_V2',
      data: { pb: encodeGiftV2() },
    })

    expect(gifts).toHaveBeenCalledTimes(2)
    expect(gifts.mock.calls.map(([event]) => event.msg)).toEqual(['小花', '星星'])
    expect(gifts.mock.calls.map(([event]) => event.price)).toEqual([2, 6])
    expect(gifts.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        uid: 42,
        uname: '礼物用户',
        guard_level: 3,
        fans_medal_level: 8,
        fans_medal_name: '测试牌',
        fans_medal_wearing_status: true,
        uface: 'https://example.com/avatar.jpg',
      }),
    )
    client.Stop()
  })
})

describe('OpenLive danmaku event adapter', () => {
  const authInfo: AuthInfo = {
    Timestamp: '123',
    Code: 'code',
    Mid: 'mid',
    Caller: 'caller',
    CodeSign: 'sign',
  }

  beforeEach(() => {
    mocks.KeepLiveWSMock.instances.length = 0
    mocks.queryGet.mockReset()
    mocks.queryPost.mockReset()
    mocks.queryPost.mockResolvedValue({
      code: 200,
      message: '',
      data: {
        anchor_info: { room_id: 1 },
        websocket_info: { auth_body: '{}', wss_link: ['wss://test'] },
      },
    })
  })

  it('emits OpenLive likes and labels SC deletion correctly', async () => {
    const client = new OpenLiveClient(authInfo)
    const likes = vi.fn()
    const scDeletes = vi.fn()
    client.onEvent('like', likes).onEvent('scDel', scDeletes)

    const socket = await startClient(client)
    socket.emit('msg', {
      cmd: 'LIVE_OPEN_PLATFORM_LIKE',
      data: {
        uid: 0,
        open_id: 'open-like-user',
        uname: '开放平台用户',
        uface: 'https://example.com/open-like.jpg',
        timestamp: 1_700_000_000,
        like_text: '开放平台用户点赞了',
        like_count: 5,
        fans_medal_wearing_status: true,
        guard_level: 1,
        fans_medal_name: '开放牌',
        fans_medal_level: 9,
        msg_id: 'like-message',
        room_id: 1,
      },
    })
    socket.emit('msg', {
      cmd: 'LIVE_OPEN_PLATFORM_SUPER_CHAT_DEL',
      data: { room_id: 1, message_ids: [88], msg_id: 'delete-message' },
    })

    expect(likes).toHaveBeenCalledWith(
      expect.objectContaining({
        type: EventDataTypes.Like,
        open_id: 'open-like-user',
        ouid: 'open-like-user',
        num: 5,
        fans_medal_level: 9,
      }),
      expect.anything(),
    )
    expect(scDeletes).toHaveBeenCalledWith(
      expect.objectContaining({ type: EventDataTypes.SCDel, msg: '[88]' }),
      expect.anything(),
    )
    client.Stop()
  })
})
