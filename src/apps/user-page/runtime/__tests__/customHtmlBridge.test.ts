import { describe, expect, it, vi } from 'vitest'

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
