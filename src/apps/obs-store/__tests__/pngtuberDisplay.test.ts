import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { OBS_STORE_API_URL } from '@/shared/config/endpoints'
import { DEFAULT_PNGTUBER_STATE } from '@/shared/pngtuber/types'

import Display from '../components/pngtuber/PngtuberDisplay.vue'

afterEach(() => {
  vi.useRealTimers()
})

describe('PNGTuber asset error recovery', () => {
  it('keeps errors across snapshots and clears them after load or removal', async () => {
    const state = structuredClone(DEFAULT_PNGTUBER_STATE)
    state.blinkEnabled = false
    state.expressions[0].idleImage = 'https://example.test/broken.png'
    const wrapper = mount(Display, { props: { state, inlineMode: true } })
    await wrapper.find('img').trigger('error')
    const latest = () => wrapper.emitted('asset-error')!.at(-1)![0]
    expect(latest()).toContain('立绘素材加载失败')
    await wrapper.setProps({ state: { ...state, scale: 1.5 } })
    expect(latest()).toContain('立绘素材加载失败')
    await wrapper.find('img').trigger('load')
    expect(latest()).toBe('')
    expect(wrapper.find('.placeholder-caption').exists()).toBe(false)
    await wrapper.find('img').trigger('error')
    const next = structuredClone(state)
    next.expressions[0].idleImage = ''
    await wrapper.setProps({ state: next })
    expect(latest()).toBe('')
    wrapper.unmount()
  })

  it('does not restart a restart-playback idle animation across blink cycles', async () => {
    vi.useFakeTimers()
    const state = structuredClone(DEFAULT_PNGTUBER_STATE)
    state.blinkEnabled = true
    state.blinkMin = 1000
    state.blinkMax = 1000
    state.blinkDuration = 120
    state.expressions[0].playback = 'restart'
    state.expressions[0].idleImage = `${OBS_STORE_API_URL}pngtuber/assets/1/${'a'.repeat(64)}`
    state.expressions[0].idleBlinkImage = `${OBS_STORE_API_URL}pngtuber/assets/1/${'b'.repeat(64)}`

    const wrapper = mount(Display, { props: { state, isSpeaking: false } })
    const initialSrc = wrapper.findAll('img.avatar-image')[0].attributes('src')
    expect(initialSrc).toContain('_play=')

    // Blink starts at 1000ms and ends at 1120ms
    await vi.advanceTimersByTimeAsync(1050)
    await vi.advanceTimersByTimeAsync(150)

    const afterBlinkSrc = wrapper.findAll('img.avatar-image')[0].attributes('src')
    expect(afterBlinkSrc).toBe(initialSrc)
    wrapper.unmount()
  })

  it('switches to shoutImage above shoutThreshold and applies expression animation overrides', async () => {
    const state = structuredClone(DEFAULT_PNGTUBER_STATE)
    state.blinkEnabled = false
    state.speakingAnimation = 'bounce'
    state.idleAnimation = 'breathe'
    state.shoutThreshold = 70
    state.expressions[0].idleImage = 'https://example.test/idle.png'
    state.expressions[0].speakingImage = 'https://example.test/speak.png'
    state.expressions[0].shoutImage = 'https://example.test/shout.png'
    state.expressions[0].speakingAnimation = 'shake'
    state.expressions[0].idleAnimation = 'float'

    const wrapper = mount(Display, { props: { state, isSpeaking: false, volume: 0 } })
    expect(wrapper.find('.avatar-motion-wrapper').classes()).toContain('idle-float')

    await wrapper.setProps({ isSpeaking: true, volume: 85 })
    expect(wrapper.find('.avatar-motion-wrapper').classes()).toContain('anim-shake')
    const activeImg = wrapper.find('img.avatar-image.is-active')
    expect(activeImg.attributes('src')).toBe('https://example.test/shout.png')
    wrapper.unmount()
  })

  it('supports wheel scaling on accessories in editable mode', async () => {
    const state = structuredClone(DEFAULT_PNGTUBER_STATE)
    state.blinkEnabled = false
    state.expressions[0].idleImage = 'https://example.test/idle.png'
    state.expressions[0].accessories = [
      {
        id: 'acc-1',
        name: '眼镜',
        image: 'https://example.test/glasses.png',
        x: 10,
        y: 20,
        scale: 1,
        rotation: 0,
        visible: 'always',
        front: true,
      },
    ]

    const wrapper = mount(Display, {
      props: { state, inlineMode: true, editableAccessories: true, selectedAccessoryId: 'acc-1' },
    })
    const acc = wrapper.find('img.accessory-image')
    await acc.trigger('wheel', { deltaY: -100 })
    expect(wrapper.emitted('update-accessory')?.[0]?.[0]).toEqual({ id: 'acc-1', scale: 1.05 })
    wrapper.unmount()
  })
})
