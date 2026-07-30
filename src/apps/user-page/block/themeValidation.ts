import { asObject, optionalBoolean, optionalEnum, optionalFile, optionalNumber, optionalString } from './validationUtils'
import type { ValidationErrors } from './validationUtils'
import { isValidGoogleFontFamily } from '../googleFonts'
import {
  isValidPageMaxWidth,
  PAGE_BORDER_STRENGTHS,
  PAGE_BORDER_STYLES,
  PAGE_CONTROL_SIZES,
  PAGE_SHADOW_LEVELS,
  PAGE_SPACING_LEVELS,
} from '../themeConfig'

export function validateBlockPageTheme(theme: unknown, errors: ValidationErrors) {
  if (theme === undefined || theme === null) return
  const themeErrors: ValidationErrors = {
    push(message, fieldPath) {
      errors.push(message, fieldPath ? (fieldPath.startsWith('theme') ? fieldPath : `theme.${fieldPath}`) : 'theme')
    },
  }
  const props = asObject(theme)
  if (!props) {
    themeErrors.push('theme 必须是 object')
    return
  }

  ;['primaryColor', 'backgroundColor', 'textColor', 'textColorLight', 'textColorDark', 'pageBackgroundColor', 'fontFamily'].forEach(key => optionalString(props, key, 'theme', themeErrors))
  if (typeof props.fontFamily === 'string' && !isValidGoogleFontFamily(props.fontFamily)) {
    themeErrors.push('theme: fontFamily 格式不合法', 'fontFamily')
  }
  optionalBoolean(props, 'autoTextContrast', 'theme', themeErrors)
  optionalNumber(props, 'radius', 0, 32, 'theme', themeErrors)
  optionalEnum(props, 'borderStrength', PAGE_BORDER_STRENGTHS, 'theme', themeErrors)
  optionalEnum(props, 'borderStyle', PAGE_BORDER_STYLES, 'theme', themeErrors)
  optionalEnum(props, 'shadowLevel', PAGE_SHADOW_LEVELS, 'theme', themeErrors)
  optionalNumber(props, 'surfaceOpacity', 15, 100, 'theme', themeErrors)
  optionalEnum(props, 'spacing', PAGE_SPACING_LEVELS, 'theme', themeErrors)
  optionalEnum(props, 'controlSize', PAGE_CONTROL_SIZES, 'theme', themeErrors)
  optionalEnum(props, 'pageThemeMode', ['auto', 'light', 'dark'], 'theme', themeErrors)
  optionalEnum(props, 'pageBackgroundType', ['none', 'color', 'image'], 'theme', themeErrors)
  optionalEnum(props, 'pageBackgroundImageFit', ['cover', 'contain', 'fill', 'none'], 'theme', themeErrors)
  optionalBoolean(props, 'pageBackgroundCoverSidebar', 'theme', themeErrors)
  optionalEnum(props, 'pageBackgroundBlurMode', ['none', 'background', 'glass'], 'theme', themeErrors)
  optionalNumber(props, 'pageBackgroundBlur', 0, 40, 'theme', themeErrors)
  optionalEnum(props, 'pageBackgroundScrimMode', ['auto', 'black', 'white'], 'theme', themeErrors)
  optionalNumber(props, 'pageBackgroundScrimStrength', 0, 100, 'theme', themeErrors)
  optionalFile(props, 'pageBackgroundImageFile', 'theme', themeErrors)

  if (props.pageMaxWidth !== undefined) {
    if (typeof props.pageMaxWidth !== 'string' || !isValidPageMaxWidth(props.pageMaxWidth)) {
      themeErrors.push('theme: pageMaxWidth 仅支持 none / 100% / 1200px 这类格式', 'pageMaxWidth')
    }
  }
  if (props.pageBackgroundType === 'image' && props.pageBackgroundImageFile === undefined) {
    themeErrors.push('theme: pageBackgroundType=image 时必须提供 pageBackgroundImageFile', 'pageBackgroundImageFile')
  }
}
