import { afterEach, describe, expect, it, vi } from 'vitest'

import { GrokVoiceProvider } from './grok'
import { QwenVoiceProvider } from './qwen'

const configState = vi.hoisted(() => ({
  ttsUrl: 'https://backend.example/api/tts/',
}))

vi.mock('@/shared/config', () => ({
  getTtsApiUrl: () => configState.ttsUrl,
}))

afterEach(() => {
  configState.ttsUrl = 'https://backend.example/api/tts/'
  vi.unstubAllGlobals()
})

describe('server voice providers', () => {
  it.each([
    [GrokVoiceProvider, 'grok-tts', 'ara', 'zh'],
    [QwenVoiceProvider, 'qwen-tts', 'longanlufeng', undefined],
  ] as const)('loads voices and synthesizes through the backend for %s', async (Provider, id, voice, language) => {
    const audio = new Blob(['audio'], { type: 'audio/mpeg' })
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: voice, name: '音色' }] })
      .mockResolvedValueOnce({ ok: true, blob: async () => audio })
    vi.stubGlobal('fetch', fetch)
    const provider = new Provider(() => ({ providers: { [id]: { voice, language } }, speechInfo: { rate: 1.2 } }))

    expect(await provider.getVoices()).toEqual([{ label: '音色', value: voice }])
    expect(fetch.mock.calls[0][0]).toBe(`https://backend.example/api/tts/voices?provider=${id}`)
    expect(await provider.fetchAudio('你好')).toBe(audio)
    const [url, request] = fetch.mock.calls[1]
    expect(url).toBe('https://backend.example/api/tts/synthesize')
    expect(request.method).toBe('POST')
    expect(JSON.parse(request.body)).toEqual({
      provider: id,
      text: '你好',
      voice,
      rate: 1.2,
      ...(language ? { language } : {}),
    })
    expect(request.signal).toBeInstanceOf(AbortSignal)
  })

  it('surfaces backend errors to the caller', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ details: '渠道不可用' }) }))
    await expect(new QwenVoiceProvider(() => ({})).getVoices()).rejects.toThrow('渠道不可用')
  })

  it('dynamically uses updated TTS endpoint after API failover', async () => {
    configState.ttsUrl = 'https://failover.example/api/tts/'
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
    vi.stubGlobal('fetch', fetch)
    await new GrokVoiceProvider(() => ({})).getVoices()
    expect(fetch.mock.calls[0][0]).toBe('https://failover.example/api/tts/voices?provider=grok-tts')
  })
})
