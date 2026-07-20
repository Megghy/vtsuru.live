import type { PageThemeMode } from './block/schema'

export function resolvePageThemeIsDark(mode: PageThemeMode | undefined, fallbackIsDark: boolean) {
  if (mode === 'dark') return true
  if (mode === 'light') return false
  return fallbackIsDark
}
