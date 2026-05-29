/**
 * naive-ui 全局主题：组件级 override 集中入口。
 *
 * 设计原则：
 * - primary 保持中性（shadcn/Zinc 风格），不要被替换为品牌色
 * - 品牌色只用于 loading / switch active / 链接 anchor 等具有“品牌曝光”意义的位置
 * - 暗色 / 亮色 token 由 buildTokens 统一产出，本文件不再读 isDark
 */
import type { GlobalThemeOverrides } from 'naive-ui'
import { error, info, neutral, pickByMode, rgba, success, warning } from './colors'
import { buildTokens } from './tokens'

export function getThemeOverrides(isDark: boolean): GlobalThemeOverrides {
  const t = buildTokens(isDark)

  const infoColor = pickByMode(isDark, info.light, info.dark)
  const infoColorHover = pickByMode(isDark, info.lightHover, info.darkHover)
  const infoColorPressed = pickByMode(isDark, info.lightPressed, info.darkPressed)
  const infoColorSuppl = pickByMode(isDark, info.lightSuppl, info.darkSuppl)

  const successColor = pickByMode(isDark, success.light, success.dark)
  const successColorHover = pickByMode(isDark, success.lightHover, success.darkHover)
  const successColorPressed = pickByMode(isDark, success.lightPressed, success.darkPressed)
  const successColorSuppl = pickByMode(isDark, success.lightSuppl, success.darkSuppl)

  const warningColor = pickByMode(isDark, warning.light, warning.dark)
  const warningColorHover = pickByMode(isDark, warning.lightHover, warning.darkHover)
  const warningColorPressed = pickByMode(isDark, warning.lightPressed, warning.darkPressed)
  const warningColorSuppl = pickByMode(isDark, warning.lightSuppl, warning.darkSuppl)

  const errorColor = pickByMode(isDark, error.light, error.dark)
  const errorColorHover = pickByMode(isDark, error.lightHover, error.darkHover)
  const errorColorPressed = pickByMode(isDark, error.lightPressed, error.darkPressed)
  const errorColorSuppl = pickByMode(isDark, error.lightSuppl, error.darkSuppl)

  return {
    common: {
      primaryColor: t.primary,
      primaryColorHover: t.primaryHover,
      primaryColorPressed: t.primaryPressed,
      primaryColorSuppl: t.ringColor,

      infoColor,
      infoColorHover,
      infoColorPressed,
      infoColorSuppl,

      successColor,
      successColorHover,
      successColorPressed,
      successColorSuppl,

      warningColor,
      warningColorHover,
      warningColorPressed,
      warningColorSuppl,

      errorColor,
      errorColorHover,
      errorColorPressed,
      errorColorSuppl,

      textColorBase: t.foreground,
      textColor1: t.foreground,
      textColor2: t.mutedForeground,
      textColor3: isDark ? neutral[500] : neutral[400],

      bodyColor: t.background,
      cardColor: t.background,
      modalColor: t.background,
      popoverColor: t.background,
      tableColor: t.background,
      tableColorHover: t.embeddedColor,
      tableHeaderColor: t.embeddedColor,

      dividerColor: t.borderColor,
      borderColor: t.borderColor,

      inputColor: t.background,
      inputColorDisabled: t.embeddedColor,
      placeholderColor: t.placeholder,
      placeholderColorDisabled: t.placeholderDisabled,

      fontFamily:
        'Inter, "Noto Sans SC", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
      borderRadius: t.radiusSurface,
      borderRadiusSmall: t.radiusSmall,
      lineHeight: '1.4',
      fontSize: '13px',
      fontSizeSmall: '12px',
      fontSizeMedium: '13px',
      fontSizeLarge: '15px',

      heightSmall: '24px',
      heightMedium: '30px',
      heightLarge: '36px',

      boxShadow1: t.shadow1,
      boxShadow2: t.shadow2,
      boxShadow3: t.shadowPopover,
    },
    Button: {
      heightMedium: '30px',
      // 与 input-group 对齐：small 容器中拼装时也保持 30px
      heightSmall: '30px',
      heightLarge: '36px',
      fontSizeMedium: '13px',
      borderRadiusMedium: t.radiusControl,
      borderRadiusSmall: t.radiusControl,
      paddingMedium: '0 12px',
      paddingSmall: '0 10px',
      paddingLarge: '0 16px',
      fontWeight: '500',

      color: t.background,
      colorHover: t.muted,
      colorPressed: isDark ? neutral[800] : neutral[200],
      border: `1px solid ${t.borderColor}`,
      borderHover: `1px solid ${t.borderColor}`,
      borderPressed: `1px solid ${t.borderColor}`,
      textColor: t.foreground,

      colorPrimary: t.primary,
      colorHoverPrimary: t.primaryHover,
      colorPressedPrimary: t.primaryPressed,
      borderPrimary: `1px solid ${t.primary}`,
      borderHoverPrimary: `1px solid ${t.primaryHover}`,
      borderPressedPrimary: `1px solid ${t.primaryPressed}`,
      textColorPrimary: t.primaryForeground,
      textColorHoverPrimary: t.primaryForeground,
      textColorPressedPrimary: t.primaryForeground,
      textColorFocusPrimary: t.primaryForeground,

      // 暗色模式下彩色按钮使用深色文字以保持对比度
      textColorInfo: t.darkTextOnTint,
      textColorHoverInfo: t.darkTextOnTint,
      textColorPressedInfo: t.darkTextOnTint,
      textColorFocusInfo: t.darkTextOnTint,
      textColorSuccess: t.darkTextOnTint,
      textColorHoverSuccess: t.darkTextOnTint,
      textColorPressedSuccess: t.darkTextOnTint,
      textColorFocusSuccess: t.darkTextOnTint,
      textColorWarning: t.darkTextOnTint,
      textColorHoverWarning: t.darkTextOnTint,
      textColorPressedWarning: t.darkTextOnTint,
      textColorFocusWarning: t.darkTextOnTint,
      textColorError: t.darkTextOnTint,
      textColorHoverError: t.darkTextOnTint,
      textColorPressedError: t.darkTextOnTint,
      textColorFocusError: t.darkTextOnTint,
    },
    Input: {
      heightMedium: '30px',
      heightSmall: '24px',
      heightLarge: '36px',
      borderRadius: t.radiusControl,
      border: `1px solid ${t.inputBorderColor}`,
      borderHover: `1px solid ${t.inputBorderHover}`,
      borderFocus: `1px solid ${t.inputBorderColor}`,
      boxShadowFocus: t.ringShadow,
      color: t.background,
      colorFocus: t.background,
      textColor: t.foreground,
      paddingMedium: '0 10px',
      paddingSmall: '0 8px',
    },
    Select: {
      peers: {
        InternalSelection: {
          heightMedium: '30px',
          heightSmall: '24px',
          heightLarge: '36px',
          borderRadius: t.radiusControl,
          border: `1px solid ${t.inputBorderColor}`,
          borderHover: `1px solid ${t.inputBorderHover}`,
          borderFocus: `1px solid ${t.inputBorderColor}`,
          boxShadowFocus: t.ringShadow,
          color: t.background,
          textColor: t.foreground,
        },
        InternalSelectMenu: {
          borderRadius: t.radiusControl,
          color: t.background,
          optionHeightMedium: '30px',
          optionHeightSmall: '26px',
        },
      },
    },
    Card: {
      borderRadius: t.radiusSurface,
      color: t.background,
      colorEmbedded: t.embeddedColor,
      borderColor: t.borderColor,
      paddingSmall: '12px 16px',
      paddingMedium: '16px 20px',
      paddingLarge: '20px 24px',
      paddingHuge: '24px 32px',
      titleFontSizeSmall: '13px',
      titleFontSizeMedium: '15px',
      titleFontSizeLarge: '17px',
    },
    Modal: {
      color: t.background,
    },
    Dialog: {
      borderRadius: t.radiusSurface,
      color: t.background,
      iconColor: t.foreground,
      closeIconColor: t.mutedForeground,
      padding: '20px',
      actionSpace: '16px',
      titleFontSize: '15px',
      // 提示态图标用语义色
      iconColorInfo: infoColor,
      iconColorSuccess: successColor,
      iconColorWarning: warningColor,
      iconColorError: errorColor,
    },
    Popover: {
      borderRadius: t.radiusControl,
      color: t.background,
      boxShadow: t.shadowPopover,
      padding: '8px 12px',
    },
    Switch: {
      // 关闭态保持中性灰
      railColor: isDark ? neutral[800] : neutral[200],
      // 激活态使用品牌色：避免暗色模式下 white-on-white 对比不足
      railColorActive: t.brand,
      railHeightMedium: '20px',
      railWidthMedium: '44px',
      railHeightSmall: '16px',
      railWidthSmall: '34px',
      buttonHeightMedium: '16px',
      buttonWidthMedium: '16px',
      buttonHeightSmall: '12px',
      buttonWidthSmall: '12px',
      loadingColor: t.brand,
    },
    Checkbox: {
      borderRadius: t.radiusSmall,
      color: t.background,
      colorChecked: t.primary,
      border: `1px solid ${t.borderColor}`,
      borderChecked: `1px solid ${t.primary}`,
      checkMarkColor: t.primaryForeground,
      sizeMedium: '16px',
    },
    Radio: {
      buttonBorderColor: t.borderColor,
      buttonBorderColorActive: t.primary,
      buttonTextColor: t.foreground,
      buttonTextColorActive: t.primaryForeground,
      buttonColor: t.background,
      buttonColorActive: t.primary,
      buttonHeightMedium: '30px',
      buttonHeightSmall: '24px',
      dotColorActive: t.primary,
      radioSizeMedium: '16px',
    },
    Tooltip: {
      color: t.tooltipColor,
      textColor: t.tooltipTextColor,
      borderRadius: t.radiusControl,
      padding: '6px 10px',
      boxShadow: t.shadowPopover,
    },
    Menu: {
      borderRadius: t.radiusControl,
      itemColorActive: t.muted,
      itemColorActiveHover: t.muted,
      itemTextColorActive: t.foreground,
      itemTextColorActiveHover: t.foreground,
      itemIconColorActive: t.foreground,
      itemIconColorActiveHover: t.foreground,
      itemHeight: '36px',
    },
    Dropdown: {
      borderRadius: t.radiusControl,
      color: t.background,
      optionColorHover: t.muted,
      optionHeightMedium: '30px',
      optionHeightSmall: '26px',
      padding: '4px 0',
    },
    Message: {
      borderRadius: t.radiusControl,
      color: t.embeddedColor,
      textColor: t.foreground,
      border: `1px solid ${t.borderColor}`,
      padding: '8px 12px',
      iconMargin: '0 8px 0 0',
      closeMargin: '0 0 0 8px',
      iconColorInfo: infoColor,
      iconColorSuccess: successColor,
      iconColorWarning: warningColor,
      iconColorError: errorColor,
    },
    Notification: {
      borderRadius: t.radiusSurface,
      color: t.embeddedColor,
      headerTextColor: t.foreground,
      descriptionTextColor: t.mutedForeground,
      padding: '12px 16px',
      iconColorInfo: infoColor,
      iconColorSuccess: successColor,
      iconColorWarning: warningColor,
      iconColorError: errorColor,
    },
    Tag: {
      borderRadius: t.radiusControl,
      // primary tag 在中性 primary 下太淡，改用 brand 提供识别度
      colorPrimary: t.brandSoft,
      borderPrimary: `1px solid ${rgba(t.brand, 0.45)}`,
      textColorPrimary: t.brand,
      heightMedium: '28px',
      heightSmall: '24px',
      padding: '0 12px',
    },
    Badge: {
      colorInfo: infoColor,
      colorSuccess: successColor,
      colorWarning: warningColor,
      colorError: errorColor,
    },
    Avatar: {
      color: t.muted,
    },
    Alert: {
      borderRadius: t.radiusControl,
      titleFontWeight: '500',
      padding: '12px 16px',
      lineHeight: '1.4',
      fontSize: '13px',
      iconColorInfo: infoColor,
      iconColorSuccess: successColor,
      iconColorWarning: warningColor,
      iconColorError: errorColor,
    },
    Progress: {
      railColor: isDark ? neutral[800] : neutral[200],
      // 默认 fillColor 跟随 type=primary，保持中性；线性进度可在使用处指定 type
    },
    Divider: {
      color: t.borderColor,
    },
    Form: {
      feedbackPadding: '4px 0 0 0',
    },
    DataTable: {
      thPaddingMedium: '10px 12px',
      tdPaddingMedium: '10px 12px',
      thPaddingSmall: '8px 10px',
      tdPaddingSmall: '8px 10px',
      borderColor: t.borderColor,
    },
    Tabs: {
      tabPaddingMediumLine: '10px 16px',
      tabPaddingMediumCard: '8px 16px',
      tabPaddingMediumBar: '8px 16px',
      tabPaddingSmallLine: '8px 12px',
      tabPaddingSmallCard: '6px 12px',
      tabPaddingSmallBar: '6px 12px',
      colorSegment: t.embeddedColor,
      tabColorSegment: isDark ? neutral[800] : '#ffffff',
      tabTextColorActiveSegment: t.foreground,
      tabTextColorHoverSegment: t.foreground,
      // line 模式下激活下划线使用品牌色，强化页面层级
      barColor: t.brand,
      tabTextColorActiveLine: t.brand,
      tabTextColorHoverLine: t.brand,
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
      iconColorInfo: infoColor,
      iconColorSuccess: successColor,
      iconColorWarning: warningColor,
      iconColorError: errorColor,
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
      draggerBorder: `1px dashed ${t.borderColor}`,
      draggerBorderHover: `1px dashed ${t.brand}`,
    },
    Slider: {
      railHeight: '4px',
      handleSize: '14px',
      // 滑块填充用品牌色，与 Switch 激活态保持一致
      fillColor: t.brand,
      fillColorHover: t.brandHover,
      handleColor: t.brand,
      dotBorderActive: `2px solid ${t.brand}`,
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
      color: isDark ? neutral[800] : neutral[200],
      colorEnd: isDark ? neutral[700] : neutral[300],
    },
    Statistic: {
      labelFontSize: '12px',
      valueFontSize: '20px',
    },
    List: {
      borderRadius: t.radiusSurface,
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
      // popconfirm 默认是 warning 图标，跟随语义色
      iconColor: warningColor,
    },
    Pagination: {
      itemSizeMedium: '30px',
      itemSizeSmall: '26px',
      itemBorderRadius: t.radiusControl,
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
      itemTextColorHover: t.brand,
      itemTextColorPressed: t.brandPressed,
    },
    Anchor: {
      linkPadding: '4px 0 4px 12px',
      linkFontSize: '13px',
      linkTextColorHover: t.brand,
      linkTextColorActive: t.brand,
      railColorActive: t.brand,
    },
    Tree: {
      nodeHeight: '30px',
      fontSize: '13px',
    },
    Scrollbar: {
      color: rgba(t.ringColor, 0.2),
      colorHover: rgba(t.ringColor, 0.4),
      width: '6px',
      height: '6px',
    },
    Spin: {
      color: t.brand,
    },
    LoadingBar: {
      colorLoading: t.brand,
    },
  }
}
