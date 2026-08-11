import { describe, expect, it } from 'bun:test'

import {
  buttonAppearanceClass,
  buttonAppearanceStyle,
  normalizeButtonAppearance,
} from '../buttonAppearance'
import { normalizeTextAppearance, textAppearanceClass } from '../textAppearance'

describe('buttonAppearance', () => {
  it('defaults to md/default/none and preserves custom colors', () => {
    const appearance = normalizeButtonAppearance({
      color: '#ff6688aa',
      textColor: '#ffffff',
      borderColor: '#112233',
      borderWidth: 2,
      opacity: 0.8,
      effect: 'pulse',
      effectIntensity: 'high',
      size: 'lg',
      radius: 'pill',
    })

    expect(appearance.size).toBe('lg')
    expect(appearance.radius).toBe('pill')
    expect(appearance.color).toBe('#ff6688aa')
    expect(appearance.textColor).toBe('#ffffff')
    expect(appearance.borderColor).toBe('#112233')
    expect(appearance.borderWidth).toBe(2)
    expect(appearance.opacity).toBe(0.8)
    expect(appearance.effect).toBe('pulse')
    expect(appearance.effectIntensity).toBe('high')

    const classes = buttonAppearanceClass(appearance, true)
    expect(classes).toContain('vtsuru-btn--custom')
    expect(classes).toContain('vtsuru-btn--effect-pulse')
    expect(classes).toContain('vtsuru-btn--bordered')
    expect(classes).toContain('vtsuru-btn--full')
    expect(classes).toContain('vtsuru-btn--size-lg')

    const style = buttonAppearanceStyle(appearance)
    expect(style.width).toBeUndefined()
    expect(style['--btn-bg']).toBe('#ff6688aa')
    expect(style['--btn-fg']).toBe('#ffffff')
    expect(style['--btn-opacity']).toBe('0.8')
  })

  it('ignores invalid colors and clamps opacity', () => {
    const appearance = normalizeButtonAppearance({
      color: 'red',
      opacity: 2,
      borderWidth: 99,
    })
    expect(appearance.color).toBeUndefined()
    expect(appearance.opacity).toBe(1)
    expect(appearance.borderWidth).toBe(8)
  })
})

describe('textAppearance', () => {
  it('normalizes text effects', () => {
    const appearance = normalizeTextAppearance({ textEffect: 'rainbow', effectIntensity: 'low' })
    expect(appearance.effect).toBe('rainbow')
    expect(appearance.effectIntensity).toBe('low')
    expect(textAppearanceClass(appearance)).toEqual([
      'vtsuru-text-fx',
      'vtsuru-text-fx--rainbow',
      'vtsuru-text-fx--intensity-low',
    ])
  })
})
