import type { ThemeTokens } from './tokens'

export type GlobalThemeOverrides = Record<string, any>

export function getThemeOverrides(_t?: ThemeTokens): GlobalThemeOverrides {
  return {}
}
