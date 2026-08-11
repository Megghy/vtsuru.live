export const BUTTON_SIZES = ['sm', 'md', 'lg'] as const
export const BUTTON_RADII = ['default', 'pill', 'sharp', 'custom'] as const
export const BUTTON_EFFECTS = ['none', 'pulse', 'breathe', 'bounce', 'wiggle', 'glow', 'rainbow'] as const
export const BUTTON_EFFECT_INTENSITIES = ['low', 'mid', 'high'] as const

export type ButtonSize = (typeof BUTTON_SIZES)[number]
export type ButtonRadius = (typeof BUTTON_RADII)[number]
export type ButtonEffect = (typeof BUTTON_EFFECTS)[number]
export type ButtonEffectIntensity = (typeof BUTTON_EFFECT_INTENSITIES)[number]

export type ButtonAppearance = {
  size: ButtonSize
  radius: ButtonRadius
  radiusPx: number
  borderWidth: number
  borderColor?: string
  color?: string
  textColor?: string
  opacity: number
  effect: ButtonEffect
  effectIntensity: ButtonEffectIntensity
}

const THEME_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

export function isThemeColor(value: string) {
  return THEME_COLOR_RE.test(value.trim())
}

function pickEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function pickColor(value: unknown) {
  return typeof value === 'string' && isThemeColor(value) ? value.trim() : undefined
}

export function normalizeButtonAppearance(props: Record<string, unknown> | null | undefined): ButtonAppearance {
  const source = props && typeof props === 'object' ? props : {}
  const radius = pickEnum(source.radius, BUTTON_RADII, 'default')

  return {
    size: pickEnum(source.size, BUTTON_SIZES, 'md'),
    radius,
    radiusPx: clampNumber(source.radiusPx, 0, 48, 12),
    borderWidth: clampNumber(source.borderWidth, 0, 8, 0),
    borderColor: pickColor(source.borderColor),
    color: pickColor(source.color),
    textColor: pickColor(source.textColor),
    opacity: clampNumber(source.opacity, 0.15, 1, 1),
    effect: pickEnum(source.effect, BUTTON_EFFECTS, 'none'),
    effectIntensity: pickEnum(source.effectIntensity, BUTTON_EFFECT_INTENSITIES, 'mid'),
  }
}

export function buttonAppearanceClass(appearance: ButtonAppearance, fullWidth = false) {
  const classes = ['vtsuru-btn', `vtsuru-btn--size-${appearance.size}`, `vtsuru-btn--radius-${appearance.radius}`]
  if (fullWidth) classes.push('vtsuru-btn--full')
  if (appearance.effect !== 'none') {
    classes.push(`vtsuru-btn--effect-${appearance.effect}`)
    classes.push(`vtsuru-btn--intensity-${appearance.effectIntensity}`)
  }
  if (appearance.borderWidth > 0) classes.push('vtsuru-btn--bordered')
  if (appearance.color || appearance.textColor || appearance.opacity < 1 || appearance.borderColor) {
    classes.push('vtsuru-btn--custom')
  }
  return classes
}

export function buttonAppearanceStyle(appearance: ButtonAppearance): Record<string, string> {
  const style: Record<string, string> = {}
  if (appearance.radius === 'custom') style['--btn-radius'] = `${appearance.radiusPx}px`
  if (appearance.borderWidth > 0) {
    style['--btn-border-width'] = `${appearance.borderWidth}px`
    if (appearance.borderColor) style['--btn-border-color'] = appearance.borderColor
  } else if (appearance.borderColor) {
    style['--btn-border-color'] = appearance.borderColor
  }
  if (appearance.color) {
    style['--btn-bg'] = appearance.color
    style['--btn-border-color'] = appearance.borderColor || appearance.color
  }
  if (appearance.textColor) style['--btn-fg'] = appearance.textColor
  if (appearance.opacity < 1) style['--btn-opacity'] = String(appearance.opacity)
  return style
}
