import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import {
  ColorPicker,
  getAreaBackgroundStyle,
  hsbToHex,
  hsbToHsl,
  hsbToRgb,
  hslToHsb,
  normalizePickerColor,
  parseColorToHsb,
  parseUserColorInput,
  rgbToHex,
  rgbToHsb,
  TRANSPARENT_SWATCH,
} from '../index'

describe('colorUtils conversion and preservation', () => {
  it('preserves alpha channel for 8-digit hex, 4-digit hex, rgba(), and transparent when showAlpha is true', () => {
    expect(normalizePickerColor('#FFFFFF00', true)).toBe('#ffffff00')
    expect(normalizePickerColor('rgba(0, 0, 0, 0)', true)).toBe('#00000000')
    expect(normalizePickerColor('rgba(20, 22, 28, 0.72)', true)).toBe('#14161cb8')
    expect(normalizePickerColor('transparent', true)).toBe(TRANSPARENT_SWATCH)
    expect(normalizePickerColor('#f0a8', true)).toBe('#ff00aa88')
  })

  it('strips alpha channel to opaque 6-digit hex when showAlpha is false', () => {
    expect(normalizePickerColor('#FFFFFF00', false)).toBe('#ffffff')
    expect(normalizePickerColor('rgba(255, 0, 0, 0.25)', false)).toBe('#ff0000')
    expect(normalizePickerColor('transparent', false)).toBe('#000000')
    expect(normalizePickerColor('#f0a8', false)).toBe('#ff00aa')
  })

  it('accepts bare hex without leading hash and rejects invalid input in parseUserColorInput', () => {
    expect(parseUserColorInput('3b82f6', true)).toBe('#3b82f6')
    expect(parseUserColorInput('ffffff00', true)).toBe('#ffffff00')
    expect(parseUserColorInput('not-a-color', true)).toBeNull()
    expect(parseUserColorInput('   ', true)).toBeNull()
  })

  it('converts HSB <-> RGB accurately', () => {
    const hsb = { h: 217, s: 76, b: 96, a: 1 }
    const rgb = hsbToRgb(hsb)
    expect(rgb.r).toBeCloseTo(59, -1)
    expect(rgb.g).toBeCloseTo(130, -1)
    expect(rgb.b).toBeCloseTo(245, -1)

    const backHsb = rgbToHsb(rgb, hsb.h)
    expect(backHsb.h).toBe(217)
    expect(backHsb.s).toBeCloseTo(76, -1)
    expect(backHsb.b).toBeCloseTo(96, -1)
  })

  it('preserves hue when converting black or white RGB back to HSB', () => {
    const black = { r: 0, g: 0, b: 0, a: 1 }
    const hsb = rgbToHsb(black, 180)
    expect(hsb.h).toBe(180)
    expect(hsb.s).toBe(0)
    expect(hsb.b).toBe(0)

    const white = { r: 255, g: 255, b: 255, a: 1 }
    const whiteHsb = rgbToHsb(white, 240)
    expect(whiteHsb.h).toBe(240)
    expect(whiteHsb.s).toBe(0)
    expect(whiteHsb.b).toBe(100)
  })

  it('converts HSB <-> HSL accurately', () => {
    const hsb = { h: 210, s: 80, b: 90, a: 0.5 }
    const hsl = hsbToHsl(hsb)
    expect(hsl.h).toBe(210)
    expect(hsl.a).toBe(0.5)

    const backHsb = hslToHsb(hsl)
    expect(backHsb.h).toBe(210)
    expect(backHsb.s).toBeCloseTo(80, -1)
    expect(backHsb.b).toBeCloseTo(90, -1)
  })

  it('generates 2D area background style containing current pure hue and linear gradients', () => {
    const style0 = getAreaBackgroundStyle(0)
    expect(style0.backgroundColor).toBe('hsl(0, 100%, 50%)')
    expect(style0.backgroundImage).toContain('linear-gradient')

    const style180 = getAreaBackgroundStyle(180)
    expect(style180.backgroundColor).toBe('hsl(180, 100%, 50%)')
  })

  it('converts between hex and color models with hsbToHex and rgbToHex', () => {
    const hsb = { h: 217, s: 76, b: 96, a: 0.5 }
    expect(hsbToHex(hsb, true)).toBe('#3b82f580')
    expect(hsbToHex(hsb, false)).toBe('#3b82f5')

    const rgb = { r: 59, g: 130, b: 246, a: 1 }
    expect(rgbToHex(rgb, true)).toBe('#3b82f6')

    const parsed = parseColorToHsb('#3b82f6', true)
    expect(parsed.h).toBe(217)
  })
})

describe('ColorPicker component', () => {
  it('renders transparent 8-digit hex value without truncating alpha', () => {
    const wrapper = mount(ColorPicker, {
      props: {
        value: '#FFFFFF00',
        showAlpha: true,
      },
    })

    expect(wrapper.text().toLowerCase()).toContain('#ffffff00')
    expect(wrapper.find('input[type="color"]').exists()).toBe(false)
  })

  it('emits 8-digit hex with alpha when committing rgba in props update', async () => {
    const wrapper = mount(ColorPicker, {
      props: {
        value: '#FFFFFF00',
        showAlpha: true,
      },
    })

    await wrapper.setProps({ value: 'rgba(20, 22, 28, 0.72)' })
    expect(wrapper.text().toLowerCase()).toContain('#14161cb8')
  })
  it('switches between hex, rgb, and hsl modes on clicking mode toggle button', async () => {
    const wrapper = mount(ColorPicker, {
      props: {
        value: '#3b82f6',
        showAlpha: true,
      },
      attachTo: document.body,
    })

    // Open popover first
    await wrapper.find('button').trigger('click')

    const modeBtn = document.body.querySelector('button[title*="切换色彩格式"]') as HTMLButtonElement
    expect(modeBtn).not.toBeNull()
    expect(modeBtn.textContent).toContain('HEX')

    modeBtn.click()
    await wrapper.vm.$nextTick()
    expect(modeBtn.textContent).toContain('RGB')

    modeBtn.click()
    await wrapper.vm.$nextTick()
    expect(modeBtn.textContent).toContain('HSL')

    modeBtn.click()
    await wrapper.vm.$nextTick()
    expect(modeBtn.textContent).toContain('HEX')

    wrapper.unmount()
  })

  it('renders 2D color area with dynamic hue background style', async () => {
    const wrapper = mount(ColorPicker, {
      props: {
        value: '#ff0000',
        showAlpha: true,
      },
      attachTo: document.body,
    })

    // Open popover first
    await wrapper.find('button').trigger('click')

    // Find the ColorAreaArea in document.body
    const area = document.body.querySelector('.cursor-crosshair [style*="background-color"]') as HTMLElement
    expect(area).not.toBeNull()
    expect(['hsl(0, 100%, 50%)', 'rgb(255, 0, 0)']).toContain(area.style.backgroundColor)
    expect(area.style.backgroundImage).toContain('linear-gradient')

    wrapper.unmount()
  })
})
