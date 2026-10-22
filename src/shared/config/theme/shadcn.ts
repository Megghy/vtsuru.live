import { error, hexToRgb, pickByMode } from './colors'
import type { ThemeTokens } from './tokens'

/** 将十六进制颜色转换为 CSS RGB 格式（用于 rgba() 的变量替代） */
function toRgbString(hex: string): string {
  const { r, g, b } = hexToRgb(hex)
  return `${r} ${g} ${b}`
}

/** Shadcn 标准 CSS 变量 + VTsuru 品牌扩展 */
export function getShadcnCssVars(t: ThemeTokens): Record<string, string> {
  return {
    'color-scheme': t.isDark ? 'dark' : 'light',
    '--background': t.canvas,
    '--foreground': t.foreground,
    '--card': t.surface,
    '--card-foreground': t.foreground,
    '--popover': t.elevated,
    '--popover-rgb': toRgbString(t.elevated),
    '--popover-foreground': t.foreground,
    '--primary': t.primary,
    '--primary-foreground': t.primaryForeground,
    '--secondary': t.surfaceHover,
    '--secondary-foreground': t.foreground,
    '--muted': t.surfaceHover,
    '--muted-foreground': t.mutedForeground,
    '--accent': t.surfaceHover,
    '--accent-foreground': t.foreground,
    '--destructive': pickByMode(t.isDark, error.light, error.dark),
    '--destructive-foreground': t.isDark ? '#09090b' : '#fafafa',
    '--border': t.borderColor,
    '--input': t.inputBorderColor,
    '--ring': t.ringColor,
    '--brand': t.brand,
    '--brand-foreground': '#03202d',
    '--brand-soft': t.brandSoft,
    '--brand-tint': t.brandTint,
    '--brand-rail': t.brandRail,
    '--radius': t.radiusSurface,
    '--radius-control': t.radiusControl,
    '--radius-small': t.radiusSmall,
    '--control-h-xs': t.controlHeightXs,
    '--control-h-sm': t.controlHeightSm,
    '--control-h-default': t.controlHeightDefault,
    '--control-h-lg': t.controlHeightLg,
    '--shadow-sm': t.shadow1,
    '--shadow-md': t.shadow2,
    '--shadow-lg': t.shadowPopover,
  }
}
