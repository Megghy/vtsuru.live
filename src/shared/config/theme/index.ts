import { brand, error, hexToRgb, info, pickByMode, rgba, success, warning } from './colors'
/**
 * 主题入口：聚合 colors / tokens，并产出可在 .vue / .ts 中直接引用的 CSS 变量。
 */
import type { ThemeTokens } from './tokens'

export { brand, error, hexToRgb, info, neutral, pickByMode, rgba, success, warning } from './colors'
export type { ThemeTokens } from './tokens'
export { buildManageTokens, buildSiteTokens } from './tokens'

function rgbTriplet(color: string) {
  const { r, g, b } = hexToRgb(color)
  return `${r}, ${g}, ${b}`
}

/**
 * 把 token 注入根节点的 CSS 变量（供原生 CSS / 组件内 :style 等消费）。
 *
 * 不在 :root 上做硬编码，是为了让暗色模式切换时同步刷新。
 * 在 App.vue 的 watchEffect 里调用即可。
 */
export function getThemeCssVars(tokens: ThemeTokens): Record<string, string> {
  const infoColor = pickByMode(tokens.isDark, info.light, info.dark)
  const successColor = pickByMode(tokens.isDark, success.light, success.dark)
  const warningColor = pickByMode(tokens.isDark, warning.light, warning.dark)
  const errorColor = pickByMode(tokens.isDark, error.light, error.dark)
  const vars: Record<string, string> = {
    '--vtsuru-bezier': 'cubic-bezier(.4, 0, .2, 1)',
    '--vtsuru-primary': tokens.primary,
    '--vtsuru-primary-hover': tokens.primaryHover,
    '--vtsuru-primary-pressed': tokens.primaryPressed,
    '--vtsuru-primary-fg': tokens.primaryForeground,
    '--vtsuru-primary-rgb': rgbTriplet(tokens.primary),
    '--vtsuru-brand': tokens.brand,
    '--vtsuru-brand-fg': brand[900],
    '--vtsuru-brand-hover': tokens.brandHover,
    '--vtsuru-brand-pressed': tokens.brandPressed,
    '--vtsuru-brand-soft': tokens.brandSoft,
    '--vtsuru-brand-tint': tokens.brandTint,
    '--vtsuru-brand-rail': tokens.brandRail,
    '--vtsuru-brand-50': brand[50],
    '--vtsuru-brand-100': brand[100],
    '--vtsuru-brand-400': brand[400],
    '--vtsuru-brand-500': brand[500],
    '--vtsuru-fg': tokens.foreground,
    '--vtsuru-fg-toned': tokens.tonedForeground,
    '--vtsuru-fg-highlighted': tokens.highlightedForeground,
    '--vtsuru-fg-inverted': tokens.invertedForeground,
    '--vtsuru-fg-muted': tokens.mutedForeground,
    '--vtsuru-fg-disabled': tokens.disabledForeground,
    '--vtsuru-bg': tokens.canvas,
    '--vtsuru-bg-surface': tokens.surface,
    '--vtsuru-bg-muted': tokens.surfaceHover,
    '--vtsuru-bg-inset': tokens.inset,
    '--vtsuru-bg-elevated': tokens.elevated,
    '--vtsuru-bg-accented': tokens.controlPressed,
    '--vtsuru-bg-inverted': tokens.primary,
    '--vtsuru-border': tokens.borderColor,
    '--vtsuru-border-muted': tokens.mutedBorderColor,
    '--vtsuru-border-accented': tokens.accentedBorderColor,
    '--vtsuru-border-inverted': tokens.invertedBorderColor,
    '--vtsuru-border-hover': tokens.inputBorderHover,
    '--vtsuru-radius': tokens.radiusSurface,
    '--vtsuru-radius-control': tokens.radiusControl,
    '--vtsuru-shadow-1': tokens.shadow1,
    '--vtsuru-shadow-2': tokens.shadow2,
    '--vtsuru-shadow-popover': tokens.shadowPopover,
    '--vtsuru-info': infoColor,
    '--vtsuru-info-hover': pickByMode(tokens.isDark, info.lightHover, info.darkHover),
    '--vtsuru-info-pressed': pickByMode(tokens.isDark, info.lightPressed, info.darkPressed),
    '--vtsuru-info-rgb': rgbTriplet(infoColor),
    '--vtsuru-info-soft': rgba(infoColor, 0.12),
    '--vtsuru-success': successColor,
    '--vtsuru-success-hover': pickByMode(tokens.isDark, success.lightHover, success.darkHover),
    '--vtsuru-success-pressed': pickByMode(tokens.isDark, success.lightPressed, success.darkPressed),
    '--vtsuru-success-rgb': rgbTriplet(successColor),
    '--vtsuru-success-soft': rgba(successColor, 0.12),
    '--vtsuru-warning': warningColor,
    '--vtsuru-warning-hover': pickByMode(tokens.isDark, warning.lightHover, warning.darkHover),
    '--vtsuru-warning-pressed': pickByMode(tokens.isDark, warning.lightPressed, warning.darkPressed),
    '--vtsuru-warning-rgb': rgbTriplet(warningColor),
    '--vtsuru-warning-soft': rgba(warningColor, 0.12),
    '--vtsuru-error': errorColor,
    '--vtsuru-error-hover': pickByMode(tokens.isDark, error.lightHover, error.darkHover),
    '--vtsuru-error-rgb': rgbTriplet(errorColor),
    '--vtsuru-error-soft': rgba(errorColor, 0.12),
    '--vtsuru-error-pressed': pickByMode(tokens.isDark, error.lightPressed, error.darkPressed),
  }

  return vars
}

export function applyThemeCssVars(tokens: ThemeTokens, target: HTMLElement = document.documentElement) {
  for (const [key, value] of Object.entries(getThemeCssVars(tokens))) target.style.setProperty(key, value)
}
