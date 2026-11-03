import { describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'

import { attachCustomHtmlBridge, createSandboxSdkSource } from '../customHtmlBridge'

describe('custom HTML bridge', () => {
  it('exposes the sandbox SDK and keeps each instance channel scoped', () => {
    const source = createSandboxSdkSource('channel-1', { cover: 'https://cos.example/cover.png' })
    expect(source).toContain("window,'vtsuru'")
    expect(source).toContain('channel-1')
    expect(source).toContain('getQuestions')
    expect(source).toContain('sdk.getAssetUrl=key=>Object.hasOwn(assets,key)?assets[key]:null')
    expect(source).toContain('cos.example/cover.png')
    expect(source).toContain('Bridge request timed out')
  })

  it('accepts requests only from its iframe and replies through the bound channel', async () => {
    const frame = document.createElement('iframe')
    document.body.append(frame)
    const handler = vi.fn(async (params) => ({ params }))
    const detach = attachCustomHtmlBridge({ frame, channelId: 'bound', handlers: { getContext: handler } })
    const postMessage = vi.spyOn(frame.contentWindow!, 'postMessage')
    const request = {
      __vtsuruBridge: true,
      channelId: 'bound',
      direction: 'to-host',
      requestId: 1,
      method: 'getContext',
      params: 7,
    }

    window.dispatchEvent(new MessageEvent('message', { source: window, data: request }))
    expect(handler).not.toHaveBeenCalled()
    window.dispatchEvent(new MessageEvent('message', { source: frame.contentWindow, data: request }))
    await vi.waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ channelId: 'bound', requestId: 1, ok: true, data: { params: 7 } }),
        '*',
      ),
    )

    detach()
    frame.remove()
  })

  it('unwraps nested Vue proxies before posting handler results to the iframe', async () => {
    const frame = document.createElement('iframe')
    document.body.append(frame)
    const replies: unknown[] = []
    const postMessage = vi.spyOn(frame.contentWindow!, 'postMessage').mockImplementation((message) => {
      replies.push(structuredClone(message))
    })
    const profile = reactive({ followers: 12, vip: { label: { text: 'VIP' } } })
    const handler = vi.fn(() => ({ streamer: { name: 'Owner' }, bili: { ...profile } }))
    const detach = attachCustomHtmlBridge({ frame, channelId: 'reactive', handlers: { getContext: handler } })

    window.dispatchEvent(
      new MessageEvent('message', {
        source: frame.contentWindow,
        data: {
          __vtsuruBridge: true,
          channelId: 'reactive',
          direction: 'to-host',
          requestId: 1,
          method: 'getContext',
        },
      }),
    )

    await vi.waitFor(() =>
      expect(replies).toContainEqual(
        expect.objectContaining({
          channelId: 'reactive',
          requestId: 1,
          ok: true,
          data: { streamer: { name: 'Owner' }, bili: { followers: 12, vip: { label: { text: 'VIP' } } } },
        }),
      ),
    )
    expect(postMessage).toHaveBeenCalledTimes(1)

    detach()
    frame.remove()
  })

  it('posts reactive context and theme events as cloneable data', () => {
    const frame = document.createElement('iframe')
    document.body.append(frame)
    const replies: unknown[] = []
    vi.spyOn(frame.contentWindow!, 'postMessage').mockImplementation((message) => {
      replies.push(structuredClone(message))
    })
    const detach = attachCustomHtmlBridge({ frame, channelId: 'events', handlers: {} })
    const theme = reactive({
      isDark: true,
      primaryColor: '#18a058',
      accentColor: '#18a058',
      bgColor: '#000',
      fgColor: '#fff',
      cardBg: '#111',
      borderColor: '#222',
      mutedColor: '#aaa',
    })
    const context = { bili: reactive({ vip: { label: { text: 'VIP' } } }) }

    expect(() => detach.emitThemeChange(theme)).not.toThrow()
    expect(() => detach.emitContextChange(context)).not.toThrow()
    expect(replies).toEqual([
      expect.objectContaining({ direction: 'event', event: 'theme-change', payload: theme }),
      expect.objectContaining({ direction: 'event', event: 'context-change', payload: context }),
    ])

    detach()
    frame.remove()
  })

  it('rejects bridge calls whose results cannot be serialized', async () => {
    const frame = document.createElement('iframe')
    document.body.append(frame)
    const replies: unknown[] = []
    vi.spyOn(frame.contentWindow!, 'postMessage').mockImplementation((message) => {
      replies.push(structuredClone(message))
    })
    const circular: Record<string, unknown> = {}
    circular.self = circular
    const detach = attachCustomHtmlBridge({
      frame,
      channelId: 'invalid-result',
      handlers: { getContext: () => circular },
    })

    window.dispatchEvent(
      new MessageEvent('message', {
        source: frame.contentWindow,
        data: {
          __vtsuruBridge: true,
          channelId: 'invalid-result',
          direction: 'to-host',
          requestId: 1,
          method: 'getContext',
        },
      }),
    )

    await vi.waitFor(() =>
      expect(replies).toContainEqual(
        expect.objectContaining({
          channelId: 'invalid-result',
          requestId: 1,
          ok: false,
          error: expect.any(String),
        }),
      ),
    )

    detach()
    frame.remove()
  })

  it('rejects wrong channels and limits each iframe to 20 burst requests', async () => {
    const frame = document.createElement('iframe')
    document.body.append(frame)
    const handler = vi.fn(() => true)
    const detach = attachCustomHtmlBridge({ frame, channelId: 'limited', handlers: { getContext: handler } })
    const postMessage = vi.spyOn(frame.contentWindow!, 'postMessage')
    const request = (requestId: number, channelId = 'limited') =>
      window.dispatchEvent(
        new MessageEvent('message', {
          source: frame.contentWindow,
          data: { __vtsuruBridge: true, channelId, direction: 'to-host', requestId, method: 'getContext' },
        }),
      )
    request(1, 'other')
    expect(handler).not.toHaveBeenCalled()
    for (let id = 1; id <= 21; id++) request(id)
    await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(20))
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 21, ok: false, error: 'Rate limit exceeded' }),
      '*',
    )
    detach()
    frame.remove()
  })
})
