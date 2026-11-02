import { colorToString, isValidColor, normalizeColor } from 'reka-ui'

const HEX_4_RE = /^#([0-9a-f])([0-9a-f])([0-9a-f])([0-9a-f])$/i
const BARE_HEX_RE = /^([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i

export const DEFAULT_SOLID_SWATCHES = [
  '#000000',
  '#ffffff',
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#10b981',
  '#06b6d4',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#64748b',
] as const

export const TRANSPARENT_SWATCH = '#00000000'

function preprocessColorString(raw: string, showAlpha: boolean): string {
  const trimmed = raw.trim()
  if (trimmed.toLowerCase() === 'transparent') {
    return showAlpha ? TRANSPARENT_SWATCH : '#000000'
  }
  const withHash = BARE_HEX_RE.test(trimmed) ? `#${trimmed}` : trimmed
  return withHash.replace(HEX_4_RE, '#$1$1$2$2$3$3$4$4')
}

export function parseUserColorInput(raw: string, showAlpha = true): string | null {
  if (!raw || !raw.trim()) return null
  const candidate = preprocessColorString(raw, showAlpha)
  if (!isValidColor(candidate)) return null
  const parsed = normalizeColor(candidate)
  const finalColor = showAlpha ? parsed : { ...parsed, alpha: 1 }
  return colorToString(finalColor, 'hex')
}

export function normalizePickerColor(
  value: string | null | undefined,
  showAlpha = true,
  fallback = '#000000',
): string {
  if (!value) return fallback
  return parseUserColorInput(value, showAlpha) ?? fallback
}
