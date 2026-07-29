import { converter, formatRgb, interpolate, parse, wcagContrast } from 'culori'
import type { Rgb } from 'culori'
import type { PageThemeMode } from './block/schema'

const MIN_TEXT_CONTRAST = 4.5
const toRgb = converter('rgb')

export interface UserPageTextTheme {
  textColor?: string
  textColorLight?: string
  textColorDark?: string
  autoTextContrast?: boolean
  backgroundColor?: string
  pageThemeMode?: PageThemeMode
}

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

function parseRgb(value: string) {
  const color = parse(value)
  return color ? toRgb(color) : undefined
}

function compositeOpaque(foreground: Rgb, background: Rgb): Rgb {
  const alpha = foreground.alpha ?? 1
  return {
    mode: 'rgb',
    r: foreground.r * alpha + background.r * (1 - alpha),
    g: foreground.g * alpha + background.g * (1 - alpha),
    b: foreground.b * alpha + background.b * (1 - alpha),
    alpha: 1,
  }
}

function resolveOpaqueColor(value: string, background: Rgb) {
  const color = parseRgb(value)
  return color ? compositeOpaque(color, background) : undefined
}

function resolveSurface(isDark: boolean, surfaceColor?: string) {
  const worstCaseBackdrop = parseRgb(isDark ? '#ffffff' : '#000000')
  return resolveOpaqueColor(
    surfaceColor ?? (isDark ? 'rgba(24, 24, 27, 0.70)' : 'rgba(255, 255, 255, 0.62)'),
    worstCaseBackdrop,
  ) ?? worstCaseBackdrop
}

export function resolveUserPageSurfaceReference(backgroundColor: string | undefined, isDark: boolean) {
  const surface = resolveSurface(isDark)
  const tint = backgroundColor?.trim() ? parseRgb(backgroundColor) : undefined
  if (!tint) return formatRgb(surface)
  return formatRgb(compositeOpaque({ ...tint, alpha: (tint.alpha ?? 1) * 0.32 }, surface))
}

function selectTextColor(theme: UserPageTextTheme | undefined, isDark: boolean) {
  const modeColor = isDark ? theme?.textColorDark : theme?.textColorLight
  const source = isDark ? 'dark' as const : 'light' as const
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
  const fallback = parseRgb(isDark ? '#fafafa' : '#09090b')
  const requested = resolveOpaqueColor(selected.value, surface) ?? fallback
  const requestedContrast = wcagContrast(requested, surface)

  if (theme?.autoTextContrast === false || requestedContrast >= MIN_TEXT_CONTRAST) {
    return {
      color: formatRgb(requested),
      contrast: requestedContrast,
      adjusted: false,
      source: selected.source,
    }
  }

  const black = parseRgb('#000000')
  const white = parseRgb('#ffffff')
  const target = wcagContrast(black, surface) >= wcagContrast(white, surface) ? black : white
  const mix = interpolate([requested, target], 'rgb')
  let low = 0
  let high = 1
  for (let index = 0; index < 12; index++) {
    const middle = (low + high) / 2
    if (wcagContrast(mix(middle), surface) >= MIN_TEXT_CONTRAST) high = middle
    else low = middle
  }
  const color = mix(high)
  return {
    color: formatRgb(color),
    contrast: wcagContrast(color, surface),
    adjusted: true,
    source: selected.source,
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
