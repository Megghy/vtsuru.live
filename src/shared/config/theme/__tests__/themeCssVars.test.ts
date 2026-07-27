import { describe, expect, it } from 'vitest'
import { buildTokens, getThemeCssVars } from '../index'

describe('getThemeCssVars', () => {
  it('creates an isolated semantic variable set for each theme', () => {
    const light = getThemeCssVars(buildTokens(false))
    const dark = getThemeCssVars(buildTokens(true))

    expect(light['--vtsuru-bg']).toBe('#ffffff')
    expect(light['--vtsuru-fg']).toBe('#09090b')
    expect(dark['--vtsuru-bg']).toBe('#09090b')
    expect(dark['--vtsuru-fg']).toBe('#fafafa')
    expect(light['--n-body-color']).not.toBe(dark['--n-body-color'])
    expect(light['--n-text-color']).not.toBe(dark['--n-text-color'])
  })
})
