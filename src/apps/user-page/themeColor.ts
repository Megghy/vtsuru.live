import { formatHex, formatHex8 } from 'culori'

import { parseRgb } from '@/shared/config/theme/contrast'

export const USER_PAGE_THEME_COLOR_KEYS = [
  'primaryColor',
  'backgroundColor',
  'textColor',
  'textColorLight',
  'textColorDark',
] as const

const NORMALIZED_COLOR = /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i

export function parseUserPageColor(value: string, path = '颜色') {
  const color = parseRgb(value.trim())
  if (!color) throw new Error(`${path} 不是有效颜色`)
  return color
}

export function normalizeUserPageColor(value: unknown, path = '颜色') {
  if (typeof value !== 'string') throw new Error(`${path} 必须是颜色字符串`)
  const color = parseUserPageColor(value, path)
  return (color.alpha ?? 1) < 1 ? formatHex8(color) : formatHex(color)
}

export function isNormalizedUserPageColor(value: unknown): value is string {
  return typeof value === 'string' && NORMALIZED_COLOR.test(value)
}
