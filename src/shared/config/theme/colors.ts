/**
 * 调色板：所有颜色字面量统一在此声明，避免散落在 overrides 内。
 *
 * 命名遵循 Tailwind 习惯：50（最浅）→ 950（最深）。
 * 暗色模式应该“反向取色”而不是另写一套主题。
 */

export const neutral = {
  50: '#fafafa',
  100: '#f4f4f5',
  200: '#e4e4e7',
  300: '#d4d4d8',
  400: '#a1a1aa',
  500: '#71717a',
  600: '#52525b',
  700: '#3f3f46',
  800: '#27272a',
  900: '#18181b',
  950: '#09090b',
} as const

// VTsuru 品牌色（基于 logo ic_vtuber.svg 主色 #23ADE5 校准的 sky-cyan）
// 仅用于具有“品牌曝光”意义的位置：loading、switch active、关键 CTA 渐变、品牌头像描边等。
// 不替代 primary（primary 仍是中性灰阶，shadcn 风格）。
export const brand = {
  50: '#e8f7fc',
  100: '#cdecf7',
  200: '#9ddaee',
  300: '#5fc3e3',
  400: '#23ade5',
  500: '#0d92cc',
  600: '#0a76a4',
  700: '#085c80',
  800: '#06425c',
  900: '#03202d',
} as const

export const info = {
  light: '#2563eb',
  lightHover: '#3b82f6',
  lightPressed: '#1d4ed8',
  lightSuppl: '#1e40af',
  dark: '#60a5fa',
  darkHover: '#93c5fd',
  darkPressed: '#3b82f6',
  darkSuppl: '#1d4ed8',
} as const

export const success = {
  light: '#16a34a',
  lightHover: '#22c55e',
  lightPressed: '#15803d',
  lightSuppl: '#14532d',
  dark: '#4ade80',
  darkHover: '#86efac',
  darkPressed: '#22c55e',
  darkSuppl: '#15803d',
} as const

export const warning = {
  light: '#d97706',
  lightHover: '#f59e0b',
  lightPressed: '#b45309',
  lightSuppl: '#78350f',
  dark: '#fbbf24',
  darkHover: '#fcd34d',
  darkPressed: '#f59e0b',
  darkSuppl: '#b45309',
} as const

export const error = {
  light: '#dc2626',
  lightHover: '#ef4444',
  lightPressed: '#b91c1c',
  lightSuppl: '#7f1d1d',
  dark: '#f87171',
  darkHover: '#fca5a5',
  darkPressed: '#ef4444',
  darkSuppl: '#b91c1c',
} as const

export function hexToRgb(hex: string) {
  const normalized = hex.startsWith('#') ? hex.slice(1) : hex
  if (!/^[0-9a-f]{6}$/i.test(normalized)) throw new Error(`Invalid hex color: ${hex}`)
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  }
}

export function rgba(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * 单一来源的“按模式取色”辅助。
 * 例：pickByMode(isDark, info.light, info.dark)
 */
export function pickByMode<T>(isDark: boolean, light: T, dark: T): T {
  return isDark ? dark : light
}
