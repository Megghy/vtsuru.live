import { formatRgb } from 'culori'
import type { GlobalThemeOverrides } from 'naive-ui'

import { getAdaptiveButtonColors } from '@/shared/config/theme/buttons'
import { resolveReadableForeground } from '@/shared/config/theme/contrast'
import { getThemeOverrides } from '@/shared/config/theme/overrides'
import { buildSiteTokens } from '@/shared/config/theme/tokens'
import { hexToRgba } from '@/shared/utils'

import type {
  PageBackgroundBlurMode,
  PageBackgroundImageFit,
  PageBackgroundScrimMode,
  PageBackgroundType,
} from './block/schema'
import { getGoogleFontFamilyCss } from './googleFonts'
import { resolveUserPageControlOverlay, resolveUserPageReadableAccent, resolveUserPageTextPalette } from './theme'
import { normalizeUserPageColor, parseUserPageColor } from './themeColor'
import { resolveUserPageAppearance } from './themeConfig'

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
  const type: PageBackgroundType = typeRaw === 'color' || typeRaw === 'image' ? typeRaw : 'none'
  if (type === 'none') return null

  const coverSidebar = obj.pageBackgroundCoverSidebar !== false
  const blurModeRaw = obj.pageBackgroundBlurMode
  const blurMode: PageBackgroundBlurMode =
    blurModeRaw === 'background' || blurModeRaw === 'glass' ? blurModeRaw : 'none'
  const fitRaw = obj.pageBackgroundImageFit
  const fit: PageBackgroundImageFit = fitRaw === 'contain' || fitRaw === 'fill' || fitRaw === 'none' ? fitRaw : 'cover'

  const scrimModeRaw = obj.pageBackgroundScrimMode
  const scrimMode: PageBackgroundScrimMode =
    scrimModeRaw === 'black' || scrimModeRaw === 'white' ? scrimModeRaw : 'auto'

  const hasScrimStrength = Object.prototype.hasOwnProperty.call(obj, 'pageBackgroundScrimStrength')
  const scrimStrengthRaw = Number(obj.pageBackgroundScrimStrength)
  const scrimStrength =
    hasScrimStrength && Number.isFinite(scrimStrengthRaw)
      ? Math.min(100, Math.max(0, Math.round(scrimStrengthRaw)))
      : blurMode === 'none'
        ? 0
        : 100

  const blur = Number(obj.pageBackgroundBlur)
  const blurPx = Number.isFinite(blur) ? Math.min(40, Math.max(0, Math.round(blur))) : 14
  const color =
    obj.pageBackgroundColor === undefined
      ? 'transparent'
      : normalizeUserPageColor(obj.pageBackgroundColor, 'pageBackgroundColor')
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
  const surfaceAlpha =
    appearance.surfaceOpacity === undefined ? (effectiveIsDark ? 0.7 : 0.62) : appearance.surfaceOpacity / 100
  const borderAlpha =
    appearance.borderStrength === 'none'
      ? 0
      : appearance.borderStrength === 'subtle'
        ? effectiveIsDark
          ? 0.1
          : 0.14
        : appearance.borderStrength === 'strong'
          ? effectiveIsDark
            ? 0.32
            : 0.42
          : effectiveIsDark
            ? 0.2
            : 0.26

  return {
    '--user-page-ui-surface-bg': effectiveIsDark
      ? `rgba(24, 24, 27, ${surfaceAlpha})`
      : `rgba(255, 255, 255, ${surfaceAlpha})`,
    '--user-page-ui-surface-bg-hover': effectiveIsDark
      ? `rgba(39, 39, 42, ${Math.min(1, surfaceAlpha + 0.16)})`
      : `rgba(244, 244, 245, ${Math.min(1, surfaceAlpha + 0.1)})`,
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

function readThemeColor(theme: unknown, key: 'primaryColor' | 'backgroundColor') {
  const value = readThemeString(theme, key)
  return value ? normalizeUserPageColor(value, key) : ''
}

function applyColorOpacity(value: string, opacity: number) {
  return formatRgb({ ...parseUserPageColor(value), alpha: opacity / 100 })
}

function mixWithTransparent(value: string, amount: number) {
  const color = parseUserPageColor(value)
  return formatRgb({ ...color, alpha: (color.alpha ?? 1) * amount })
}

export function getUserPageThemeCssVars(theme: unknown, effectiveIsDark: boolean) {
  const primaryColor = readThemeColor(theme, 'primaryColor')
  const backgroundColor = readThemeColor(theme, 'backgroundColor')
  const fontFamily = readThemeString(theme, 'fontFamily')
  const appearance = resolveUserPageAppearance(theme)
  const surfaceVars = getUserPageSurfaceCssVars(effectiveIsDark, theme)
  const siteTokens = buildSiteTokens(effectiveIsDark)
  const pagePrimary = primaryColor || siteTokens.primary
  const customSurface =
    backgroundColor && appearance.surfaceOpacity !== undefined
      ? applyColorOpacity(backgroundColor, appearance.surfaceOpacity)
      : ''
  const contrastSurface =
    customSurface || (appearance.surfaceOpacity !== undefined ? surfaceVars['--user-page-ui-surface-bg'] : undefined)
  const textPalette = resolveUserPageTextPalette(asObject(theme) ?? undefined, effectiveIsDark, contrastSurface)
  const pageText = textPalette.color
  const readablePrimary = resolveUserPageReadableAccent(pagePrimary, backgroundColor, effectiveIsDark, contrastSurface)

  const contentColor = customSurface || backgroundColor || surfaceVars['--user-page-ui-surface-bg']
  const defaultCardSurface = applyColorOpacity(
    siteTokens.surfaceHover,
    appearance.surfaceOpacity ?? (effectiveIsDark ? 70 : 62),
  )
  const surfaceColor =
    customSurface || (backgroundColor ? mixWithTransparent(backgroundColor, 0.32) : defaultCardSurface)
  const surfaceHover = backgroundColor
    ? applyColorOpacity(backgroundColor, Math.min(100, (appearance.surfaceOpacity ?? 32) + 10))
    : surfaceVars['--user-page-ui-surface-bg-hover']
  const borderColor = surfaceVars['--vtsuru-card-border-color']
  const radius = `${appearance.radius}px`

  return {
    ...surfaceVars,
    '--vtsuru-primary': pagePrimary,
    '--vtsuru-primary-hover': pagePrimary,
    '--vtsuru-primary-pressed': pagePrimary,
    '--vtsuru-primary-fg': readablePrimary,
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
    '--vtsuru-fg': pageText,
    '--vtsuru-surface-fg': pageText,
    '--vtsuru-fg-muted': textPalette.muted,
    '--vtsuru-surface-fg-muted': textPalette.muted,
    '--vtsuru-surface-fg-subtle': textPalette.subtle,
    '--vtsuru-fg-disabled': siteTokens.disabledForeground,
    '--vtsuru-page-fg-disabled': siteTokens.disabledForeground,
    '--vtsuru-page-placeholder-disabled': siteTokens.placeholderDisabled,
    '--vtsuru-bg': contentColor,
    '--vtsuru-bg-surface': surfaceColor,
    '--vtsuru-bg-muted': surfaceHover,
    '--vtsuru-bg-inset': surfaceHover,
    '--vtsuru-bg-elevated': surfaceColor,
    '--vtsuru-border': borderColor,
    '--vtsuru-page-bg': backgroundColor ? `color-mix(in srgb, ${backgroundColor} 32%, transparent)` : 'transparent',
    '--user-page-theme-content-bg': 'transparent',
    '--text-color-base': pageText,
    '--text-color-1': pageText,
    '--text-color-2': textPalette.muted,
    '--text-color-3': textPalette.subtle,
    '--primary-color': pagePrimary,
    '--user-page-theme-surface-bg': surfaceColor,
    '--user-page-theme-surface-bg-hover': surfaceHover,
    '--vtsuru-page-radius': radius,
    '--vtsuru-radius': radius,
    '--vtsuru-radius-control': radius,
    '--vtsuru-radius-small': radius,
    '--vtsuru-page-spacing': `${appearance.spacing}px`,
    '--vtsuru-page-max-width': appearance.pageMaxWidth,
    '--vtsuru-page-border-width': appearance.borderWidth,
    '--vtsuru-page-border-style': appearance.borderStyle,
    '--vtsuru-page-border': `${appearance.borderWidth} ${appearance.borderStyle} ${borderColor}`,
    '--vtsuru-page-shadow': appearance.shadow,
    '--vtsuru-border-width': appearance.borderWidth,
    '--vtsuru-border-style': appearance.borderStyle,
    '--vtsuru-shadow': appearance.shadow,
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
  const base = getThemeOverrides(buildSiteTokens(effectiveIsDark))
  const primaryColor = readThemeColor(theme, 'primaryColor')
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
  const pagePrimary = vars['--vtsuru-page-primary']
  const pagePrimaryFocus = vars['--vtsuru-page-primary-focus']
  const pagePrimaryForeground = resolveReadableForeground(pagePrimary, contentColor, effectiveIsDark)
  const controlOverlay = resolveUserPageControlOverlay(contentColor)
  const radius = `${appearance.radius}px`
  const border = `${appearance.borderWidth} ${appearance.borderStyle} ${borderColor}`
  const primaryBorder = `${appearance.borderWidth} ${appearance.borderStyle} ${primaryColor || borderColor}`

  return {
    ...base,
    common: {
      ...base.common,
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
      borderRadius: radius,
      borderRadiusSmall: radius,
      heightSmall: appearance.controlHeights.small,
      heightMedium: appearance.controlHeights.medium,
      heightLarge: appearance.controlHeights.large,
      boxShadow1: appearance.shadow,
      boxShadow2: appearance.shadow,
      boxShadow3: appearance.shadow,
      ...(primaryColor ? { primaryColor, primaryColorHover: primaryColor, primaryColorPressed: primaryColor } : {}),
    },
    Card: {
      ...base.Card,
      color: cardColor,
      colorEmbedded: cardEmbeddedColor,
      borderColor,
      borderRadius: radius,
      boxShadow: appearance.shadow,
    },
    Input: {
      ...base.Input,
      heightSmall: appearance.controlHeights.small,
      heightMedium: appearance.controlHeights.medium,
      heightLarge: appearance.controlHeights.large,
      borderRadius: radius,
      color: controlOverlay.color,
      colorFocus: controlOverlay.focus,
      colorDisabled: controlOverlay.disabled,
      textColor,
      textColorDisabled: disabledTextColor,
      placeholderColor: subtleTextColor,
      placeholderColorDisabled: disabledPlaceholderColor,
      border,
      borderHover: primaryBorder,
      borderFocus: primaryBorder,
    },
    Select: {
      ...base.Select,
      peers: {
        ...base.Select?.peers,
        InternalSelection: {
          ...base.Select?.peers?.InternalSelection,
          heightSmall: appearance.controlHeights.small,
          heightMedium: appearance.controlHeights.medium,
          heightLarge: appearance.controlHeights.large,
          borderRadius: radius,
          border,
          borderHover: primaryBorder,
          borderFocus: primaryBorder,
          colorDisabled: controlOverlay.disabled,
          textColorDisabled: disabledTextColor,
          placeholderColorDisabled: disabledPlaceholderColor,
          arrowColorDisabled: disabledPlaceholderColor,
        },
        InternalSelectMenu: {
          ...base.Select?.peers?.InternalSelectMenu,
          borderRadius: radius,
        },
      },
    },
    Button: {
      ...base.Button,
      ...getAdaptiveButtonColors({
        isDark: effectiveIsDark,
        surface: contentColor,
        color: controlOverlay.color,
        colorHover: controlOverlay.focus,
        colorPressed: controlOverlay.disabled,
        secondary: {
          color: controlOverlay.focus,
          hover: controlOverlay.disabled,
          pressed: controlOverlay.disabled,
        },
        textColor,
        borderColor,
        borderWidth: appearance.borderWidth,
        borderStyle: appearance.borderStyle,
        ...(primaryColor ? { primary: { color: primaryColor } } : {}),
      }),
      heightSmall: appearance.controlHeights.small,
      heightMedium: appearance.controlHeights.medium,
      heightLarge: appearance.controlHeights.large,
      borderRadiusTiny: radius,
      borderRadiusSmall: radius,
      borderRadiusMedium: radius,
      borderRadiusLarge: radius,
    },
    Popover: {
      ...base.Popover,
      borderRadius: radius,
      boxShadow: appearance.shadow,
    },
    Dialog: {
      ...base.Dialog,
      borderRadius: radius,
    },
    Checkbox: {
      ...base.Checkbox,
      borderRadius: radius,
      border,
      borderChecked: primaryBorder,
    },
    Radio: {
      ...base.Radio,
      buttonBorderColor: borderColor,
      buttonBorderColorActive: pagePrimary,
      buttonBorderColorHover: pagePrimary,
      buttonBoxShadowFocus: `inset 0 0 0 1px ${pagePrimary}, 0 0 0 2px ${pagePrimaryFocus}`,
      buttonBoxShadowHover: `inset 0 0 0 1px ${pagePrimary}`,
      buttonColor: controlOverlay.color,
      buttonColorActive: pagePrimary,
      buttonTextColor: textColor,
      buttonTextColorActive: pagePrimaryForeground,
      buttonTextColorHover: pagePrimary,
      buttonBorderRadius: radius,
      dotColorActive: pagePrimary,
    },
    Empty: {
      ...base.Empty,
      textColor: mutedTextColor,
      iconColor: pagePrimary,
      extraTextColor: mutedTextColor,
    },
    Tooltip: { ...base.Tooltip, borderRadius: radius, boxShadow: appearance.shadow },
    Menu: { ...base.Menu, borderRadius: radius },
    Dropdown: { ...base.Dropdown, borderRadius: radius },
    Message: { ...base.Message, borderRadius: radius, border, boxShadow: appearance.shadow },
    Notification: { ...base.Notification, borderRadius: radius, boxShadow: appearance.shadow },
    Tag: { ...base.Tag, borderRadius: radius },
    Alert: { ...base.Alert, borderRadius: radius },
    List: { ...base.List, borderRadius: radius },
    Pagination: {
      ...base.Pagination,
      itemBorderRadius: radius,
    },
  }
}

export function getPageBackgroundCssVars(bg: ResolvedPageBackground, effectiveIsDark: boolean) {
  const img = bg.type === 'image' ? bg.imagePath.trim() : ''
  const safeUrl = img ? img.replaceAll('"', '\\"') : ''

  const blurPx = bg.blurMode === 'none' ? 0 : bg.blurPx

  const scrimBaseAlpha =
    bg.blurMode === 'glass'
      ? effectiveIsDark
        ? 0.24
        : 0.14
      : bg.blurMode === 'background'
        ? effectiveIsDark
          ? 0.42
          : 0.2
        : effectiveIsDark
          ? 0.32
          : 0.12
  const scrimRgb =
    bg.scrimMode === 'white' || (bg.scrimMode === 'auto' && !effectiveIsDark) ? '255, 255, 255' : '0, 0, 0'
  const darkImageScrimFloor = effectiveIsDark && bg.type === 'image' && scrimRgb === '0, 0, 0' ? 0.12 : 0
  const scrimAlpha = Math.min(0.9, Math.max(darkImageScrimFloor, scrimBaseAlpha * (bg.scrimStrength / 100)))
  const scrim = scrimAlpha > 0 ? `rgba(${scrimRgb}, ${scrimAlpha})` : 'transparent'

  const glassColor =
    bg.type === 'color' && bg.color ? hexToRgba(bg.color, 0.55) : bg.type === 'image' ? 'transparent' : null

  // 玻璃底色默认值：降低不透明度，避免浅色模式下出现大块白色遮罩
  const defaultGlassSurfaceBg = effectiveIsDark ? 'rgba(0, 0, 0, 0.22)' : 'rgba(255, 255, 255, 0.18)'

  return {
    '--user-page-bg-color': bg.type === 'color' ? bg.color : 'transparent',
    '--user-page-bg-image': safeUrl ? `url("${safeUrl}")` : 'none',
    '--user-page-bg-size': bg.fit === 'fill' ? '100% 100%' : bg.fit === 'none' ? 'auto' : bg.fit,
    '--user-page-bg-blur': `${blurPx}px`,
    '--user-page-bg-scrim': scrim,
    '--glass-surface-bg': glassColor || defaultGlassSurfaceBg,
  } as Record<string, string>
}
