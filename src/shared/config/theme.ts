import type { GlobalThemeOverrides } from 'naive-ui'

/**
 * Shadcn/ui (New York) inspired tokens (Zinc).
 *
 * - Prefer borders + subtle shadows over heavy elevation.
 * - Radius: surfaces 8px, controls 6px, small elements 4px.
 * - Focus: keep border stable, use a subtle ring.
 */
const colors = {
  neutral: {
    50: '#fafafa',
    100: '#f4f4f5',
    200: '#e4e4e7',
    300: '#d4d4d8',
    400: '#a1a1aa',
    500: '#71717a',
    600: '#52525b',
    700: '#3f3f46',
    800: '#27272a',
    900: '#18181b',
    950: '#09090b',
  },
  info: {
    DEFAULT: '#2563eb',
    hover: '#3b82f6',
    pressed: '#1d4ed8',
    suppl: '#1e40af',
  },
  success: {
    DEFAULT: '#16a34a',
    hover: '#22c55e',
    pressed: '#15803d',
    suppl: '#14532d',
  },
  warning: {
    DEFAULT: '#d97706',
    hover: '#f59e0b',
    pressed: '#b45309',
    suppl: '#78350f',
  },
  error: {
    DEFAULT: '#dc2626',
    hover: '#ef4444',
    pressed: '#b91c1c',
    suppl: '#7f1d1d',
  },
}

function hexToRgb(hex: string) {
  const normalized = hex.startsWith('#') ? hex.slice(1) : hex
  if (!/^[0-9a-f]{6}$/i.test(normalized)) throw new Error(`Invalid hex color: ${hex}`)
  const r = Number.parseInt(normalized.slice(0, 2), 16)
  const g = Number.parseInt(normalized.slice(2, 4), 16)
  const b = Number.parseInt(normalized.slice(4, 6), 16)
  return { r, g, b }
}

function rgba(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function getThemeOverrides(isDark: boolean): GlobalThemeOverrides {
  const radiusSurface = '8px'
  const radiusControl = '6px'
  const radiusSmall = '4px'

  const background = isDark ? colors.neutral[950] : '#ffffff'
  const foreground = isDark ? colors.neutral[50] : colors.neutral[950]

  const borderColor = isDark ? colors.neutral[800] : colors.neutral[200]
  const inputBorderColor = borderColor

  const muted = isDark ? colors.neutral[900] : colors.neutral[100]
  const mutedForeground = isDark ? colors.neutral[400] : colors.neutral[500]

  const ringColor = isDark ? colors.neutral[300] : colors.neutral[400]
  const ringShadow = `0 0 0 2px ${rgba(ringColor, isDark ? 0.35 : 0.3)}`

  const primary = isDark ? colors.neutral[50] : colors.neutral[900]
  const primaryHover = isDark ? colors.neutral[100] : colors.neutral[800]
  const primaryPressed = isDark ? colors.neutral[200] : colors.neutral[950]
  const primaryForeground = isDark ? colors.neutral[950] : colors.neutral[50]

  const shadowPopover = isDark
    ? `0 8px 30px ${rgba(colors.neutral[950], 0.7)}`
    : `0 8px 30px ${rgba(colors.neutral[950], 0.12)}`

  return {
    common: {
      primaryColor: primary,
      primaryColorHover: primaryHover,
      primaryColorPressed: primaryPressed,
      primaryColorSuppl: ringColor,

      infoColor: isDark ? '#60a5fa' : colors.info.DEFAULT,
      infoColorHover: isDark ? '#93c5fd' : colors.info.hover,
      infoColorPressed: isDark ? '#3b82f6' : colors.info.pressed,
      infoColorSuppl: isDark ? '#1d4ed8' : colors.info.suppl,

      successColor: isDark ? '#4ade80' : colors.success.DEFAULT,
      successColorHover: isDark ? '#86efac' : colors.success.hover,
      successColorPressed: isDark ? '#22c55e' : colors.success.pressed,
      successColorSuppl: isDark ? '#15803d' : colors.success.suppl,

      warningColor: isDark ? '#fbbf24' : colors.warning.DEFAULT,
      warningColorHover: isDark ? '#fcd34d' : colors.warning.hover,
      warningColorPressed: isDark ? '#f59e0b' : colors.warning.pressed,
      warningColorSuppl: isDark ? '#b45309' : colors.warning.suppl,

      errorColor: isDark ? '#f87171' : colors.error.DEFAULT,
      errorColorHover: isDark ? '#fca5a5' : colors.error.hover,
      errorColorPressed: isDark ? '#ef4444' : colors.error.pressed,
      errorColorSuppl: isDark ? '#b91c1c' : colors.error.suppl,

      textColorBase: foreground,
      textColor1: foreground,
      textColor2: mutedForeground,
      textColor3: isDark ? colors.neutral[500] : colors.neutral[400],

      bodyColor: background,
      cardColor: background,
      modalColor: background,
      popoverColor: background,

      borderColor,
      dividerColor: borderColor,

      fontFamily: 'Inter, "Noto Sans SC", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      borderRadius: radiusSurface,
      borderRadiusSmall: radiusSmall,
      lineHeight: '1.5',
      fontSize: '14px',
      boxShadow1: isDark ? `0 1px 2px ${rgba(colors.neutral[950], 0.6)}` : `0 1px 2px ${rgba(colors.neutral[950], 0.06)}`,
      boxShadow2: isDark ? `0 4px 12px ${rgba(colors.neutral[950], 0.7)}` : `0 4px 12px ${rgba(colors.neutral[950], 0.12)}`,
      boxShadow3: shadowPopover,
    },
    Button: {
      heightMedium: '36px',
      fontSizeMedium: '14px',
      borderRadiusMedium: radiusControl,
      fontWeight: '500',

      // Outline (Naive "default" type): bg + border, hover uses muted surface.
      color: background,
      colorHover: muted,
      colorPressed: isDark ? colors.neutral[800] : colors.neutral[200],
      border: `1px solid ${borderColor}`,
      borderHover: `1px solid ${borderColor}`,
      borderPressed: `1px solid ${borderColor}`,
      textColor: foreground,

      // Primary variant: filled, high contrast.
      colorPrimary: primary,
      colorHoverPrimary: primaryHover,
      colorPressedPrimary: primaryPressed,
      borderPrimary: `1px solid ${primary}`,
      borderHoverPrimary: `1px solid ${primaryHover}`,
      borderPressedPrimary: `1px solid ${primaryPressed}`,
      textColorPrimary: primaryForeground,
      textColorHoverPrimary: primaryForeground,
      textColorPressedPrimary: primaryForeground,
      textColorFocusPrimary: primaryForeground,

      // Dark mode: use black text on light pastel buttons for better contrast
      textColorInfo: isDark ? colors.neutral[950] : undefined,
      textColorHoverInfo: isDark ? colors.neutral[950] : undefined,
      textColorPressedInfo: isDark ? colors.neutral[950] : undefined,
      textColorFocusInfo: isDark ? colors.neutral[950] : undefined,

      textColorSuccess: isDark ? colors.neutral[950] : undefined,
      textColorHoverSuccess: isDark ? colors.neutral[950] : undefined,
      textColorPressedSuccess: isDark ? colors.neutral[950] : undefined,
      textColorFocusSuccess: isDark ? colors.neutral[950] : undefined,

      textColorWarning: isDark ? colors.neutral[950] : undefined,
      textColorHoverWarning: isDark ? colors.neutral[950] : undefined,
      textColorPressedWarning: isDark ? colors.neutral[950] : undefined,
      textColorFocusWarning: isDark ? colors.neutral[950] : undefined,

      textColorError: isDark ? colors.neutral[950] : undefined,
      textColorHoverError: isDark ? colors.neutral[950] : undefined,
      textColorPressedError: isDark ? colors.neutral[950] : undefined,
      textColorFocusError: isDark ? colors.neutral[950] : undefined,
    },
    Input: {
      heightMedium: '36px',
      borderRadius: radiusControl,
      border: `1px solid ${inputBorderColor}`,
      borderHover: `1px solid ${isDark ? colors.neutral[700] : colors.neutral[300]}`,
      borderFocus: `1px solid ${inputBorderColor}`,
      boxShadowFocus: ringShadow,
      color: background,
      colorFocus: background,
      textColor: foreground,
    },
    Select: {
      peers: {
        InternalSelection: {
          heightMedium: '36px',
          borderRadius: radiusControl,
          border: `1px solid ${inputBorderColor}`,
          borderHover: `1px solid ${isDark ? colors.neutral[700] : colors.neutral[300]}`,
          borderFocus: `1px solid ${inputBorderColor}`,
          boxShadowFocus: ringShadow,
          color: background,
          textColor: foreground,
        },
        InternalSelectMenu: {
          borderRadius: radiusControl,
          color: background,
        },
      },
    },
    Card: {
      borderRadius: radiusSurface,
      color: background,
      borderColor,
    },
    Modal: {
      color: background,
    },
    Dialog: {
      borderRadius: radiusSurface,
      color: background,
      iconColor: foreground,
      closeIconColor: mutedForeground,
    },
    Popover: {
      borderRadius: radiusControl,
      color: background,
      boxShadow: shadowPopover,
    },
    Switch: {
      railColor: isDark ? colors.neutral[800] : colors.neutral[200],
      railColorActive: primary,
    },
    Checkbox: {
      borderRadius: radiusSmall,
      color: background,
      colorChecked: primary,
      border: `1px solid ${borderColor}`,
      borderChecked: `1px solid ${primary}`,
      checkMarkColor: primaryForeground,
    },
    Radio: {
      buttonBorderColor: borderColor,
      buttonBorderColorActive: primary,
      buttonTextColorActive: primary,
      dotColorActive: primary,
    },
    Tooltip: {
      color: primary,
      textColor: primaryForeground,
      borderRadius: radiusControl,
    },
    Menu: {
      borderRadius: radiusControl,
      itemColorActive: muted,
      itemColorActiveHover: muted,
      itemTextColorActive: foreground,
      itemTextColorActiveHover: foreground,
      itemIconColorActive: foreground,
      itemIconColorActiveHover: foreground,
    },
    Dropdown: {
      borderRadius: radiusControl,
      color: background,
      optionColorHover: muted,
    },
    Message: {
      borderRadius: radiusControl,
      color: background,
      textColor: foreground,
      boxShadow: shadowPopover,
    },
    Notification: {
      borderRadius: radiusSurface,
      color: background,
      headerTextColor: foreground,
      descriptionTextColor: mutedForeground,
      boxShadow: shadowPopover,
    },
    Tag: {
      borderRadius: radiusControl,
      textColorPrimary: isDark ? colors.neutral[950] : undefined,
      textColorInfo: isDark ? colors.neutral[950] : undefined,
      textColorSuccess: isDark ? colors.neutral[950] : undefined,
      textColorWarning: isDark ? colors.neutral[950] : undefined,
      textColorError: isDark ? colors.neutral[950] : undefined,
    },
    Badge: {
      colorInfo: isDark ? '#60a5fa' : colors.info.DEFAULT,
      colorSuccess: isDark ? '#4ade80' : colors.success.DEFAULT,
      colorWarning: isDark ? '#fbbf24' : colors.warning.DEFAULT,
      colorError: isDark ? '#f87171' : colors.error.DEFAULT,
    },
    Avatar: {
      color: muted,
    },
    Alert: {
      // In dark mode, we use lighter pastel colors for icons to be visible
      // standard background opacity might be fine, but ensuring consistency
    },
    Progress: {
      railColor: isDark ? colors.neutral[800] : colors.neutral[200],
    },
    Divider: {
      color: borderColor,
    },
  }
}
