import { getShadcnCssVars } from './shadcn'
import { brand, error, hexToRgb, info, pickByMode, rgba, success, warning } from './colors'
/**
 * 主题入口：统一 shadcn 变量体系，只保留业务特有的补充变量。
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
 * 生成全局 CSS 变量：shadcn 标准变量 + 业务补充变量。
 * 在 App.vue 的 watchEffect 里调用 applyThemeCssVars 注入到 :root。
 */
export function getThemeCssVars(tokens: ThemeTokens): Record<string, string> {
  const infoColor = pickByMode(tokens.isDark, info.light, info.dark)
  const successColor = pickByMode(tokens.isDark, success.light, success.dark)
  const warningColor = pickByMode(tokens.isDark, warning.light, warning.dark)
  const errorColor = pickByMode(tokens.isDark, error.light, error.dark)

  return {
    ...getShadcnCssVars(tokens),

    // 业务特有变量：布局尺寸、动画曲线
    '--vtsuru-header-height': '50px',
    '--vtsuru-content-padding': '12px',
    '--vtsuru-bezier': 'cubic-bezier(.4, 0, .2, 1)',

    // 语义化状态色（shadcn 未覆盖）
    '--vtsuru-info': infoColor,
    '--vtsuru-info-rgb': rgbTriplet(infoColor),
    '--vtsuru-info-soft': rgba(infoColor, 0.12),
    '--vtsuru-success': successColor,
    '--vtsuru-success-rgb': rgbTriplet(successColor),
    '--vtsuru-success-soft': rgba(successColor, 0.12),
    '--vtsuru-warning': warningColor,
    '--vtsuru-warning-rgb': rgbTriplet(warningColor),
    '--vtsuru-warning-soft': rgba(warningColor, 0.12),
    '--vtsuru-error': errorColor,
    '--vtsuru-error-rgb': rgbTriplet(errorColor),
    '--vtsuru-error-soft': rgba(errorColor, 0.12),
    '--vtsuru-error-pressed': pickByMode(tokens.isDark, error.lightPressed, error.darkPressed),

    // Brand 色阶（供特殊场景使用）
    '--vtsuru-brand-50': brand[50],
    '--vtsuru-brand-100': brand[100],
    '--vtsuru-brand-400': brand[400],
    '--vtsuru-brand-500': brand[500],
  }
}

export function applyThemeCssVars(tokens: ThemeTokens, target: HTMLElement = document.documentElement) {
  for (const [key, value] of Object.entries(getThemeCssVars(tokens))) {
    target.style.setProperty(key, value)
  }
}
