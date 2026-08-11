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

    // 暗色控件边框必须比 manage surface/control(800) 更亮，placeholder 不能过暗
    expect(darkTokens.control).toBe('#27272a')
    expect(darkTokens.borderColor).toBe('#3f3f46')
    expect(darkTokens.inputBorderColor).toBe('#3f3f46')
    expect(darkTokens.placeholder).toBe('#a1a1aa')
    expect(darkOverrides.common?.borderColor).toBe('#3f3f46')
    expect(darkOverrides.Select?.peers?.InternalSelection?.border).toBe('1px solid #3f3f46')
    expect(darkOverrides.Select?.peers?.InternalSelection?.placeholderColor).toBe('#a1a1aa')
    expect(darkOverrides.Select?.peers?.InternalSelection?.textColor).toBe('#fafafa')
    expect(darkOverrides.Checkbox?.border).toBe('1px solid #3f3f46')
    expect(darkOverrides.Radio?.boxShadow).toBe('inset 0 0 0 1px #3f3f46')
    expect(darkOverrides.Radio?.buttonBorderColor).toBe('#3f3f46')
    // Switch 关闭轨必须比 manage surface(800) 更亮
    expect(darkOverrides.Switch?.railColor).toBe('#52525b')
    expect(darkOverrides.Tag?.border).toBe('1px solid #3f3f46')
    expect(darkOverrides.Pagination?.buttonBorder).toBe('1px solid #3f3f46')
    expect(darkOverrides.ColorPicker?.border).toBe('1px solid #3f3f46')
  })
})
