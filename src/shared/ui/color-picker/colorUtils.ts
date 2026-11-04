import { colorToString, isValidColor, normalizeColor } from 'reka-ui'

export interface HSBColor {
  h: number // 0 - 360
  s: number // 0 - 100
  b: number // 0 - 100
  a: number // 0 - 1
}

export interface RGBColor {
  r: number // 0 - 255
  g: number // 0 - 255
  b: number // 0 - 255
  a: number // 0 - 1
}

export interface HSLColor {
  h: number // 0 - 360
  s: number // 0 - 100
  l: number // 0 - 100
  a: number // 0 - 1
}

export type ColorMode = 'hex' | 'rgb' | 'hsl'

const HEX_4_RE = /^#?([0-9a-f])([0-9a-f])([0-9a-f])([0-9a-f])$/i
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

export function preprocessColorString(raw: string, showAlpha: boolean): string {
  const trimmed = raw.trim()
  if (trimmed.toLowerCase() === 'transparent') {
    return showAlpha ? TRANSPARENT_SWATCH : '#000000'
  }
  const withHash = BARE_HEX_RE.test(trimmed) ? `#${trimmed}` : trimmed
  if (HEX_4_RE.test(withHash)) {
    return withHash.replace(HEX_4_RE, (_, r, g, b, a) => `#${r}${r}${g}${g}${b}${b}${a}${a}`)
  }
  return withHash
}

/**
 * 转换 HSB 为 RGB (0-255, a: 0-1)
 */
export function hsbToRgb(hsb: HSBColor): RGBColor {
  const h = ((hsb.h % 360) + 360) % 360
  const s = Math.max(0, Math.min(100, hsb.s)) / 100
  const v = Math.max(0, Math.min(100, hsb.b)) / 100
  const a = Math.max(0, Math.min(1, hsb.a ?? 1))

  const i = Math.floor(h / 60)
  const f = h / 60 - i
  const p = v * (1 - s)
  const q = v * (1 - f * s)
  const t = v * (1 - (1 - f) * s)

  let r = 0
  let g = 0
  let b = 0
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break
    case 1: r = q; g = v; b = p; break
    case 2: r = p; g = v; b = t; break
    case 3: r = p; g = q; b = v; break
    case 4: r = t; g = p; b = v; break
    case 5: r = v; g = p; b = q; break
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
    a,
  }
}

/**
 * 转换 RGB 为 HSB，可通过 preserveHue 保持在黑白灰度时的色相
 */
export function rgbToHsb(rgb: RGBColor, preserveHue = 0): HSBColor {
  const r = Math.max(0, Math.min(255, rgb.r)) / 255
  const g = Math.max(0, Math.min(255, rgb.g)) / 255
  const b = Math.max(0, Math.min(255, rgb.b)) / 255
  const a = rgb.a !== undefined ? Math.max(0, Math.min(1, rgb.a)) : 1

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min

  let h = preserveHue
  if (delta > 0.0001) {
    if (max === r) {
      h = 60 * (((g - b) / delta) % 6)
    } else if (max === g) {
      h = 60 * ((b - r) / delta + 2)
    } else {
      h = 60 * ((r - g) / delta + 4)
    }
    if (h < 0) h += 360
  }

  const s = max === 0 ? 0 : (delta / max) * 100
  const v = max * 100

  return {
    h: Math.round(h),
    s: Math.round(s),
    b: Math.round(v),
    a: Number(a.toFixed(4)),
  }
}

/**
 * 转换 HSB 为 HSL
 */
export function hsbToHsl(hsb: HSBColor): HSLColor {
  const s = Math.max(0, Math.min(100, hsb.s)) / 100
  const v = Math.max(0, Math.min(100, hsb.b)) / 100
  const l = v * (1 - s / 2)
  const sl = l === 0 || l === 1 ? 0 : (v - l) / Math.min(l, 1 - l)

  return {
    h: Math.round(hsb.h),
    s: Math.round(sl * 100),
    l: Math.round(l * 100),
    a: hsb.a,
  }
}

/**
 * 转换 HSL 为 HSB
 */
export function hslToHsb(hsl: HSLColor, preserveHue?: number): HSBColor {
  const s = Math.max(0, Math.min(100, hsl.s)) / 100
  const l = Math.max(0, Math.min(100, hsl.l)) / 100
  const v = l + s * Math.min(l, 1 - l)
  const sv = v === 0 ? 0 : 2 * (1 - l / v)

  return {
    h: preserveHue !== undefined && hsl.s === 0 ? preserveHue : Math.round(hsl.h),
    s: Math.round(sv * 100),
    b: Math.round(v * 100),
    a: hsl.a,
  }
}

/**
 * 转换 RGB 为十六进制字符串
 */
export function rgbToHex(rgb: RGBColor, showAlpha = true): string {
  const toHex2 = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  const hex = `#${toHex2(rgb.r)}${toHex2(rgb.g)}${toHex2(rgb.b)}`
  if (!showAlpha) return hex
  if (rgb.a === 1 || rgb.a === undefined) return hex
  const aHex = Math.round(Math.max(0, Math.min(1, rgb.a)) * 255).toString(16).padStart(2, '0')
  return `${hex}${aHex}`
}

/**
 * 转换 HSB 为十六进制字符串
 */
export function hsbToHex(hsb: HSBColor, showAlpha = true): string {
  return rgbToHex(hsbToRgb(hsb), showAlpha)
}

/**
 * 转换十六进制字符串为 RGB
 */
export function hexToRgb(hex: string): RGBColor | null {
  const cleaned = hex.trim().replace(/^#/, '')
  if (cleaned.length === 3) {
    const r = parseInt(cleaned[0] + cleaned[0], 16)
    const g = parseInt(cleaned[1] + cleaned[1], 16)
    const b = parseInt(cleaned[2] + cleaned[2], 16)
    return { r, g, b, a: 1 }
  }
  if (cleaned.length === 4) {
    const r = parseInt(cleaned[0] + cleaned[0], 16)
    const g = parseInt(cleaned[1] + cleaned[1], 16)
    const b = parseInt(cleaned[2] + cleaned[2], 16)
    const a = parseInt(cleaned[3] + cleaned[3], 16) / 255
    return { r, g, b, a: Number(a.toFixed(4)) }
  }
  if (cleaned.length === 6) {
    const r = parseInt(cleaned.slice(0, 2), 16)
    const g = parseInt(cleaned.slice(2, 4), 16)
    const b = parseInt(cleaned.slice(4, 6), 16)
    return { r, g, b, a: 1 }
  }
  if (cleaned.length === 8) {
    const r = parseInt(cleaned.slice(0, 2), 16)
    const g = parseInt(cleaned.slice(2, 4), 16)
    const b = parseInt(cleaned.slice(4, 6), 16)
    const a = parseInt(cleaned.slice(6, 8), 16) / 255
    return { r, g, b, a: Number(a.toFixed(4)) }
  }
  return null
}

/**
 * 解析用户输入的任意合法颜色字符串并输出标准 HEX
 */
export function parseUserColorInput(raw: string, showAlpha = true): string | null {
  if (!raw || !raw.trim()) return null
  const candidate = preprocessColorString(raw, showAlpha)
  if (!isValidColor(candidate)) return null
  const parsed = normalizeColor(candidate)
  const finalColor = showAlpha ? parsed : { ...parsed, alpha: 1 }
  return colorToString(finalColor, 'hex')
}

/**
 * 格式化输出归一化十六进制颜色字符串
 */
export function normalizePickerColor(
  value: string | null | undefined,
  showAlpha = true,
  fallback = '#000000',
): string {
  if (!value) return fallback
  return parseUserColorInput(value, showAlpha) ?? fallback
}

/**
 * 将用户颜色输入解析为内部 HSB 状态
 */
export function parseColorToHsb(raw: string, showAlpha = true, currentHue = 0): HSBColor {
  const hex = parseUserColorInput(raw, showAlpha) ?? '#000000'
  const rgb = hexToRgb(hex) ?? { r: 0, g: 0, b: 0, a: 1 }
  return rgbToHsb(rgb, currentHue)
}

/**
 * 根据色相 (0-360) 生成 2D 颜色选取板的完整渐变背景样式
 */
export function getAreaBackgroundStyle(hue: number): Record<string, string> {
  const pureHueColor = `hsl(${Math.round(hue)}, 100%, 50%)`
  return {
    backgroundColor: pureHueColor,
    backgroundImage: 'linear-gradient(to top, #000000, transparent), linear-gradient(to right, #ffffff, transparent)',
  }
}
