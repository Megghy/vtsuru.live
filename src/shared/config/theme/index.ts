/**
 * 主题入口：聚合 colors / tokens / overrides，并产出可在 .vue / .ts 中直接引用的 CSS 变量。
 */
import type { ThemeTokens } from './tokens'
import { brand } from './colors'

export { brand, error, hexToRgb, info, neutral, pickByMode, rgba, success, warning } from './colors'
export { getThemeOverrides } from './overrides'
export type { ThemeTokens } from './tokens'
export { buildTokens } from './tokens'

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
    '--vtsuru-border': tokens.borderColor,
    '--vtsuru-radius': tokens.radiusSurface,
    '--vtsuru-radius-control': tokens.radiusControl,
    '--vtsuru-shadow-1': tokens.shadow1,
    '--vtsuru-shadow-2': tokens.shadow2,
    '--vtsuru-shadow-popover': tokens.shadowPopover,
  }
  for (const [k, v] of Object.entries(vars)) target.style.setProperty(k, v)
}
