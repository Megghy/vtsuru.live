import { asObject, optionalBoolean, optionalEnum, optionalFile, optionalNumber, optionalString } from './validationUtils'

export function validateBlockPageTheme(theme: unknown, errors: string[]) {
  if (theme === undefined || theme === null) return
  const props = asObject(theme)
  if (!props) {
    errors.push('theme 必须是 object')
    return
  }

  ;['primaryColor', 'backgroundColor', 'textColor', 'pageBackgroundColor'].forEach(key => optionalString(props, key, 'theme', errors))
  optionalNumber(props, 'radius', 0, 32, 'theme', errors)
  optionalEnum(props, 'spacing', ['compact', 'normal', 'relaxed'], 'theme', errors)
  optionalEnum(props, 'pageThemeMode', ['auto', 'light', 'dark'], 'theme', errors)
  optionalEnum(props, 'pageBackgroundType', ['none', 'color', 'image'], 'theme', errors)
  optionalEnum(props, 'pageBackgroundImageFit', ['cover', 'contain', 'fill', 'none'], 'theme', errors)
  optionalBoolean(props, 'pageBackgroundCoverSidebar', 'theme', errors)
  optionalEnum(props, 'pageBackgroundBlurMode', ['none', 'background', 'glass'], 'theme', errors)
  optionalNumber(props, 'pageBackgroundBlur', 0, 40, 'theme', errors)
  optionalEnum(props, 'pageBackgroundScrimMode', ['auto', 'black', 'white'], 'theme', errors)
  optionalNumber(props, 'pageBackgroundScrimStrength', 0, 100, 'theme', errors)
  optionalFile(props, 'pageBackgroundImageFile', 'theme', errors)

  if (props.pageMaxWidth !== undefined) {
    if (typeof props.pageMaxWidth !== 'string'
      || (props.pageMaxWidth.trim() && props.pageMaxWidth.trim() !== 'none' && !/^\d+(?:\.\d+)?(?:px|%)$/.test(props.pageMaxWidth.trim()))) {
      errors.push('theme: pageMaxWidth 仅支持 none / 100% / 1200px 这类格式')
    }
  }
  if (props.pageBackgroundType === 'image' && props.pageBackgroundImageFile === undefined) {
    errors.push('theme: pageBackgroundType=image 时必须提供 pageBackgroundImageFile')
  }
}
