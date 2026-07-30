import { describe, expect, it } from 'vitest'

import { buildManageTokens, buildSiteTokens, getThemeCssVars, getThemeOverrides } from '../index'

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

    const darkOverrides = getThemeOverrides(darkTokens)
    expect(darkOverrides.common?.textColor2).toBe('#fafafa')
    expect(darkOverrides.common?.textColor3).toBe('#a1a1aa')
    expect(darkOverrides.Card?.color).toBe('#27272a')
    expect(darkOverrides.Card?.borderColor).toBe('#3f3f46')
    expect(darkOverrides.Card?.colorEmbedded).toBe('#09090b')
    expect(darkOverrides.Alert?.colorInfo).toBe('rgba(96, 165, 250, 0.16)')
    expect(darkOverrides.Alert?.borderInfo).toBe('1px solid rgba(96, 165, 250, 0.42)')
  })
})
