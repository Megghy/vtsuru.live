import { converter, formatRgb, interpolate, parse, wcagLuminance } from '@/shared/config/theme/culori'

import type { KeycastColorMode, KeycastTheme } from './types'

export interface KeycastCanvasPalette {
  shellFill: string
  shellStroke: string
  shellStrokeWidth: number
  shellShadowColor: string
  shellShadowBlur: number
  keyFill: string
  keyStroke: string
  keyBottomFill: string
  keyText: string
  keySubText: string
  keyCornerRadius: number
  keyPressOffset: number
  accentFill: string
  accentGlow: string
  accentStroke: string
  activeText: string
  mouseBodyFill: string
  mouseBodyStroke: string
  mousePartFill: string
  mousePartStroke: string
  mouseSeamStroke: string
  mouseText: string
  hudFill: string
  hudStroke: string
  hudText: string
  textShadowColor?: string
}

export interface DynamicAccentTokens {
  fill: string
  stroke: string
  glow: string
  activeText: string
}

const FALLBACK_ACCENT = '#38bdf8'
const toOklch = converter('oklch')

const MOVEMENT_CODES = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])
const SKILL_CODES = new Set([
  'Digit1',
  'Digit2',
  'Digit3',
  'Digit4',
  'Digit5',
  'Digit6',
  'KeyQ',
  'KeyE',
  'KeyR',
  'KeyF',
  'KeyZ',
  'KeyX',
  'KeyC',
  'KeyV',
])
const MODIFIER_CODES = new Set([
  'Escape',
  'Tab',
  'CapsLock',
  'ShiftLeft',
  'ShiftRight',
  'ControlLeft',
  'ControlRight',
  'AltLeft',
  'AltRight',
  'MetaLeft',
  'MetaRight',
  'Enter',
  'Backspace',
  'ContextMenu',
])

export function normalizeAccentColor(color: string | undefined): string {
  if (color && parse(color)) return color
  return FALLBACK_ACCENT
}

export function withAlpha(color: string, alpha: number): string {
  const parsed = parse(color) ?? parse(FALLBACK_ACCENT)!
  return formatRgb({ ...parsed, alpha: Math.max(0, Math.min(1, alpha)) })
}

export function blendColors(baseColor: string, targetColor: string, ratio: number): string {
  const clamped = Math.max(0, Math.min(1, ratio))
  const mix = interpolate([baseColor, targetColor], 'oklab')
  return formatRgb(mix(clamped))
}

function getZoneHueShift(keyOrButton: string): number {
  if (MOVEMENT_CODES.has(keyOrButton) || keyOrButton === 'left') return 0
  if (SKILL_CODES.has(keyOrButton) || keyOrButton === 'right') return 48
  if (MODIFIER_CODES.has(keyOrButton) || keyOrButton === 'back' || keyOrButton === 'forward') return 145
  if (keyOrButton === 'Space' || keyOrButton === 'middle') return -55
  return 24
}

/**
 * 按配色方案（单色强调 / 流动彩虹 / 电竞分区）与主题推导单个键位或鼠标按键的高亮色板
 */
export function resolveKeyAccentTokens(
  palette: KeycastCanvasPalette,
  theme: KeycastTheme,
  rawAccent: string,
  colorMode: KeycastColorMode,
  normX: number,
  keyOrButton: string,
  nowMs: number,
): DynamicAccentTokens {
  if (colorMode === 'solid') {
    return {
      fill: palette.accentFill,
      stroke: palette.accentStroke,
      glow: palette.accentGlow,
      activeText: palette.activeText,
    }
  }

  let dynamicHex: string
  if (colorMode === 'rainbow') {
    const hue = (((normX * 260 + nowMs * 0.06) % 360) + 360) % 360
    dynamicHex = formatRgb({ mode: 'oklch', l: 0.72, c: 0.17, h: hue })
  } else {
    const baseOklch = toOklch(parse(normalizeAccentColor(rawAccent))!)
    const hueShift = getZoneHueShift(keyOrButton)
    const hue = ((((baseOklch.h ?? 210) + hueShift) % 360) + 360) % 360
    dynamicHex = formatRgb({
      mode: 'oklch',
      l: Math.max(0.55, Math.min(0.8, baseOklch.l || 0.68)),
      c: Math.max(0.12, Math.min(0.22, baseOklch.c || 0.16)),
      h: hue,
    })
  }

  const parsedDynamic = parse(dynamicHex)!
  const readableText = wcagLuminance(parsedDynamic) > 0.35 ? '#09090b' : '#ffffff'

  if (theme === 'neon') {
    return {
      fill: blendColors('#09090b', dynamicHex, 0.44),
      stroke: dynamicHex,
      glow: withAlpha(dynamicHex, 0.9),
      activeText: '#ffffff',
    }
  }

  if (theme === 'glass') {
    return {
      fill: withAlpha(dynamicHex, 0.88),
      stroke: '#ffffff',
      glow: withAlpha(dynamicHex, 0.78),
      activeText: readableText,
    }
  }

  return {
    fill: dynamicHex,
    stroke: blendColors(dynamicHex, '#ffffff', 0.35),
    glow: withAlpha(dynamicHex, 0.78),
    activeText: readableText,
  }
}

export function buildKeycastCanvasPalette(theme: KeycastTheme, rawAccent: string): KeycastCanvasPalette {
  const accent = normalizeAccentColor(rawAccent)
  const parsedAccent = parse(accent) ?? parse(FALLBACK_ACCENT)!
  const activeText = wcagLuminance(parsedAccent) > 0.35 ? '#09090b' : '#ffffff'

  switch (theme) {
    case 'minimal':
      return {
        shellFill: 'rgba(15, 23, 42, 0.56)',
        shellStroke: 'rgba(255, 255, 255, 0.14)',
        shellStrokeWidth: 1,
        shellShadowColor: 'rgba(0, 0, 0, 0.35)',
        shellShadowBlur: 12,
        keyFill: 'rgba(30, 41, 59, 0.78)',
        keyStroke: 'rgba(255, 255, 255, 0.16)',
        keyBottomFill: 'rgba(15, 23, 42, 0.9)',
        keyText: 'rgba(248, 250, 252, 0.88)',
        keySubText: 'rgba(248, 250, 252, 0.52)',
        keyCornerRadius: 7,
        keyPressOffset: 1,
        accentFill: accent,
        accentGlow: withAlpha(accent, 0.55),
        accentStroke: accent,
        activeText,
        mouseBodyFill: 'rgba(15, 23, 42, 0.72)',
        mouseBodyStroke: 'rgba(255, 255, 255, 0.18)',
        mousePartFill: 'rgba(30, 41, 59, 0.82)',
        mousePartStroke: 'rgba(255, 255, 255, 0.18)',
        mouseSeamStroke: 'rgba(255, 255, 255, 0.14)',
        mouseText: 'rgba(248, 250, 252, 0.78)',
        hudFill: 'rgba(15, 23, 42, 0.72)',
        hudStroke: 'rgba(255, 255, 255, 0.14)',
        hudText: '#f8fafc',
      }
    case 'neon':
      return {
        shellFill: 'rgba(9, 9, 12, 0.86)',
        shellStroke: withAlpha(accent, 0.55),
        shellStrokeWidth: 1.5,
        shellShadowColor: withAlpha(accent, 0.32),
        shellShadowBlur: 18,
        keyFill: 'rgba(14, 14, 20, 0.92)',
        keyStroke: withAlpha(accent, 0.36),
        keyBottomFill: withAlpha(accent, 0.18),
        keyText: blendColors(accent, '#ffffff', 0.32),
        keySubText: withAlpha(accent, 0.65),
        keyCornerRadius: 6,
        keyPressOffset: 1.5,
        accentFill: blendColors('#09090b', accent, 0.42),
        accentGlow: withAlpha(accent, 0.9),
        accentStroke: accent,
        activeText: '#ffffff',
        mouseBodyFill: 'rgba(10, 10, 14, 0.92)',
        mouseBodyStroke: withAlpha(accent, 0.55),
        mousePartFill: 'rgba(18, 18, 24, 0.92)',
        mousePartStroke: withAlpha(accent, 0.38),
        mouseSeamStroke: withAlpha(accent, 0.3),
        mouseText: blendColors(accent, '#ffffff', 0.35),
        hudFill: 'rgba(9, 9, 12, 0.86)',
        hudStroke: withAlpha(accent, 0.5),
        hudText: '#ffffff',
      }
    case 'glass':
      return {
        shellFill: 'rgba(255, 255, 255, 0.12)',
        shellStroke: 'rgba(255, 255, 255, 0.3)',
        shellStrokeWidth: 1,
        shellShadowColor: 'rgba(0, 0, 0, 0.24)',
        shellShadowBlur: 16,
        keyFill: 'rgba(255, 255, 255, 0.16)',
        keyStroke: 'rgba(255, 255, 255, 0.28)',
        keyBottomFill: 'rgba(255, 255, 255, 0.08)',
        keyText: '#ffffff',
        keySubText: 'rgba(255, 255, 255, 0.65)',
        keyCornerRadius: 8,
        keyPressOffset: 1,
        accentFill: withAlpha(accent, 0.88),
        accentGlow: withAlpha(accent, 0.75),
        accentStroke: '#ffffff',
        activeText,
        mouseBodyFill: 'rgba(255, 255, 255, 0.12)',
        mouseBodyStroke: 'rgba(255, 255, 255, 0.3)',
        mousePartFill: 'rgba(255, 255, 255, 0.18)',
        mousePartStroke: 'rgba(255, 255, 255, 0.28)',
        mouseSeamStroke: 'rgba(255, 255, 255, 0.22)',
        mouseText: '#ffffff',
        hudFill: 'rgba(255, 255, 255, 0.15)',
        hudStroke: 'rgba(255, 255, 255, 0.28)',
        hudText: '#ffffff',
      }
    case 'immersive':
      return {
        shellFill: 'transparent',
        shellStroke: 'transparent',
        shellStrokeWidth: 0,
        shellShadowColor: 'transparent',
        shellShadowBlur: 0,
        keyFill: 'rgba(9, 9, 11, 0.28)',
        keyStroke: 'transparent',
        keyBottomFill: 'transparent',
        keyText: 'rgba(255, 255, 255, 0.92)',
        keySubText: 'rgba(255, 255, 255, 0.56)',
        keyCornerRadius: 7,
        keyPressOffset: 0,
        accentFill: accent,
        accentGlow: withAlpha(accent, 0.85),
        accentStroke: accent,
        activeText,
        mouseBodyFill: 'transparent',
        mouseBodyStroke: 'transparent',
        mousePartFill: 'rgba(9, 9, 11, 0.28)',
        mousePartStroke: 'transparent',
        mouseSeamStroke: 'transparent',
        mouseText: 'rgba(255, 255, 255, 0.86)',
        hudFill: 'transparent',
        hudStroke: 'transparent',
        hudText: '#ffffff',
        textShadowColor: 'rgba(0, 0, 0, 0.78)',
      }
    case 'mechanical':
    default:
      return {
        shellFill: 'rgba(18, 18, 22, 0.88)',
        shellStroke: 'rgba(255, 255, 255, 0.15)',
        shellStrokeWidth: 1,
        shellShadowColor: 'rgba(0, 0, 0, 0.45)',
        shellShadowBlur: 16,
        keyFill: '#27272e',
        keyStroke: 'rgba(255, 255, 255, 0.14)',
        keyBottomFill: '#111115',
        keyText: '#f4f4f5',
        keySubText: 'rgba(244, 244, 245, 0.55)',
        keyCornerRadius: 7,
        keyPressOffset: 2.5,
        accentFill: accent,
        accentGlow: withAlpha(accent, 0.75),
        accentStroke: blendColors(accent, '#ffffff', 0.35),
        activeText,
        mouseBodyFill: '#1b1b20',
        mouseBodyStroke: 'rgba(255, 255, 255, 0.18)',
        mousePartFill: '#27272e',
        mousePartStroke: 'rgba(255, 255, 255, 0.16)',
        mouseSeamStroke: 'rgba(255, 255, 255, 0.14)',
        mouseText: 'rgba(244, 244, 245, 0.78)',
        hudFill: 'rgba(18, 18, 22, 0.88)',
        hudStroke: 'rgba(255, 255, 255, 0.15)',
        hudText: '#f8fafc',
      }
  }
}
