import { asObject, optionalBoolean, optionalEnum, optionalFile, optionalNumber, optionalString } from './validationUtils'
import type { ValidationErrors } from './validationUtils'

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

  ;['primaryColor', 'backgroundColor', 'textColor', 'textColorLight', 'textColorDark', 'pageBackgroundColor'].forEach(key => optionalString(props, key, 'theme', themeErrors))
  optionalBoolean(props, 'autoTextContrast', 'theme', themeErrors)
  optionalNumber(props, 'radius', 0, 32, 'theme', themeErrors)
  optionalEnum(props, 'spacing', ['compact', 'normal', 'relaxed'], 'theme', themeErrors)
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
    if (typeof props.pageMaxWidth !== 'string'
      || (props.pageMaxWidth.trim() && props.pageMaxWidth.trim() !== 'none' && !/^\d+(?:\.\d+)?(?:px|%)$/.test(props.pageMaxWidth.trim()))) {
      themeErrors.push('theme: pageMaxWidth 仅支持 none / 100% / 1200px 这类格式', 'pageMaxWidth')
    }
  }
  if (props.pageBackgroundType === 'image' && props.pageBackgroundImageFile === undefined) {
    themeErrors.push('theme: pageBackgroundType=image 时必须提供 pageBackgroundImageFile', 'pageBackgroundImageFile')
  }
}
