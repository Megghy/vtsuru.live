import { describe, expect, it } from 'vitest'

import { buildManageTokens, buildSiteTokens, getThemeCssVars } from '../index'

describe('getThemeCssVars', () => {
  it('creates site variables without exposing naive-ui internals', () => {
    const light = getThemeCssVars(buildSiteTokens(false))
    const dark = getThemeCssVars(buildSiteTokens(true))

    expect(light['--vtsuru-bg']).toBe('#ffffff')
    expect(light['--vtsuru-fg']).toBe('#09090b')
    expect(light['--vtsuru-brand-fg']).toBe('#03202d')
    expect(light['--vtsuru-primary']).toBe('#18181b')
    expect(light['--vtsuru-primary-rgb']).toBe('24, 24, 27')
    expect(dark['--vtsuru-bg']).toBe('#09090b')
    expect(dark['--vtsuru-fg']).toBe('#fafafa')
    expect(Object.keys(light).some((key) => key.startsWith('--n-'))).toBe(false)
  })

  it('keeps manage canvas, surface, and inset distinct', () => {
    const lightTokens = buildManageTokens(false)
    const darkTokens = buildManageTokens(true)
    const light = getThemeCssVars(lightTokens)
    const dark = getThemeCssVars(darkTokens)

    expect([light['--vtsuru-bg'], light['--vtsuru-bg-surface'], light['--vtsuru-bg-inset']]).toEqual([
      '#f4f4f5',
      '#ffffff',
      '#e4e4e7',
    ])
    expect(light['--vtsuru-bg-muted']).toBe('#f4f4f5')
    expect([dark['--vtsuru-bg'], dark['--vtsuru-bg-surface'], dark['--vtsuru-bg-inset']]).toEqual([
      '#18181b',
      '#27272a',
      '#09090b',
    ])

    expect(dark['--vtsuru-fg']).toBe('#fafafa')
    expect(dark['--vtsuru-fg-muted']).toBe('#a1a1aa')
    expect(dark['--vtsuru-bg-surface']).toBe('#27272a')
    expect(dark['--vtsuru-border']).toBe('#3f3f46')
    expect(dark['--vtsuru-bg-inset']).toBe('#09090b')
    expect(dark['--vtsuru-info-soft']).toBe('rgba(96, 165, 250, 0.12)')
  })
})
