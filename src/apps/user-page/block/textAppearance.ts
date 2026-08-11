export const TEXT_EFFECTS = ['none', 'gradient', 'glow', 'shine', 'breathe', 'rainbow', 'typewriter'] as const
export const TEXT_EFFECT_INTENSITIES = ['low', 'mid', 'high'] as const

export type TextEffect = (typeof TEXT_EFFECTS)[number]
export type TextEffectIntensity = (typeof TEXT_EFFECT_INTENSITIES)[number]

export type TextAppearance = {
  effect: TextEffect
  effectIntensity: TextEffectIntensity
}

function pickEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback
}

export function normalizeTextAppearance(props: Record<string, unknown> | null | undefined): TextAppearance {
  const source = props && typeof props === 'object' ? props : {}
  return {
    effect: pickEnum(source.textEffect, TEXT_EFFECTS, 'none'),
    effectIntensity: pickEnum(source.effectIntensity, TEXT_EFFECT_INTENSITIES, 'mid'),
  }
}

export function textAppearanceClass(appearance: TextAppearance) {
  const classes = ['vtsuru-text-fx']
  if (appearance.effect !== 'none') {
    classes.push(`vtsuru-text-fx--${appearance.effect}`)
    classes.push(`vtsuru-text-fx--intensity-${appearance.effectIntensity}`)
  }
  return classes
}
