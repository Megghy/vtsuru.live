import { describe, expect, it } from 'vitest'

import { buildManageTokens, buildSiteTokens, getThemeCssVars } from '../index'

describe('getThemeCssVars', () => {
  it('creates shadcn and site semantic variables', () => {
    const light = getThemeCssVars(buildSiteTokens(false))
    const dark = getThemeCssVars(buildSiteTokens(true))

    expect(light['--background']).toBe('#ffffff')
    expect(light['--card']).toBe('#ffffff')
    expect(light['--primary']).toBe('#18181b')
    expect(light['--foreground']).toBe('#09090b')
    expect(light['--brand-foreground']).toBe('#03202d')
    expect(dark['--background']).toBe('#09090b')
    expect(dark['--foreground']).toBe('#fafafa')

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

    // Manage light: canvas=#f4f4f5, surface=#ffffff, muted(surfaceHover)=#f4f4f5
    expect([light['--background'], light['--card'], light['--muted']]).toEqual(['#f4f4f5', '#ffffff', '#f4f4f5'])

    // Manage dark: canvas=#18181b, surface=#27272a, muted(surfaceHover)=#3f3f46
    expect([dark['--background'], dark['--card'], dark['--muted']]).toEqual(['#18181b', '#27272a', '#3f3f46'])

    // 暗色控件边框必须比 manage surface/control(800) 更亮，placeholder 不能过暗
    expect(darkTokens.borderColor).toBe('#3f3f46')
    expect(darkTokens.inputBorderColor).toBe('#3f3f46')
    expect(darkTokens.placeholder).toBe('#a1a1aa')
  })
})
