import type { Rgb } from 'culori'
import { formatRgb, interpolate, wcagContrast } from 'culori'

import { compositeOpaque, ensureTextContrast, parseRgb, resolveOpaqueColor } from '@/shared/config/theme/contrast'

import type { PageThemeMode } from './block/schema'
import type { UserPageThemeConfig } from './themeConfig'

const MIN_TEXT_CONTRAST = 4.5

export type UserPageTextTheme = Pick<
  UserPageThemeConfig,
  | 'fontFamily'
  | 'textColor'
  | 'textColorLight'
  | 'textColorDark'
  | 'autoTextContrast'
  | 'backgroundColor'
  | 'pageThemeMode'
>

export interface ResolvedUserPageTextColor {
  color: string
  contrast: number
  adjusted: boolean
  source: 'base' | 'light' | 'dark' | 'default'
}

export interface ResolvedUserPageTextPalette extends ResolvedUserPageTextColor {
  muted: string
  subtle: string
}

export function resolvePageThemeIsDark(mode: PageThemeMode | undefined, fallbackIsDark: boolean) {
  if (mode === 'dark') return true
  if (mode === 'light') return false
  return fallbackIsDark
}

function resolveSurface(isDark: boolean, surfaceColor?: string) {
  const worstCaseBackdrop = parseRgb(isDark ? '#ffffff' : '#000000')
  return (
    resolveOpaqueColor(
      surfaceColor ?? (isDark ? 'rgba(24, 24, 27, 0.70)' : 'rgba(255, 255, 255, 0.62)'),
      worstCaseBackdrop,
    ) ?? worstCaseBackdrop
  )
}

export function resolveUserPageSurfaceReference(backgroundColor: string | undefined, isDark: boolean) {
  const surface = resolveSurface(isDark)
  const tint = backgroundColor?.trim() ? parseRgb(backgroundColor) : undefined
  if (!tint) return formatRgb(surface)
  return formatRgb(compositeOpaque({ ...tint, alpha: (tint.alpha ?? 1) * 0.32 }, surface))
}

function selectTextColor(theme: UserPageTextTheme | undefined, isDark: boolean) {
  const modeColor = isDark ? theme?.textColorDark : theme?.textColorLight
  const source = isDark ? ('dark' as const) : ('light' as const)
  if (modeColor?.trim()) return { value: modeColor, source }
  if (theme?.textColor?.trim()) return { value: theme.textColor, source: 'base' as const }
  return { value: isDark ? '#fafafa' : '#09090b', source: 'default' as const }
}

export function resolveUserPageTextColor(
  theme: UserPageTextTheme | undefined,
  isDark: boolean,
  surfaceColor?: string,
): ResolvedUserPageTextColor {
  const surface = resolveSurface(
    isDark,
    surfaceColor ?? resolveUserPageSurfaceReference(theme?.backgroundColor, isDark),
  )
  const selected = selectTextColor(theme, isDark)
  return {
    ...ensureTextContrast(selected.value, surface, isDark, theme?.autoTextContrast !== false),
    source: selected.source,
  }
}

export function resolveUserPageReadableAccent(
  primaryColor: string | undefined,
  backgroundColor: string | undefined,
  isDark: boolean,
  surfaceColor?: string,
) {
  if (!primaryColor?.trim()) return ''
  const surface = resolveSurface(isDark, surfaceColor ?? resolveUserPageSurfaceReference(backgroundColor, isDark))
  const accent = parseRgb(primaryColor)
  const activeSurface = accent ? compositeOpaque({ ...accent, alpha: (accent.alpha ?? 1) * 0.14 }, surface) : surface
  return ensureTextContrast(primaryColor, activeSurface, isDark).color
}

export function resolveUserPageControlOverlay(value: string) {
  const color = parseRgb(value)
  const white = parseRgb('#ffffff')
  const luminance = color ? 1.05 / wcagContrast(white, { ...color, alpha: 1 }) - 0.05 : 0
  const alpha = Math.min(0.46, 0.18 + luminance * 0.52)
  return {
    color: formatRgb({ ...white, alpha }),
    focus: formatRgb({ ...white, alpha: Math.min(0.52, alpha + 0.06) }),
    disabled: formatRgb({ ...white, alpha: alpha * 0.56 }),
  }
}

function deriveMutedColor(textColor: string, surface: Rgb, desiredStrength: number) {
  const text = parseRgb(textColor)
  const mix = interpolate([surface, text], 'rgb')
  if (wcagContrast(mix(desiredStrength), surface) >= MIN_TEXT_CONTRAST) return formatRgb(mix(desiredStrength))
  let low = desiredStrength
  let high = 1
  for (let index = 0; index < 12; index++) {
    const middle = (low + high) / 2
    if (wcagContrast(mix(middle), surface) >= MIN_TEXT_CONTRAST) high = middle
    else low = middle
  }
  return formatRgb(mix(high))
}

export function resolveUserPageTextPalette(
  theme: UserPageTextTheme | undefined,
  isDark: boolean,
  surfaceColor?: string,
): ResolvedUserPageTextPalette {
  const text = resolveUserPageTextColor(theme, isDark, surfaceColor)
  const surface = resolveSurface(
    isDark,
    surfaceColor ?? resolveUserPageSurfaceReference(theme?.backgroundColor, isDark),
  )
  return {
    ...text,
    muted: deriveMutedColor(text.color, surface, 0.76),
    subtle: deriveMutedColor(text.color, surface, 0.62),
  }
}
