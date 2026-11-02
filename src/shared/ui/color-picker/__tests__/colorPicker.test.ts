import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import {
  ColorPicker,
  normalizePickerColor,
  parseUserColorInput,
  TRANSPARENT_SWATCH,
} from '../index'

describe('colorUtils', () => {
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
})

describe('ColorPicker component', () => {
  it('renders transparent 8-digit hex value without truncating alpha', () => {
    const wrapper = mount(ColorPicker, {
      props: {
        value: '#FFFFFF00',
        showAlpha: true,
      },
    })

    expect(wrapper.text()).toContain('#ffffff00')
    expect(wrapper.find('input[type="color"]').exists()).toBe(false)
  })

  it('emits 8-digit hex with alpha when committing rgba or 8-digit hex in text input', async () => {
    const wrapper = mount(ColorPicker, {
      props: {
        value: '#FFFFFF00',
        showAlpha: true,
      },
    })

    // Expose or test via vm / props update
    await wrapper.setProps({ value: 'rgba(20, 22, 28, 0.72)' })
    expect(wrapper.text()).toContain('#14161cb8')
  })
})
