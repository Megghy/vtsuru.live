import type { Rgb } from 'culori'
import { converter, formatRgb, interpolate, parse, wcagContrast } from 'culori'

const MIN_TEXT_CONTRAST = 4.6
const toRgb = converter('rgb')

export function parseRgb(value: string) {
  const color = parse(value)
  return color ? toRgb(color) : undefined
}

export function compositeOpaque(foreground: Rgb, background: Rgb): Rgb {
  const alpha = foreground.alpha ?? 1
  return {
    mode: 'rgb',
    r: foreground.r * alpha + background.r * (1 - alpha),
    g: foreground.g * alpha + background.g * (1 - alpha),
    b: foreground.b * alpha + background.b * (1 - alpha),
    alpha: 1,
  }
}

export function resolveOpaqueColor(value: string, background: Rgb) {
  const color = parseRgb(value)
  return color ? compositeOpaque(color, background) : undefined
}

export function ensureTextContrast(value: string, surface: Rgb, isDark: boolean, enabled = true) {
  const fallback = parseRgb(isDark ? '#fafafa' : '#09090b')
  const requested = resolveOpaqueColor(value, surface) ?? fallback
  const requestedContrast = wcagContrast(requested, surface)

  if (!enabled || requestedContrast >= MIN_TEXT_CONTRAST) {
    return { color: formatRgb(requested), contrast: requestedContrast, adjusted: false }
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
  return { color: formatRgb(color), contrast: wcagContrast(color, surface), adjusted: true }
}

export function resolveReadableTextColor(value: string, surfaceValue: string, isDark: boolean) {
  const backdrop = parseRgb(isDark ? '#09090b' : '#ffffff')
  const surface = resolveOpaqueColor(surfaceValue, backdrop) ?? backdrop
  return ensureTextContrast(value, surface, isDark).color
}

export function shiftColorForInteraction(value: string, amount: number) {
  const color = parseRgb(value)
  if (!color) return value
  const black = parseRgb('#000000')
  const white = parseRgb('#ffffff')
  const targetColor = wcagContrast(color, black) >= wcagContrast(color, white) ? black : white
  return formatRgb(interpolate([color, targetColor], 'rgb')(amount))
}

export function resolveReadableForeground(backgroundValue: string, surfaceValue: string, isDark: boolean) {
  const backdrop = parseRgb(isDark ? '#09090b' : '#ffffff')
  const surface = resolveOpaqueColor(surfaceValue, backdrop) ?? backdrop
  const background = resolveOpaqueColor(backgroundValue, surface) ?? surface
  const black = parseRgb('#09090b')
  const white = parseRgb('#fafafa')
  const foreground = wcagContrast(black, background) >= wcagContrast(white, background) ? black : white
  return ensureTextContrast(formatRgb(foreground), background, isDark).color
}
