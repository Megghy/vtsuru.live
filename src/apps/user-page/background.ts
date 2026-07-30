import type { GlobalThemeOverrides } from 'naive-ui'
import { formatRgb } from 'culori'
import type { PageBackgroundBlurMode, PageBackgroundImageFit, PageBackgroundScrimMode, PageBackgroundType } from './block/schema'
import { getGoogleFontFamilyCss } from './googleFonts'
import { resolveUserPageAppearance } from './themeConfig'
import { resolveUserPageControlOverlay, resolveUserPageReadableAccent, resolveUserPageTextPalette } from './theme'
import { getAdaptiveButtonColors } from '@/shared/config/theme/buttons'
import { parseRgb } from '@/shared/config/theme/contrast'
import { buildTokens } from '@/shared/config/theme/tokens'
import { hexToRgba } from '@/shared/utils'

export interface ResolvedPageBackground {
  type: PageBackgroundType
  coverSidebar: boolean
  blurMode: PageBackgroundBlurMode
  fit: PageBackgroundImageFit
  blurPx: number
  scrimMode: PageBackgroundScrimMode
  scrimStrength: number
  color: string
  imagePath: string
}

function asObject(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== 'object') return null
  if (Array.isArray(v)) return null
  return v as Record<string, unknown>
}

export function getUploadedFilePath(v: unknown): string {
  const obj = asObject(v)
  const path = obj?.path
  return typeof path === 'string' ? path : ''
}

export function resolvePageBackground(raw: unknown): ResolvedPageBackground | null {
  const obj = asObject(raw)
  if (!obj) return null

  const typeRaw = obj.pageBackgroundType
  const type: PageBackgroundType = (typeRaw === 'color' || typeRaw === 'image') ? typeRaw : 'none'
  if (type === 'none') return null

  const coverSidebar = obj.pageBackgroundCoverSidebar !== false
  const blurModeRaw = obj.pageBackgroundBlurMode
  const blurMode: PageBackgroundBlurMode = (blurModeRaw === 'background' || blurModeRaw === 'glass') ? blurModeRaw : 'none'
  const fitRaw = obj.pageBackgroundImageFit
  const fit: PageBackgroundImageFit = (fitRaw === 'contain' || fitRaw === 'fill' || fitRaw === 'none') ? fitRaw : 'cover'

  const scrimModeRaw = obj.pageBackgroundScrimMode
  const scrimMode: PageBackgroundScrimMode = (scrimModeRaw === 'black' || scrimModeRaw === 'white') ? scrimModeRaw : 'auto'

  const hasScrimStrength = Object.prototype.hasOwnProperty.call(obj, 'pageBackgroundScrimStrength')
  const scrimStrengthRaw = Number(obj.pageBackgroundScrimStrength)
  const scrimStrength = hasScrimStrength && Number.isFinite(scrimStrengthRaw)
    ? Math.min(100, Math.max(0, Math.round(scrimStrengthRaw)))
    : (blurMode === 'none' ? 0 : 100)

  const blur = Number(obj.pageBackgroundBlur)
  const blurPx = Number.isFinite(blur) ? Math.min(40, Math.max(0, Math.round(blur))) : 14
  const color = typeof obj.pageBackgroundColor === 'string' ? obj.pageBackgroundColor : 'transparent'
  const imagePath = getUploadedFilePath(obj.pageBackgroundImageFile)

  if (type === 'image' && !imagePath) return null

  return {
    type,
    coverSidebar,
    blurMode,
    fit,
    blurPx,
    scrimMode,
    scrimStrength,
    color,
    imagePath,
  }
}

export function getUserPageSurfaceCssVars(effectiveIsDark: boolean, theme?: unknown) {
  const appearance = resolveUserPageAppearance(theme)
  const surfaceAlpha = appearance.surfaceOpacity === undefined
    ? (effectiveIsDark ? 0.70 : 0.62)
    : appearance.surfaceOpacity / 100
  const borderAlpha = appearance.borderStrength === 'none'
    ? 0
    : appearance.borderStrength === 'subtle'
      ? (effectiveIsDark ? 0.10 : 0.14)
      : appearance.borderStrength === 'strong'
        ? (effectiveIsDark ? 0.32 : 0.42)
        : (effectiveIsDark ? 0.20 : 0.26)

  return {
    '--user-page-ui-surface-bg': effectiveIsDark
      ? `rgba(24, 24, 27, ${surfaceAlpha})`
      : `rgba(255, 255, 255, ${surfaceAlpha})`,
    '--user-page-ui-surface-bg-hover': effectiveIsDark
      ? `rgba(39, 39, 42, ${Math.min(1, surfaceAlpha + 0.16)})`
      : `rgba(244, 244, 245, ${Math.min(1, surfaceAlpha + 0.10)})`,
    '--user-page-ui-surface-bg-pressed': effectiveIsDark
      ? `rgba(39, 39, 42, ${Math.min(1, surfaceAlpha + 0.22)})`
      : `rgba(244, 244, 245, ${Math.min(1, surfaceAlpha + 0.18)})`,
    '--user-page-border-color': `rgba(148, 163, 184, ${borderAlpha})`,
    '--vtsuru-card-border-color': `rgba(148, 163, 184, ${borderAlpha})`,
  } as Record<string, string>
}

function readThemeString(theme: unknown, key: 'primaryColor' | 'backgroundColor' | 'fontFamily') {
  if (!theme || typeof theme !== 'object' || Array.isArray(theme)) return ''
  const value = (theme as Record<string, unknown>)[key]
  return typeof value === 'string' ? value.trim() : ''
}

function applyColorOpacity(value: string, opacity: number) {
  const color = parseRgb(value)
  return color ? formatRgb({ ...color, alpha: opacity / 100 }) : ''
}

export function getUserPageThemeCssVars(theme: unknown, effectiveIsDark: boolean) {
  const primaryColor = readThemeString(theme, 'primaryColor')
  const backgroundColor = readThemeString(theme, 'backgroundColor')
  const fontFamily = readThemeString(theme, 'fontFamily')
  const appearance = resolveUserPageAppearance(theme)
  const surfaceVars = getUserPageSurfaceCssVars(effectiveIsDark, theme)
  const pagePrimary = primaryColor || 'var(--n-primary-color)'
  const customSurface = backgroundColor && appearance.surfaceOpacity !== undefined
    ? applyColorOpacity(backgroundColor, appearance.surfaceOpacity)
    : ''
  const contrastSurface = customSurface || (appearance.surfaceOpacity !== undefined
    ? surfaceVars['--user-page-ui-surface-bg']
    : undefined)
  const textPalette = resolveUserPageTextPalette(
    asObject(theme) ?? undefined,
    effectiveIsDark,
    contrastSurface,
  )
  const pageText = textPalette.color
  const siteTokens = buildTokens(effectiveIsDark)
  const readablePrimary = resolveUserPageReadableAccent(primaryColor, backgroundColor, effectiveIsDark, contrastSurface) || pageText

  const contentColor = customSurface || backgroundColor || surfaceVars['--user-page-ui-surface-bg']
  const surfaceColor = customSurface || (backgroundColor
    ? `color-mix(in srgb, ${backgroundColor} 32%, transparent)`
    : surfaceVars['--user-page-ui-surface-bg'])
  const surfaceHover = backgroundColor
    ? applyColorOpacity(backgroundColor, Math.min(100, (appearance.surfaceOpacity ?? 32) + 10))
    : surfaceVars['--user-page-ui-surface-bg-hover']
  const borderColor = surfaceVars['--vtsuru-card-border-color']

  return {
    ...surfaceVars,
    '--vtsuru-page-primary': pagePrimary,
    '--vtsuru-page-primary-soft': `color-mix(in srgb, ${pagePrimary} 18%, transparent)`,
    '--vtsuru-page-primary-active': `color-mix(in srgb, ${pagePrimary} 26%, transparent)`,
    '--vtsuru-page-primary-border': `color-mix(in srgb, ${pagePrimary} 28%, transparent)`,
    '--vtsuru-page-primary-focus': `color-mix(in srgb, ${pagePrimary} 42%, transparent)`,
    '--vtsuru-page-primary-readable': readablePrimary,
    '--vtsuru-page-font-family': getGoogleFontFamilyCss(fontFamily),
    '--vtsuru-page-content-color': contentColor,
    '--vtsuru-page-card-bg': surfaceColor,
    '--vtsuru-page-card-bg-embedded': surfaceHover,
    '--vtsuru-page-text': pageText,
    '--vtsuru-surface-fg': pageText,
    '--vtsuru-surface-fg-muted': textPalette.muted,
    '--vtsuru-surface-fg-subtle': textPalette.subtle,
    '--vtsuru-page-fg-disabled': siteTokens.disabledForeground,
    '--vtsuru-page-placeholder-disabled': siteTokens.placeholderDisabled,
    '--vtsuru-page-bg': backgroundColor ? `color-mix(in srgb, ${backgroundColor} 32%, transparent)` : 'transparent',
    '--user-page-theme-content-bg': 'transparent',
    '--text-color-base': pageText,
    '--text-color-1': pageText,
    '--text-color-2': textPalette.muted,
    '--text-color-3': textPalette.subtle,
    '--primary-color': pagePrimary,
    '--user-page-theme-surface-bg': surfaceColor,
    '--user-page-theme-surface-bg-hover': surfaceHover,
    '--vtsuru-page-radius': `${appearance.radius}px`,
    '--vtsuru-page-spacing': `${appearance.spacing}px`,
    '--vtsuru-page-max-width': appearance.pageMaxWidth,
    '--vtsuru-page-border-width': appearance.borderWidth,
    '--vtsuru-page-border-style': appearance.borderStyle,
    '--vtsuru-page-border': `${appearance.borderWidth} ${appearance.borderStyle} ${borderColor}`,
    '--vtsuru-page-shadow': appearance.shadow,
    '--vtsuru-page-control-height-small': appearance.controlHeights.small,
    '--vtsuru-page-control-height-medium': appearance.controlHeights.medium,
    '--vtsuru-page-control-height-large': appearance.controlHeights.large,
  } as Record<string, string>
}

export function getUserPageNaiveThemeOverrides(
  theme: unknown,
  vars: Record<string, string>,
  effectiveIsDark: boolean,
): GlobalThemeOverrides {
  const primaryColor = readThemeString(theme, 'primaryColor')
  const appearance = resolveUserPageAppearance(theme)
  const contentColor = vars['--vtsuru-page-content-color'] || vars['--user-page-ui-surface-bg']
  const cardColor = vars['--vtsuru-page-card-bg']
  const cardEmbeddedColor = vars['--vtsuru-page-card-bg-embedded']
  const borderColor = vars['--vtsuru-card-border-color'] || vars['--user-page-border-color']
  const textColor = vars['--vtsuru-page-text']
  const mutedTextColor = vars['--vtsuru-surface-fg-muted']
  const subtleTextColor = vars['--vtsuru-surface-fg-subtle']
  const disabledTextColor = vars['--vtsuru-page-fg-disabled']
  const disabledPlaceholderColor = vars['--vtsuru-page-placeholder-disabled']
  const controlOverlay = resolveUserPageControlOverlay(contentColor)

  return {
    common: {
      fontFamily: vars['--vtsuru-page-font-family'],
      borderColor,
      dividerColor: borderColor,
      textColorBase: textColor,
      textColor1: textColor,
      textColor2: mutedTextColor,
      textColor3: subtleTextColor,
      textColorDisabled: disabledTextColor,
      cardColor,
      modalColor: contentColor,
      popoverColor: contentColor,
      borderRadius: `${appearance.radius}px`,
      borderRadiusSmall: `${appearance.radius}px`,
      heightSmall: appearance.controlHeights.small,
      heightMedium: appearance.controlHeights.medium,
      heightLarge: appearance.controlHeights.large,
      boxShadow1: appearance.shadow,
      boxShadow2: appearance.shadow,
      boxShadow3: appearance.shadow,
      ...(primaryColor ? { primaryColor, primaryColorHover: primaryColor, primaryColorPressed: primaryColor } : {}),
    },
    Card: {
      color: cardColor,
      colorEmbedded: cardEmbeddedColor,
      borderColor,
      borderRadius: `${appearance.radius}px`,
    },
    Input: {
      heightSmall: appearance.controlHeights.small,
      heightMedium: appearance.controlHeights.medium,
      heightLarge: appearance.controlHeights.large,
      borderRadius: `${appearance.radius}px`,
      color: controlOverlay.color,
      colorFocus: controlOverlay.focus,
      colorDisabled: controlOverlay.disabled,
      textColor,
      textColorDisabled: disabledTextColor,
      placeholderColor: subtleTextColor,
      placeholderColorDisabled: disabledPlaceholderColor,
      border: `${appearance.borderWidth} ${appearance.borderStyle} ${borderColor}`,
      borderHover: `${appearance.borderWidth} ${appearance.borderStyle} ${primaryColor || borderColor}`,
      borderFocus: `${appearance.borderWidth} ${appearance.borderStyle} ${primaryColor || borderColor}`,
    },
    Select: {
      peers: {
        InternalSelection: {
          colorDisabled: controlOverlay.disabled,
          textColorDisabled: disabledTextColor,
          placeholderColorDisabled: disabledPlaceholderColor,
          arrowColorDisabled: disabledPlaceholderColor,
        },
      },
    },
    Button: {
      ...getAdaptiveButtonColors({
        isDark: effectiveIsDark,
        surface: contentColor,
        color: controlOverlay.color,
        colorHover: controlOverlay.focus,
        colorPressed: controlOverlay.disabled,
        textColor,
        borderColor,
        borderWidth: appearance.borderWidth,
        borderStyle: appearance.borderStyle,
        ...(primaryColor
          ? { primary: { color: primaryColor } }
          : {}),
      }),
      heightSmall: appearance.controlHeights.small,
      heightMedium: appearance.controlHeights.medium,
      heightLarge: appearance.controlHeights.large,
      borderRadiusTiny: `${appearance.radius}px`,
      borderRadiusSmall: `${appearance.radius}px`,
      borderRadiusMedium: `${appearance.radius}px`,
      borderRadiusLarge: `${appearance.radius}px`,
    },
    Popover: {
      borderRadius: `${appearance.radius}px`,
      boxShadow: appearance.shadow,
    },
    Dialog: {
      borderRadius: `${appearance.radius}px`,
    },
  }
}

export function getPageBackgroundCssVars(bg: ResolvedPageBackground, effectiveIsDark: boolean) {
  const img = bg.type === 'image' ? bg.imagePath.trim() : ''
  const safeUrl = img ? img.replaceAll('"', "\\\"") : ''

  const blurPx = bg.blurMode === 'none' ? 0 : bg.blurPx

  const scrimBaseAlpha = bg.blurMode === 'glass'
    ? (effectiveIsDark ? 0.24 : 0.14)
    : (bg.blurMode === 'background'
        ? (effectiveIsDark ? 0.42 : 0.20)
        : (effectiveIsDark ? 0.32 : 0.12))
  const scrimRgb = bg.scrimMode === 'white' || (bg.scrimMode === 'auto' && !effectiveIsDark)
    ? '255, 255, 255'
    : '0, 0, 0'
  const darkImageScrimFloor = effectiveIsDark && bg.type === 'image' && scrimRgb === '0, 0, 0' ? 0.12 : 0
  const scrimAlpha = Math.min(0.9, Math.max(darkImageScrimFloor, scrimBaseAlpha * (bg.scrimStrength / 100)))
  const scrim = scrimAlpha > 0 ? `rgba(${scrimRgb}, ${scrimAlpha})` : 'transparent'

  const glassColor = bg.type === 'color' && bg.color
    ? hexToRgba(bg.color, 0.55)
    : (bg.type === 'image' ? 'transparent' : null)

  // 玻璃底色默认值：降低不透明度，避免浅色模式下出现大块白色遮罩
  const defaultGlassSurfaceBg = effectiveIsDark ? 'rgba(0, 0, 0, 0.22)' : 'rgba(255, 255, 255, 0.18)'

  return {
    '--user-page-bg-color': bg.type === 'color' ? bg.color : 'transparent',
    '--user-page-bg-image': safeUrl ? `url("${safeUrl}")` : 'none',
    '--user-page-bg-size': bg.fit === 'fill' ? '100% 100%' : (bg.fit === 'none' ? 'auto' : bg.fit),
    '--user-page-bg-blur': `${blurPx}px`,
    '--user-page-bg-scrim': scrim,
    '--glass-surface-bg': glassColor || defaultGlassSurfaceBg,
  } as Record<string, string>
}
