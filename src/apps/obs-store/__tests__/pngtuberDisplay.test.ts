import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { DEFAULT_PNGTUBER_STATE } from '@/shared/pngtuber/types'

import Display from '../components/pngtuber/PngtuberDisplay.vue'

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
})
