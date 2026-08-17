import { reactive } from 'vue'
import { describe, expect, it } from 'vitest'

import { postBroadcastMessage, toCloneable } from '../broadcastChannel'

describe('toCloneable', () => {
  it('unwraps nested vue proxies into structured-cloneable plain data', () => {
    const list = reactive([
      { id: 1, name: '辣条', nested: { price: 0.1 } },
      { id: 2, name: '小花花', nested: { price: 1 } },
    ])
    // 模拟业务侧常见写法：展开 reactive 数组后元素仍是 Proxy
    const payload = { type: 'gift-list', data: [...list] }

    expect(() => structuredClone(payload)).toThrow()

    const plain = toCloneable(payload)
    expect(() => structuredClone(plain)).not.toThrow()
    expect(plain).toEqual({
      type: 'gift-list',
      data: [
        { id: 1, name: '辣条', nested: { price: 0.1 } },
        { id: 2, name: '小花花', nested: { price: 1 } },
      ],
    })
  })

  it('drops undefined fields while keeping null and empty strings', () => {
    expect(
      toCloneable({
        type: 'danmaku',
        msg: '',
        emoji: undefined,
        id: null,
      }),
    ).toEqual({
      type: 'danmaku',
      msg: '',
      id: null,
    })
  })
})

describe('postBroadcastMessage', () => {
  it('posts cloneable payloads without throwing on reactive data', () => {
    const received: unknown[] = []
    class Channel {
      postMessage(data: unknown) {
        structuredClone(data)
        received.push(data)
      }
    }
    const channel = new Channel() as unknown as BroadcastChannel
    const data = reactive({ type: 'rank-list', data: [{ score: 10 }] })

    expect(() => postBroadcastMessage(channel, data)).not.toThrow()
    expect(received).toEqual([{ type: 'rank-list', data: [{ score: 10 }] }])
  })

  it('no-ops when channel is missing', () => {
    expect(() => postBroadcastMessage(undefined, { type: 'clear' })).not.toThrow()
  })
})
