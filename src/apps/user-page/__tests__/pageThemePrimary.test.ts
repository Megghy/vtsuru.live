import { wcagContrast } from 'culori'
import { describe, expect, it } from 'vitest'

import { parseRgb } from '@/shared/config/theme/contrast'

import { getUserPageThemeCssVars } from '../background'

/** 用户页暗色表面（surfaceOpacity 默认 70% 叠在 #09090b 画布上） */
const DARK_SURFACE = 'rgb(24, 24, 27)'
const LIGHT_SURFACE = 'rgb(255, 255, 255)'

function sameColor(a: string, b: string) {
  const left = parseRgb(a)
  const right = parseRgb(b)
  expect(left).toBeDefined()
  expect(right).toBeDefined()
  return Math.abs(left!.r - right!.r) < 1 && Math.abs(left!.g - right!.g) < 1 && Math.abs(left!.b - right!.b) < 1
}

function contrast(vars: Record<string, string>, key: string, surface: string) {
  const fg = parseRgb(vars[key])
  const bg = parseRgb(surface)
  expect(fg, `${key} 无法解析`).toBeDefined()
  return wcagContrast(fg!, bg!)
}

describe('getUserPageThemeCssVars 主色', () => {
  it('暗色模式下把用户黑色主色修正为可读主色', () => {
    const vars = getUserPageThemeCssVars({ primaryColor: '#000000' }, true)

    expect(contrast(vars, '--vtsuru-page-primary', DARK_SURFACE)).toBeGreaterThanOrEqual(4.5)
    expect(sameColor(vars['--vtsuru-page-primary-readable'], vars['--vtsuru-page-primary'])).toBe(true)
    expect(sameColor(vars['--vtsuru-brand'], vars['--vtsuru-page-primary'])).toBe(true)
    expect(vars['--vtsuru-page-canvas-accent']).not.toBe('')
  })

  it('暗色模式下不改动仍然可读的主色', () => {
    const vars = getUserPageThemeCssVars({ primaryColor: '#4ea1ff' }, true)

    expect(sameColor(vars['--vtsuru-page-primary'], '#4ea1ff')).toBe(true)
  })

  it('亮色模式下黑色主色保持原样', () => {
    const vars = getUserPageThemeCssVars({ primaryColor: '#000000' }, false)

    expect(sameColor(vars['--vtsuru-page-primary'], '#000000')).toBe(true)
    expect(contrast(vars, '--vtsuru-page-primary', LIGHT_SURFACE)).toBeGreaterThanOrEqual(4.5)
  })

  it('主色前景与主色底保持可读对比度', () => {
    const light = getUserPageThemeCssVars({}, false)
    const dark = getUserPageThemeCssVars({}, true)

    expect(
      wcagContrast(parseRgb(light['--vtsuru-primary-fg'])!, parseRgb(light['--vtsuru-primary'])!),
    ).toBeGreaterThanOrEqual(4.5)
    expect(
      wcagContrast(parseRgb(dark['--vtsuru-primary-fg'])!, parseRgb(dark['--vtsuru-page-primary'])!),
    ).toBeGreaterThanOrEqual(4.5)
  })
})
