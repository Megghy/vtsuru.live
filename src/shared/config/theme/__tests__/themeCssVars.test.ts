import { describe, expect, it } from 'vitest'

import { buildManageTokens, buildSiteTokens, getThemeCssVars } from '../index'

describe('getThemeCssVars', () => {
  it('creates shadcn and site semantic variables', () => {
    const light = getThemeCssVars(buildSiteTokens(false))
    const dark = getThemeCssVars(buildSiteTokens(true))

    expect(light['--background']).toBe('#fafafa')
    expect(light['--card']).toBe('#ffffff')
    expect(light['--popover']).toBe('#ffffff')
    expect(light['--background']).not.toBe(light['--card'])
    expect(light['--primary']).toBe('#18181b')
    expect(light['--foreground']).toBe('#09090b')
    expect(light['--brand-foreground']).toBe('#03202d')
    expect(dark['--background']).toBe('#09090b')
    expect(dark['--foreground']).toBe('#fafafa')
    expect(
      new Set([
        dark['--background'],
        dark['--card'],
        dark['--popover'],
        dark['--muted'],
        dark['--accent'],
        dark['--border'],
      ]).size,
    ).toBe(6)

    // 统一控件尺寸变量验证
    expect(light['--control-h-xs']).toBe('28px')
    expect(light['--control-h-sm']).toBe('32px')
    expect(light['--control-h-default']).toBe('36px')
    expect(light['--control-h-lg']).toBe('40px')

    // 不应该有旧的 Naive UI 变量
    expect(Object.keys(light).some((key) => key.startsWith('--n-'))).toBe(false)
  })

  it('keeps manage canvas, surface, and inset distinct', () => {
    const lightTokens = buildManageTokens(false)
    const darkTokens = buildManageTokens(true)
    const light = getThemeCssVars(lightTokens)
    const dark = getThemeCssVars(darkTokens)

    // Manage light: canvas=#f4f4f5, surface=#ffffff, muted=#e4e4e7, inset=#f4f4f5
    expect([light['--background'], light['--card'], light['--muted'], light['--inset']]).toEqual([
      '#f4f4f5',
      '#ffffff',
      '#e4e4e7',
      '#f4f4f5',
    ])

    // Manage dark: canvas=#18181b, popover=#202024, surface=#27272a, muted=#323238, inset=#09090b
    expect([dark['--background'], dark['--popover'], dark['--card'], dark['--muted'], dark['--inset']]).toEqual([
      '#18181b',
      '#202024',
      '#27272a',
      '#323238',
      '#09090b',
    ])
    expect(
      new Set([dark['--background'], dark['--popover'], dark['--card'], dark['--muted'], dark['--border']]).size,
    ).toBe(5)

    // 暗色控件边框必须比 manage surface/control(800) 更亮，placeholder 不能过暗
    expect(darkTokens.borderColor).toBe('#3f3f46')
    expect(darkTokens.inputBorderColor).toBe('#3f3f46')
    expect(darkTokens.placeholder).toBe('#a1a1aa')
  })
})
