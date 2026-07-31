export const PAGE_BORDER_STRENGTHS = ['none', 'subtle', 'normal', 'strong'] as const
export const PAGE_BORDER_STYLES = ['solid', 'dashed'] as const
export const PAGE_SHADOW_LEVELS = ['none', 'subtle', 'normal', 'floating'] as const
export const PAGE_SPACING_LEVELS = ['compact', 'normal', 'relaxed'] as const
export const PAGE_CONTROL_SIZES = ['compact', 'normal', 'comfortable'] as const

export type PageBorderStrength = (typeof PAGE_BORDER_STRENGTHS)[number]
export type PageBorderStyle = (typeof PAGE_BORDER_STYLES)[number]
export type PageShadowLevel = (typeof PAGE_SHADOW_LEVELS)[number]
export type PageSpacingLevel = (typeof PAGE_SPACING_LEVELS)[number]
export type PageControlSize = (typeof PAGE_CONTROL_SIZES)[number]

export interface UserPageAppearanceTheme {
  radius?: number
  borderStrength?: PageBorderStrength
  borderStyle?: PageBorderStyle
  shadowLevel?: PageShadowLevel
  surfaceOpacity?: number
  spacing?: PageSpacingLevel
  controlSize?: PageControlSize
  pageMaxWidth?: string
}

export interface UserPageThemeConfig extends UserPageAppearanceTheme {
  fontFamily?: string
  primaryColor?: string
  textColor?: string
  textColorLight?: string
  textColorDark?: string
  autoTextContrast?: boolean
  backgroundColor?: string
  pageThemeMode?: 'auto' | 'light' | 'dark'
}

const appearanceKeys = [
  'radius',
  'borderStrength',
  'borderStyle',
  'shadowLevel',
  'surfaceOpacity',
  'spacing',
  'controlSize',
  'pageMaxWidth',
] as const satisfies readonly (keyof UserPageAppearanceTheme)[]

export function getUserPageAppearanceOverrides(theme?: UserPageAppearanceTheme): UserPageAppearanceTheme {
  return Object.fromEntries(
    appearanceKeys.flatMap((key) => (theme?.[key] === undefined ? [] : [[key, theme[key]]])),
  ) as UserPageAppearanceTheme
}

export interface ResolvedUserPageAppearance {
  radius: number
  borderStrength: PageBorderStrength
  borderWidth: string
  borderStyle: PageBorderStyle
  shadowLevel: PageShadowLevel
  shadow: string
  surfaceOpacity?: number
  spacing: number
  controlSize: PageControlSize
  controlHeights: {
    small: string
    medium: string
    large: string
  }
  pageMaxWidth: string
}

const borderWidths: Record<PageBorderStrength, string> = {
  none: '0px',
  subtle: '1px',
  normal: '1px',
  strong: '2px',
}

const spacingValues: Record<PageSpacingLevel, number> = {
  compact: 10,
  normal: 16,
  relaxed: 20,
}

const controlHeights: Record<PageControlSize, ResolvedUserPageAppearance['controlHeights']> = {
  compact: { small: '24px', medium: '28px', large: '32px' },
  normal: { small: '26px', medium: '30px', large: '36px' },
  comfortable: { small: '30px', medium: '36px', large: '42px' },
}

const shadows: Record<PageShadowLevel, string> = {
  none: 'none',
  subtle: '0 1px 2px rgba(9, 9, 11, 0.04)',
  normal: '0 2px 8px rgba(9, 9, 11, 0.08)',
  floating: '0 8px 24px rgba(9, 9, 11, 0.14)',
}

function readEnum<T extends string>(theme: unknown, key: string, values: readonly T[], fallback: T): T {
  if (!theme || typeof theme !== 'object' || Array.isArray(theme)) return fallback
  const value = (theme as Record<string, unknown>)[key]
  return values.includes(value as T) ? (value as T) : fallback
}

function readNumber(theme: unknown, key: string, fallback: number, min: number, max: number) {
  if (!theme || typeof theme !== 'object' || Array.isArray(theme)) return fallback
  const value = (theme as Record<string, unknown>)[key]
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
}

export function isValidPageMaxWidth(value: string) {
  const normalized = value.trim()
  return !normalized || normalized === 'none' || /^\d+(?:\.\d+)?(?:px|%)$/.test(normalized)
}

export function resolveUserPageAppearance(theme: unknown): ResolvedUserPageAppearance {
  const borderStrength = readEnum(theme, 'borderStrength', PAGE_BORDER_STRENGTHS, 'normal')
  const shadowLevel = readEnum(theme, 'shadowLevel', PAGE_SHADOW_LEVELS, 'normal')
  const spacing = readEnum(theme, 'spacing', PAGE_SPACING_LEVELS, 'normal')
  const controlSize = readEnum(theme, 'controlSize', PAGE_CONTROL_SIZES, 'normal')
  const rawMaxWidth =
    theme && typeof theme === 'object' && !Array.isArray(theme)
      ? (theme as Record<string, unknown>).pageMaxWidth
      : undefined
  const pageMaxWidth =
    typeof rawMaxWidth === 'string' && isValidPageMaxWidth(rawMaxWidth) ? rawMaxWidth.trim() || '820px' : '820px'
  const rawOpacity = readNumber(theme, 'surfaceOpacity', -1, 15, 100)

  return {
    radius: readNumber(theme, 'radius', 6, 0, 32),
    borderStrength,
    borderWidth: borderWidths[borderStrength],
    borderStyle: readEnum(theme, 'borderStyle', PAGE_BORDER_STYLES, 'solid'),
    shadowLevel,
    shadow: shadows[shadowLevel],
    surfaceOpacity: rawOpacity < 0 ? undefined : rawOpacity,
    spacing: spacingValues[spacing],
    controlSize,
    controlHeights: controlHeights[controlSize],
    pageMaxWidth,
  }
}
