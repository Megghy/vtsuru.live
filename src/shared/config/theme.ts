import type { GlobalThemeOverrides } from 'naive-ui'

/**
 * Shadcn/ui (New York) inspired tokens (Zinc).
 *
 * - Prefer borders + subtle shadows over heavy elevation.
 * - Radius: surfaces 6px, controls 4px, small elements 2px.
 * - Focus: keep border stable, use a subtle ring.
 * - Compactness: Reduced height (30px), smaller paddings, tighter typography (13px).
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
  const radiusSurface = '6px'
  const radiusControl = '4px'
  const radiusSmall = '2px'

  const background = isDark ? colors.neutral[950] : '#ffffff'
  const foreground = isDark ? colors.neutral[50] : colors.neutral[950]

  const borderColor = isDark ? colors.neutral[800] : colors.neutral[300]
  const inputBorderColor = borderColor

  const muted = isDark ? colors.neutral[900] : colors.neutral[100]
  const mutedForeground = isDark ? colors.neutral[400] : colors.neutral[500]

  const ringColor = isDark ? colors.neutral[300] : colors.neutral[400]
  const ringShadow = `0 0 0 2px ${rgba(ringColor, isDark ? 0.35 : 0.3)}`

  // Tone down primary in dark mode to be less "blinding"
  const primary = isDark ? colors.neutral[200] : colors.neutral[900]
  const primaryHover = isDark ? colors.neutral[100] : colors.neutral[800]
  const primaryPressed = isDark ? colors.neutral[300] : colors.neutral[950]
  const primaryForeground = isDark ? colors.neutral[950] : colors.neutral[50]

  // Tooltips should always have strong contrast (shadcn style: dark tooltip w/ light text)
  const tooltipColor = isDark ? colors.neutral[800] : colors.neutral[900]
  const tooltipTextColor = colors.neutral[50]

  // Shadows: keep them consistent across all floating surfaces.
  // Add a very subtle outer glow in dark mode to separate from the page background.
  const shadowGlow = isDark ? `0 0 0 1px ${rgba(colors.neutral[50], 0.06)}` : ''
  const shadow2Base = isDark
    ? `0 4px 12px ${rgba(colors.neutral[950], 0.7)}`
    : `0 4px 12px ${rgba(colors.neutral[950], 0.12)}`
  const shadow3Base = isDark
    ? `0 8px 30px ${rgba(colors.neutral[950], 0.7)}`
    : `0 8px 30px ${rgba(colors.neutral[950], 0.12)}`
  const shadow2 = isDark ? `${shadowGlow}, ${shadow2Base}` : shadow2Base
  const shadowPopover = isDark ? `${shadowGlow}, ${shadow3Base}` : shadow3Base

  // Embedded background for subtle distinction
  const embeddedColor = isDark ? colors.neutral[900] : colors.neutral[50]

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
      tableColor: background,
      tableColorHover: embeddedColor,
      tableHeaderColor: embeddedColor,

      dividerColor: borderColor,
      borderColor,

      // Custom surface for subtle distinction
      inputColor: background,
      inputColorDisabled: embeddedColor,
      placeholderColor: isDark ? colors.neutral[600] : colors.neutral[400],
      placeholderColorDisabled: isDark ? colors.neutral[700] : colors.neutral[300],

      fontFamily: 'Inter, "Noto Sans SC", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      borderRadius: radiusSurface,
      borderRadiusSmall: radiusSmall,
      lineHeight: '1.4',
      fontSize: '13px',
      fontSizeSmall: '12px',
      fontSizeMedium: '13px',
      fontSizeLarge: '15px',

      heightSmall: '24px',
      heightMedium: '30px',
      heightLarge: '36px',

      boxShadow1: isDark ? `0 1px 2px ${rgba(colors.neutral[950], 0.6)}` : `0 1px 2px ${rgba(colors.neutral[950], 0.06)}`,
      boxShadow2: shadow2,
      boxShadow3: shadowPopover,
    },
    Button: {
      heightMedium: '30px',
      // Keep buttons aligned with inputs in input-group even when using size="small"
      heightSmall: '30px',
      heightLarge: '36px',
      fontSizeMedium: '13px',
      borderRadiusMedium: radiusControl,
      borderRadiusSmall: radiusControl,
      paddingMedium: '0 12px',
      paddingSmall: '0 10px',
      paddingLarge: '0 16px',
      fontWeight: '500',

      color: background,
      colorHover: muted,
      colorPressed: isDark ? colors.neutral[800] : colors.neutral[200],
      border: `1px solid ${borderColor}`,
      borderHover: `1px solid ${borderColor}`,
      borderPressed: `1px solid ${borderColor}`,
      textColor: foreground,

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
      heightMedium: '30px',
      heightSmall: '24px',
      heightLarge: '36px',
      borderRadius: radiusControl,
      border: `1px solid ${inputBorderColor}`,
      borderHover: `1px solid ${isDark ? colors.neutral[700] : colors.neutral[300]}`,
      borderFocus: `1px solid ${inputBorderColor}`,
      boxShadowFocus: ringShadow,
      color: background,
      colorFocus: background,
      textColor: foreground,
      paddingMedium: '0 10px',
      paddingSmall: '0 8px',
    },
    Select: {
      peers: {
        InternalSelection: {
          heightMedium: '30px',
          heightSmall: '24px',
          heightLarge: '36px',
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
          optionHeightMedium: '30px',
          optionHeightSmall: '26px',
        },
      },
    },
    Card: {
      borderRadius: radiusSurface,
      color: background,
      colorEmbedded: embeddedColor,
      borderColor,
      paddingSmall: '12px 16px',
      paddingMedium: '16px 20px',
      paddingLarge: '20px 24px',
      paddingHuge: '24px 32px',
      titleFontSizeSmall: '13px',
      titleFontSizeMedium: '15px',
      titleFontSizeLarge: '17px',
    },
    Modal: {
      color: background,
    },
    Dialog: {
      borderRadius: radiusSurface,
      color: background,
      iconColor: foreground,
      closeIconColor: mutedForeground,
      padding: '20px',
      actionSpace: '16px',
      titleFontSize: '15px',
    },
    Popover: {
      borderRadius: radiusControl,
      color: background,
      boxShadow: shadowPopover,
      padding: '8px 12px',
    },
    Switch: {
      railColor: isDark ? colors.neutral[800] : colors.neutral[200],
      railColorActive: primary,
      railHeightMedium: '20px',
      railWidthMedium: '44px',
      railHeightSmall: '16px',
      railWidthSmall: '34px',
      buttonHeightMedium: '16px',
      buttonWidthMedium: '16px',
      buttonHeightSmall: '12px',
      buttonWidthSmall: '12px',
    },
    Checkbox: {
      borderRadius: radiusSmall,
      color: background,
      colorChecked: primary,
      border: `1px solid ${borderColor}`,
      borderChecked: `1px solid ${primary}`,
      checkMarkColor: primaryForeground,
      sizeMedium: '16px',
    },
    Radio: {
      buttonBorderColor: borderColor,
      buttonBorderColorActive: primary,
      buttonTextColor: foreground,
      buttonTextColorActive: primaryForeground,
      buttonColor: background,
      buttonColorActive: primary,
      buttonHeightMedium: '30px',
      buttonHeightSmall: '24px',
      dotColorActive: primary,
      radioSizeMedium: '16px',
    },
    Tooltip: {
      color: tooltipColor,
      textColor: tooltipTextColor,
      borderRadius: radiusControl,
      padding: '6px 10px',
      boxShadow: shadowPopover,
    },
    Menu: {
      borderRadius: radiusControl,
      itemColorActive: muted,
      itemColorActiveHover: muted,
      itemTextColorActive: foreground,
      itemTextColorActiveHover: foreground,
      itemIconColorActive: foreground,
      itemIconColorActiveHover: foreground,
      itemHeight: '36px',
    },
    Dropdown: {
      borderRadius: radiusControl,
      color: background,
      optionColorHover: muted,
      optionHeightMedium: '30px',
      optionHeightSmall: '26px',
      padding: '4px 0',
    },
    Message: {
      borderRadius: radiusControl,
      color: embeddedColor,
      textColor: foreground,
      border: `1px solid ${borderColor}`,
      padding: '8px 12px',
      iconMargin: '0 8px 0 0',
      closeMargin: '0 0 0 8px',
    },
    Notification: {
      borderRadius: radiusSurface,
      color: embeddedColor,
      headerTextColor: foreground,
      descriptionTextColor: mutedForeground,
      padding: '12px 16px',
    },
    Tag: {
      borderRadius: radiusControl,
      // Keep primary tag readable in bordered mode:
      // - text should be primaryColor (not inverted)
      // - background should be a subtle tint (not solid)
      colorPrimary: rgba(primary, 0.12),
      borderPrimary: `1px solid ${rgba(primary, 0.8)}`,
      textColorPrimary: primary,
      heightMedium: '28px',
      heightSmall: '24px',
      padding: '0 12px',
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
      borderRadius: radiusControl,
      titleFontWeight: '500',
      padding: '12px 16px',
      lineHeight: '1.4',
      fontSize: '13px',
    },
    Progress: {
      railColor: isDark ? colors.neutral[800] : colors.neutral[200],
    },
    Divider: {
      color: borderColor,
    },
    Form: {
      feedbackPadding: '4px 0 0 0',
    },
    Table: {
      thPaddingMedium: '10px 12px',
      tdPaddingMedium: '10px 12px',
      thPaddingSmall: '8px 10px',
      tdPaddingSmall: '8px 10px',
      borderColor,
    },
    DataTable: {
      thPaddingMedium: '10px 12px',
      tdPaddingMedium: '10px 12px',
      thPaddingSmall: '8px 10px',
      tdPaddingSmall: '8px 10px',
      borderColor,
    },
    Tabs: {
      tabPaddingMediumLine: '10px 16px',
      tabPaddingMediumCard: '8px 16px',
      tabPaddingMediumBar: '8px 16px',
      tabPaddingSmallLine: '8px 12px',
      tabPaddingSmallCard: '6px 12px',
      tabPaddingSmallBar: '6px 12px',
      // Dark mode needs stronger selected-state contrast
      colorSegment: embeddedColor,
      tabColorSegment: isDark ? colors.neutral[800] : '#ffffff',
      tabTextColorActiveSegment: foreground,
      tabTextColorHoverSegment: foreground,
    },
    Collapse: {
      titlePadding: '8px 0',
      itemMargin: '8px 0',
    },
    PageHeader: {
      titleFontSize: '15px',
      backSize: '20px',
    },
    Result: {
      iconSizeLarge: '64px',
      iconSizeMedium: '48px',
      iconSizeSmall: '36px',
      titleFontSizeLarge: '24px',
      titleFontSizeMedium: '18px',
      titleFontSizeSmall: '15px',
    },
    Timeline: {
      titleFontSizeMedium: '13px',
    },
    Transfer: {
      headerHeightMedium: '36px',
      itemHeightSmall: '24px',
      itemHeightMedium: '30px',
      itemHeightLarge: '36px',
    },
    Upload: {
      draggerBorder: `1px dashed ${borderColor}`,
      draggerBorderHover: `1px dashed ${primary}`,
    },
    Slider: {
      railHeight: '4px',
      handleSize: '14px',
    },
    DatePicker: {
      itemFontSize: '13px',
      itemSize: '28px',
      itemCellHeight: '28px',
      itemCellWidth: '28px',
      panelActionPadding: '8px 12px',
    },
    ColorPicker: {
      heightMedium: '30px',
      fontSizeMedium: '13px',
      heightSmall: '24px',
      fontSizeSmall: '12px',
      heightLarge: '36px',
      fontSizeLarge: '15px',
    },
    Skeleton: {
      color: isDark ? colors.neutral[800] : colors.neutral[200],
      colorEnd: isDark ? colors.neutral[700] : colors.neutral[300],
    },
    Statistic: {
      labelFontSize: '12px',
      valueFontSize: '20px',
    },
    List: {
      borderRadius: radiusSurface,
    },
    Empty: {
      iconSizeSmall: '32px',
      iconSizeMedium: '48px',
      iconSizeLarge: '64px',
      fontSizeSmall: '12px',
      fontSizeMedium: '13px',
      fontSizeLarge: '15px',
    },
    Popconfirm: {
      iconSize: '18px',
    },
    Pagination: {
      itemSizeMedium: '30px',
      itemSizeSmall: '26px',
      itemBorderRadius: radiusControl,
      buttonIconSizeMedium: '16px',
      buttonIconSizeSmall: '14px',
    },
    Descriptions: {
      thPaddingMedium: '10px 12px',
      tdPaddingMedium: '10px 12px',
      thPaddingSmall: '8px 10px',
      tdPaddingSmall: '8px 10px',
      fontSizeMedium: '13px',
      fontSizeSmall: '12px',
    },
    Steps: {
      indicatorSizeMedium: '28px',
      indicatorSizeSmall: '24px',
      stepHeaderFontSizeMedium: '13px',
      stepHeaderFontSizeSmall: '12px',
    },
    Breadcrumb: {
      fontSize: '13px',
      itemTextColorHover: primary,
      itemTextColorPressed: primaryPressed,
    },
    Anchor: {
      linkPadding: '4px 0 4px 12px',
      linkFontSize: '13px',
    },
    Tree: {
      nodeHeight: '30px',
      fontSize: '13px',
    },
    Scrollbar: {
      color: rgba(ringColor, 0.2),
      colorHover: rgba(ringColor, 0.4),
      width: '6px',
      height: '6px',
    },
  }
}
