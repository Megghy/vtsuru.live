/**
 * 主题入口：聚合 colors / tokens / overrides，并产出可在 .vue / .ts 中直接引用的 CSS 变量。
 */
import type { ThemeTokens } from './tokens'
import { brand, error, hexToRgb, info, neutral, pickByMode, success, warning } from './colors'

export { brand, error, hexToRgb, info, neutral, pickByMode, rgba, success, warning } from './colors'
export { getThemeOverrides } from './overrides'
export type { ThemeTokens } from './tokens'
export { buildTokens } from './tokens'

const NAIVE_BEZIER = 'cubic-bezier(.4, 0, .2, 1)'

function rgbTriplet(hex: string) {
  const { r, g, b } = hexToRgb(hex)
  return `${r}, ${g}, ${b}`
}

/**
 * 把 token 注入根节点的 CSS 变量（供原生 CSS / 组件内 :style 等消费）。
 *
 * 不在 :root 上做硬编码，是为了让暗色模式切换时同步刷新。
 * 在 App.vue 的 watchEffect 里调用即可。
 */
export function applyThemeCssVars(tokens: ThemeTokens, target: HTMLElement = document.documentElement) {
  const vars: Record<string, string> = {
    '--vtsuru-brand': tokens.brand,
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
    '--vtsuru-fg-muted': tokens.mutedForeground,
    '--vtsuru-bg': tokens.background,
    '--vtsuru-bg-muted': tokens.muted,
    '--vtsuru-bg-elevated': tokens.embeddedColor,
    '--vtsuru-border': tokens.borderColor,
    '--vtsuru-border-hover': tokens.inputBorderHover,
    '--vtsuru-radius': tokens.radiusSurface,
    '--vtsuru-radius-control': tokens.radiusControl,
    '--vtsuru-shadow-1': tokens.shadow1,
    '--vtsuru-shadow-2': tokens.shadow2,
    '--vtsuru-shadow-popover': tokens.shadowPopover,
  }

  // 同时把 naive-ui 的通用 CSS 变量注入根节点。
  // naive 组件会在自身元素上内联同名变量并覆盖这里的值，因此根注入只作为
  // “裸元素 / scoped CSS”引用 var(--n-*) 时的兜底，避免变量为空导致颜色塌缩。
  const isDark = tokens.isDark
  const infoColor = pickByMode(isDark, info.light, info.dark)
  const successColor = pickByMode(isDark, success.light, success.dark)
  const warningColor = pickByMode(isDark, warning.light, warning.dark)
  const errorColor = pickByMode(isDark, error.light, error.dark)
  Object.assign(vars, {
    '--n-bezier': NAIVE_BEZIER,
    '--n-border-radius': tokens.radiusSurface,
    '--n-border-color': tokens.borderColor,
    '--n-divider-color': tokens.borderColor,
    '--n-text-color': tokens.foreground,
    '--n-text-color-1': tokens.foreground,
    '--n-text-color-2': tokens.mutedForeground,
    '--n-text-color-3': isDark ? neutral[500] : neutral[400],
    '--n-text-color-disabled': tokens.placeholderDisabled,
    '--n-body-color': tokens.background,
    '--n-color': tokens.background,
    '--n-card-color': tokens.background,
    '--n-color-modal': tokens.background,
    '--n-color-embedded': tokens.embeddedColor,
    '--n-color-segment': tokens.embeddedColor,
    '--n-table-color-striped': tokens.embeddedColor,
    '--n-primary-color': tokens.brand,
    '--n-primary-color-rgb': rgbTriplet(tokens.brand),
    '--n-info-color': infoColor,
    '--n-info-color-rgb': rgbTriplet(infoColor),
    '--n-success-color': successColor,
    '--n-success-color-rgb': rgbTriplet(successColor),
    '--n-warning-color': warningColor,
    '--n-warning-color-rgb': rgbTriplet(warningColor),
    '--n-error-color': errorColor,
    '--n-error-color-rgb': rgbTriplet(errorColor),
  })

  for (const [k, v] of Object.entries(vars)) target.style.setProperty(k, v)
}
