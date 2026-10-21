import { error, pickByMode } from './colors'
import type { ThemeTokens } from './tokens'

/** Shadcn 标准 CSS 变量 + VTsuru 品牌扩展 */
export function getShadcnCssVars(t: ThemeTokens): Record<string, string> {
  return {
    'color-scheme': t.isDark ? 'dark' : 'light',
    '--background': t.canvas,
    '--foreground': t.foreground,
    '--card': t.surface,
    '--card-foreground': t.foreground,
    '--popover': t.elevated,
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
    '--shadow-sm': t.shadow1,
    '--shadow-md': t.shadow2,
    '--shadow-lg': t.shadowPopover,
  }
}
