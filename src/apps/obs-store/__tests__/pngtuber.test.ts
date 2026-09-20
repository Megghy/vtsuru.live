import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { OBS_STORE_API_URL } from '@/shared/config/endpoints'
import { normalizePngtuberState } from '@/shared/pngtuber/normalize'
import { motionIntensity, playbackSource, selectExpression, selectImage } from '@/shared/pngtuber/renderer'
import { createExpression, DEFAULT_PNGTUBER_STATE } from '@/shared/pngtuber/types'

import PngtuberDisplay from '../components/pngtuber/PngtuberDisplay.vue'

const hosted = (id: string) => `${OBS_STORE_API_URL}pngtuber/assets/12/${id}`
function state() {
  const s = structuredClone(DEFAULT_PNGTUBER_STATE)
  s.expressions[0] = {
    ...createExpression('默认'),
    id: 'default',
    idleImage: hosted('idle'),
    speakingImage: hosted('talk'),
    idleBlinkImage: hosted('blink'),
    speakingBlinkImage: hosted('talk-blink'),
  }
  s.expressions.push({ ...createExpression('暂离'), id: 'away', idleImage: hosted('away') })
  s.awayExpressionId = 'away'
  return s
}
afterEach(() => vi.useRealTimers())
describe('立绘新状态契约', () => {
  it('迁移旧 flat schema，并清除不可持久化素材', () => {
    const s = normalizePngtuberState({ idleImage: 'data:image/png;base64,AAAA', speakingImage: hosted('talk') })
    expect(s.expressions[0].idleImage).toBe('')
    expect(s.expressions[0].speakingImage).toBe(hosted('talk'))
    expect(s).not.toHaveProperty('idleImage')
    expect(s).not.toHaveProperty('isSpeaking')
  })
  it('四槽、配件及播放模式归一化后保留，且不修改输入', () => {
    const input = state()
    input.expressions[0].playback = 'once'
    input.expressions[0].accessories = [
      {
        id: 'hat',
        name: '帽子',
        image: hosted('hat'),
        x: 20,
        y: -10,
        scale: 0.5,
        rotation: 15,
        front: false,
        visible: 'idle',
      },
    ]
    expect(normalizePngtuberState(input)).toEqual(input)
    normalizePngtuberState(input).expressions[0].name = 'changed'
    expect(input.expressions[0].name).toBe('默认')
  })
  it.each([
    { expressions: [] },
    { canvasWidth: NaN },
    { intensity: 'extreme' },
    { blinkMin: 3000, blinkMax: 1000 },
    { defaultExpressionId: 'missing' },
    {
      expressions: [
        { ...createExpression('一'), id: 'same' },
        { ...createExpression('二'), id: 'same' },
      ],
    },
    { expressions: [{ ...createExpression(), idleImage: 'javascript:alert(1)' }] },
  ])('拒绝不合法的配置 %j', (input) => expect(() => normalizePngtuberState(input)).toThrow())
  it('关闭阈值不会高于开启阈值，默认状态不会被污染', () => {
    expect(normalizePngtuberState({ threshold: 5, closeThreshold: 20 }).closeThreshold).toBe(5)
    expect(DEFAULT_PNGTUBER_STATE.threshold).toBe(15)
  })
})
describe('渲染选择与资源播放', () => {
  it('无效表情回退默认，暂离优先于显式表情', () => {
    const s = state()
    expect(selectExpression(s, 'missing').id).toBe('default')
    expect(selectExpression(s, 'default', true).id).toBe('away')
    s.awayExpressionId = ''
    expect(selectExpression(s, '', true).id).toBe('default')
  })
  it('四槽与缺失眨眼图的嘴型回退正确', () => {
    const e = state().expressions[0]
    expect(selectImage(e, false, false)).toBe(e.idleImage)
    expect(selectImage(e, true, false)).toBe(e.speakingImage)
    expect(selectImage(e, false, true)).toBe(e.idleBlinkImage)
    expect(selectImage(e, true, true)).toBe(e.speakingBlinkImage)
    e.speakingBlinkImage = ''
    expect(selectImage(e, true, true)).toBe(e.speakingImage)
    e.idleImage = ''
    expect(selectImage(e, false, false)).toBe(e.speakingImage)
  })
  it('continue 地址稳定，once/restart 使用服务端播放参数', () => {
    const src = hosted('gif') + '?token=abc'
    expect(playbackSource(src, 'continue', 'x')).toBe(src)
    const once = new URL(playbackSource(src, 'once', 'x'))
    expect(once.searchParams.get('once')).toBe('true')
    expect(once.searchParams.get('token')).toBe('abc')
    expect(playbackSource(src, 'restart', 'y')).not.toContain('once=')
    expect(playbackSource(src, 'restart', 'x')).not.toBe(playbackSource(src, 'restart', 'y'))
    expect(() => playbackSource('https://example.com/a.gif', 'once', 'x')).toThrow('先上传')
    expect(() => playbackSource('https://example.com/pngtuber/assets/12/fake', 'restart', 'x')).toThrow('先上传')
  })
  it('待机和说话强度一致，音量模式按 0–100 缩放并约束异常值', () => {
    const s = state()
    s.intensity = 'energetic'
    expect(motionIntensity(s, false)).toBe(1.4)
    expect(motionIntensity(s, true)).toBe(1.4)
    s.motionMode = 'volume'
    expect(motionIntensity(s, true, 50)).toBe(0.7)
    expect(motionIntensity(s, true, NaN)).toBe(0)
    expect(motionIntensity(s, true, 200)).toBe(1.4)
    expect(motionIntensity(s, false, 0)).toBe(1.4)
  })
})
describe('展示组件', () => {
  it('continue 图节点常驻；嘴型切换不重建图片，静音和暂离覆盖说话', async () => {
    const wrapper = mount(PngtuberDisplay, { props: { state: state() } })
    const images = wrapper.findAll('.avatar-image').map((i) => i.element)
    await wrapper.setProps({ isSpeaking: true })
    expect(wrapper.find('.is-current .avatar-image.is-active').attributes('src')).toBe(hosted('talk'))
    expect(wrapper.findAll('.avatar-image').map((i) => i.element)).toEqual(images)
    await wrapper.setProps({ muted: true })
    expect(wrapper.find('.is-current .avatar-image.is-active').attributes('src')).toBe(hosted('idle'))
    await wrapper.setProps({ muted: false, away: true })
    expect(wrapper.find('.is-current .avatar-image.is-active').attributes('src')).toBe(hosted('away'))
    expect(wrapper.find('.is-speaking').exists()).toBe(false)
    wrapper.unmount()
  })
  it('眨眼期间开口选择说话眨眼槽，卸载清理计时器', async () => {
    vi.useFakeTimers()
    const s = state()
    s.blinkMin = s.blinkMax = 500
    s.blinkDuration = 100
    const wrapper = mount(PngtuberDisplay, { props: { state: s } })
    await vi.advanceTimersByTimeAsync(500)
    expect(wrapper.find('.is-current .avatar-image.is-active').attributes('src')).toBe(hosted('blink'))
    await wrapper.setProps({ isSpeaking: true })
    expect(wrapper.find('.is-current .avatar-image.is-active').attributes('src')).toBe(hosted('talk-blink'))
    await vi.advanceTimersByTimeAsync(100)
    expect(wrapper.find('.is-current .avatar-image.is-active').attributes('src')).toBe(hosted('talk'))
    wrapper.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('restart 在每次激活重播，持续显示的配件不随嘴型重播', async () => {
    const s = state()
    s.blinkEnabled = false
    s.expressions[0].playback = 'restart'
    s.expressions[0].accessories = [
      {
        id: 'hat',
        name: '',
        image: hosted('hat'),
        x: 20,
        y: -30,
        scale: 0.5,
        rotation: 10,
        visible: 'always',
        front: false,
      },
    ]
    const wrapper = mount(PngtuberDisplay, { props: { state: s } })
    const idle = wrapper.find('.is-current .avatar-image.is-active').attributes('src')
    const hat = wrapper.find('.accessory-image').attributes('src')
    expect(wrapper.find('.accessory-image').attributes('style')).toContain('z-index: 1')
    await wrapper.setProps({ isSpeaking: true })
    await wrapper.setProps({ isSpeaking: false })
    expect(wrapper.find('.is-current .avatar-image.is-active').attributes('src')).not.toBe(idle)
    expect(wrapper.find('.accessory-image').attributes('src')).toBe(hat)
    wrapper.unmount()
  })
  it('外链 once 明确报告；图片错误发出 asset-error；空态无 SVG', async () => {
    const s = state()
    s.expressions[0].idleImage = 'https://example.com/a.gif'
    s.expressions[0].playback = 'once'
    const wrapper = mount(PngtuberDisplay, { props: { state: s, inlineMode: true } })
    expect(wrapper.emitted('asset-error')?.[0]?.[0]).toContain('先上传')
    expect(wrapper.find('svg').exists()).toBe(false)
    await wrapper.setProps({ state: state() })
    await wrapper.find('.is-current .avatar-image.is-active').trigger('error')
    expect(wrapper.emitted('asset-error')?.at(-1)?.[0]).toContain('加载失败')
    wrapper.unmount()
  })
})
