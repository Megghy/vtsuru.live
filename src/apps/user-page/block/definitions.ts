import { USER_FEATURE_KEYS } from '../featureNavigation'
import {
  CUSTOM_CSS_MAX_BYTES,
  CUSTOM_HTML_ASSET_KEY_PATTERN,
  CUSTOM_HTML_MAX_ASSETS,
  CUSTOM_HTML_MAX_BYTES,
  CUSTOM_HTML_MAX_HEIGHT,
  CUSTOM_HTML_MIN_AUTO_HEIGHT,
  CUSTOM_HTML_MIN_HEIGHT,
  DEFAULT_CUSTOM_HTML_PROPS,
  utf8ByteLength,
} from './customHtmlContract'
import { parseEmbedUrl, parseFeedbackEmbedUrl, parseMusicEmbedUrl } from './embed'
import { getBlockPropertyNumberRange, getBlockPropertyValues, isBlockPropertyAvailable } from './propertyCapabilities'
import { hasQrCodeCapacity, QR_CODE_LEVELS } from './qrcode'
import { BLOCK_TYPES } from './schemaTypes'
import type { BlockType } from './schemaTypes'
import { SOCIAL_PLATFORM_IDS } from './socialPlatforms'
import {
  isHttpsUrl,
  isNonEmptyString,
  optionalBoolean,
  optionalCssSize,
  optionalEnum,
  optionalFile,
  optionalHttpsUrl,
  optionalNumber,
  optionalString,
  requiredString,
  validateItems,
  validateLinkTarget,
  validationFieldPath,
} from './validationUtils'
import type { PropsObject, ValidationErrors } from './validationUtils'

export type BlockCategory = 'basic' | 'content' | 'media' | 'data' | 'interaction' | 'layout'

export interface BlockValidationContext {
  hidden: boolean
}

export interface SharedBlockDefinition {
  type: BlockType
  label: string
  category: BlockCategory
  keywords: readonly string[]
  defaultProps: Readonly<PropsObject>
  requiresProps?: boolean
  validate: (props: PropsObject | null, path: string, errors: ValidationErrors, context: BlockValidationContext) => void
}

type Validator = SharedBlockDefinition['validate']

function withProps(
  validate: (props: PropsObject, path: string, errors: ValidationErrors, context: BlockValidationContext) => void,
): Validator {
  return (props, path, errors, context) => {
    if (props) validate(props, path, errors, context)
  }
}

function strings(keys: string[]): Validator {
  return withProps((props, path, errors) => keys.forEach((key) => optionalString(props, key, path, errors)))
}

function booleans(props: PropsObject, keys: string[], path: string, errors: ValidationErrors) {
  keys.forEach((key) => optionalBoolean(props, key, path, errors))
}

const validateLayout = withProps((props, path, errors) => {
  optionalEnum(props, 'layout', ['row', 'column', 'grid'], path, errors)
  optionalNumber(props, 'gap', 0, 80, path, errors)
  if (isBlockPropertyAvailable('layout', props, 'columns')) optionalNumber(props, 'columns', 1, 12, path, errors, true)
  if (isBlockPropertyAvailable('layout', props, 'wrap')) optionalBoolean(props, 'wrap', path, errors)
  optionalCssSize(props, 'maxWidth', path, errors)
  optionalEnum(
    props,
    'justify',
    getBlockPropertyValues('layout', props, 'justify') ?? ['start', 'center', 'end', 'between', 'around', 'evenly'],
    path,
    errors,
  )
  optionalEnum(props, 'align', ['start', 'center', 'end', 'stretch'], path, errors)
  if (props.layout === 'grid' && props.columns === undefined)
    errors.push(`${path}: grid 模式必须提供 columns`, 'columns')
  if (!Array.isArray(props.children)) errors.push(`${path}: children 必须是 array`, 'children')
})

const validateProfile = withProps((props, path, errors) => {
  optionalFile(props, 'avatarFile', path, errors)
  optionalString(props, 'displayName', path, errors)
  optionalString(props, 'bio', path, errors)
})

const validateRichText = withProps((props, path, errors) => {
  if (typeof props.html !== 'string') errors.push(`${path}: html 必须是 string`, 'html')
  else if (props.html.length > 10000) errors.push(`${path}: html 过长（最多 10000 字符）`, 'html')
  if (props.imagesFile !== undefined) {
    if (!Array.isArray(props.imagesFile)) errors.push(`${path}: imagesFile 必须是 array`, 'imagesFile')
    else
      props.imagesFile.forEach((file, index) => optionalFile({ file }, 'file', `${path}: imagesFile[${index}]`, errors))
  }
})

const validateCustomHtml = withProps((props, path, errors) => {
  if (typeof props.html !== 'string') errors.push(`${path}: html 必须是 string`, 'html')
  else if (utf8ByteLength(props.html) > CUSTOM_HTML_MAX_BYTES) errors.push(`${path}: html 不能超过 32 KiB`, 'html')
  if (typeof props.css !== 'string') errors.push(`${path}: css 必须是 string`, 'css')
  else if (utf8ByteLength(props.css) > CUSTOM_CSS_MAX_BYTES) errors.push(`${path}: css 不能超过 24 KiB`, 'css')
  optionalEnum(props, 'heightMode', ['auto', 'fixed'], path, errors)
  optionalNumber(props, 'height', CUSTOM_HTML_MIN_HEIGHT, CUSTOM_HTML_MAX_HEIGHT, path, errors, true)
  optionalNumber(props, 'maxHeight', CUSTOM_HTML_MIN_AUTO_HEIGHT, CUSTOM_HTML_MAX_HEIGHT, path, errors, true)
  booleans(props, ['framed', 'backgrounded'], path, errors)

  if (!Array.isArray(props.assets)) {
    errors.push(`${path}: assets 必须是 array`, 'assets')
    return
  }
  if (props.assets.length > CUSTOM_HTML_MAX_ASSETS)
    errors.push(`${path}: assets 不能超过 ${CUSTOM_HTML_MAX_ASSETS} 项`, 'assets')
  const keys = new Set<string>()
  validateItems(props, path, errors, (item, itemPath) => {
    requiredString(item, 'key', itemPath, errors)
    if (typeof item.key === 'string' && !CUSTOM_HTML_ASSET_KEY_PATTERN.test(item.key)) {
      errors.push(`${itemPath}: key 只能使用小写字母、数字和连字符`, validationFieldPath(itemPath, 'key'))
    }
    if (typeof item.key === 'string' && keys.has(item.key))
      errors.push(`${itemPath}: key 不能重复`, validationFieldPath(itemPath, 'key'))
    if (typeof item.key === 'string') keys.add(item.key)
    optionalFile(item, 'file', itemPath, errors)
    if (item.file === undefined) errors.push(`${itemPath}: file 必须提供`, validationFieldPath(itemPath, 'file'))
  })
})

const validateLinks = withProps((props, path, errors) =>
  validateItems(
    props,
    path,
    errors,
    (item, itemPath) => {
      requiredString(item, 'label', itemPath, errors)
      if (!isHttpsUrl(item.url)) errors.push(`${itemPath}: url 必须是 https URL`, validationFieldPath(itemPath, 'url'))
    },
    true,
  ),
)

function validateButtonAppearance(
  type: 'button' | 'buttons',
  props: PropsObject,
  path: string,
  errors: ValidationErrors,
) {
  optionalEnum(props, 'type', ['default', 'primary', 'info', 'success', 'warning', 'error'], path, errors)
  optionalEnum(props, 'variant', ['solid', 'secondary', 'tertiary', 'quaternary', 'ghost'], path, errors)
  if (isBlockPropertyAvailable(type, props, 'fullWidth')) optionalBoolean(props, 'fullWidth', path, errors)
  if (isBlockPropertyAvailable(type, props, 'align'))
    optionalEnum(props, 'align', ['start', 'center', 'end'], path, errors)
  optionalEnum(props, 'size', ['sm', 'md', 'lg'], path, errors)
  optionalEnum(props, 'radius', ['default', 'pill', 'sharp', 'custom'], path, errors)
  if (props.radius === 'custom') optionalNumber(props, 'radiusPx', 0, 48, path, errors)
  optionalNumber(props, 'borderWidth', 0, 8, path, errors)
  optionalNumber(props, 'opacity', 0.15, 1, path, errors)
  for (const key of ['borderColor', 'color', 'textColor'] as const) {
    const value = props[key]
    if (value === undefined || value === null) continue
    if (typeof value !== 'string') errors.push(`${path}: ${key} 必须是 string`, key)
    else if (!/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value.trim()))
      errors.push(`${path}: ${key} 必须是十六进制颜色`, key)
  }
  optionalEnum(props, 'effect', ['none', 'pulse', 'breathe', 'bounce', 'wiggle', 'glow', 'rainbow'], path, errors)
  optionalEnum(props, 'effectIntensity', ['low', 'mid', 'high'], path, errors)
}

const validateButton = withProps((props, path, errors, context) => {
  if (!context.hidden) requiredString(props, 'label', path, errors)
  validateLinkTarget(props, path, errors)
  validateButtonAppearance('button', props, path, errors)
})

const validateButtons = withProps((props, path, errors, context) => {
  validateItems(
    props,
    path,
    errors,
    (item, itemPath) => {
      if (!context.hidden) requiredString(item, 'label', itemPath, errors)
      validateLinkTarget(item, itemPath, errors)
    },
    true,
  )
  optionalEnum(props, 'direction', ['vertical', 'horizontal'], path, errors)
  validateButtonAppearance('buttons', props, path, errors)
  optionalNumber(props, 'gap', 0, 32, path, errors)
  if (isBlockPropertyAvailable('buttons', props, 'borderTitle')) optionalString(props, 'borderTitle', path, errors)
  if (isBlockPropertyAvailable('buttons', props, 'borderTitleAlign'))
    optionalEnum(props, 'borderTitleAlign', ['left', 'center', 'right'], path, errors)
})

const validateImage = withProps((props, path, errors, context) => {
  optionalFile(props, 'imageFile', path, errors)
  if (!context.hidden && props.imageFile === undefined) errors.push(`${path}: imageFile 必须提供`, 'imageFile')
  optionalString(props, 'alt', path, errors)
  optionalEnum(props, 'shape', ['rounded', 'square', 'circle'], path, errors)
  optionalCssSize(props, 'maxWidth', path, errors)
  optionalCssSize(props, 'maxHeight', path, errors)
})

const validateGallery = withProps((props, path, errors) => {
  optionalEnum(props, 'layout', ['grid', 'masonry', 'carousel'], path, errors)
  if (props.layout !== 'carousel' && props.columns === undefined)
    errors.push(`${path}: 非 carousel 模式必须提供 columns`, 'columns')
  if (isBlockPropertyAvailable('imageGallery', props, 'columns'))
    optionalNumber(props, 'columns', 1, 12, path, errors, true)
  if (isBlockPropertyAvailable('imageGallery', props, 'gap')) optionalNumber(props, 'gap', 0, 80, path, errors)
  optionalCssSize(props, 'maxWidth', path, errors)
  if (isBlockPropertyAvailable('imageGallery', props, 'maxHeight')) optionalCssSize(props, 'maxHeight', path, errors)
  if (isBlockPropertyAvailable('imageGallery', props, 'fit'))
    optionalEnum(props, 'fit', ['cover', 'contain'], path, errors)
  for (const key of ['autoplay', 'showArrow', 'showDots', 'loop', 'draggable', 'touchable']) {
    if (isBlockPropertyAvailable('imageGallery', props, key)) optionalBoolean(props, key, path, errors)
  }
  if (isBlockPropertyAvailable('imageGallery', props, 'interval'))
    optionalNumber(props, 'interval', 1000, 60000, path, errors)
  if (isBlockPropertyAvailable('imageGallery', props, 'effect'))
    optionalEnum(props, 'effect', ['slide', 'fade', 'card', 'custom'], path, errors)
  if (isBlockPropertyAvailable('imageGallery', props, 'dotType'))
    optionalEnum(props, 'dotType', ['dot', 'line'], path, errors)
  if (isBlockPropertyAvailable('imageGallery', props, 'dotPlacement'))
    optionalEnum(props, 'dotPlacement', ['top', 'bottom', 'left', 'right'], path, errors)
  if (isBlockPropertyAvailable('imageGallery', props, 'trigger'))
    optionalEnum(props, 'trigger', ['hover', 'click'], path, errors)
  validateItems(
    props,
    path,
    errors,
    (item, itemPath) => {
      optionalFile(item, 'imageFile', itemPath, errors)
      if (isNonEmptyString(item.url) && !isHttpsUrl(item.url))
        errors.push(`${itemPath}: url 必须是 https URL`, validationFieldPath(itemPath, 'url'))
      if (item.imageFile === undefined && !isNonEmptyString(item.url))
        errors.push(`${itemPath}: url 或 imageFile 必须提供一个`, validationFieldPath(itemPath, 'url'))
      optionalString(item, 'desc', itemPath, errors)
      optionalString(item, 'alt', itemPath, errors)
    },
    true,
  )
})

const validateQrCode = withProps((props, path, errors, context) => {
  if (!context.hidden) requiredString(props, 'content', path, errors)
  else optionalString(props, 'content', path, errors)
  optionalString(props, 'title', path, errors)
  optionalNumber(props, 'size', 128, 512, path, errors, true)
  optionalNumber(props, 'margin', 0, 32, path, errors, true)
  optionalEnum(props, 'level', QR_CODE_LEVELS, path, errors)

  for (const key of ['foreground', 'background']) {
    const value = props[key]
    if (value !== undefined && (typeof value !== 'string' || !/^#[\da-f]{6}$/i.test(value))) {
      errors.push(`${path}: ${key} 必须是六位十六进制颜色`, key)
    }
  }

  if (isNonEmptyString(props.content)) {
    const level = QR_CODE_LEVELS.find((item) => item === props.level) ?? 'M'
    if (!hasQrCodeCapacity(props.content, level)) {
      errors.push(`${path}: content 超出当前纠错等级的容量`, 'content')
    }
  }
})

const validateFeatureNav = withProps((props, path, errors) => {
  const keys = new Set<string>()
  validateItems(
    props,
    path,
    errors,
    (item, itemPath) => {
      optionalEnum(item, 'key', USER_FEATURE_KEYS, itemPath, errors)
      optionalBoolean(item, 'hidden', itemPath, errors)
      if (typeof item.key === 'string') {
        if (keys.has(item.key)) errors.push(`${itemPath}: key 不能重复`, validationFieldPath(itemPath, 'key'))
        keys.add(item.key)
      }
    },
    true,
  )
})

function validateCardAction(value: unknown, key: string, itemPath: string, errors: ValidationErrors) {
  if (value === undefined) return
  const action = value && typeof value === 'object' && !Array.isArray(value) ? (value as PropsObject) : null
  if (!action) {
    errors.push(`${itemPath}: ${key} 必须是 object`, validationFieldPath(itemPath, key))
    return
  }
  const prefix = validationFieldPath(itemPath, key)
  const actionErrors: ValidationErrors = {
    push(message, fieldPath) {
      const field = fieldPath?.replace(new RegExp(`^${key}\\.`), '')
      errors.push(message, field ? `${prefix}.${field}` : prefix)
    },
  }
  optionalString(action, 'label', `${itemPath}: ${key}`, actionErrors)
  if (isNonEmptyString(action.label)) validateLinkTarget(action, `${itemPath}: ${key}`, actionErrors)
}

const validateCardList = withProps((props, path, errors) => {
  optionalEnum(props, 'layout', ['grid', 'list'], path, errors)
  if (isBlockPropertyAvailable('cardList', props, 'columns')) optionalNumber(props, 'columns', 1, 4, path, errors, true)
  validateItems(
    props,
    path,
    errors,
    (item, itemPath) => {
      optionalFile(item, 'imageFile', itemPath, errors)
      optionalString(item, 'title', itemPath, errors)
      optionalString(item, 'body', itemPath, errors)
      if (item.tags !== undefined && (!Array.isArray(item.tags) || item.tags.some((tag) => typeof tag !== 'string'))) {
        errors.push(`${itemPath}: tags 必须是 string[]`, validationFieldPath(itemPath, 'tags'))
      }
      validateCardAction(item.primaryAction, 'primaryAction', itemPath, errors)
      validateCardAction(item.secondaryAction, 'secondaryAction', itemPath, errors)
    },
    true,
  )
})

const validateSectionNav = withProps((props, path, errors) => {
  optionalEnum(props, 'layout', ['horizontal', 'vertical'], path, errors)
  optionalBoolean(props, 'showNumbers', path, errors)
  if (props.levels === undefined) return
  if (
    !Array.isArray(props.levels) ||
    !props.levels.length ||
    props.levels.some((level) => ![1, 2, 3].includes(Number(level)))
  ) {
    errors.push(`${path}: levels 必须是由 1、2、3 组成的非空数组`, 'levels')
  } else if (new Set(props.levels).size !== props.levels.length) {
    errors.push(`${path}: levels 不能重复`, 'levels')
  }
})

const validateEmbed = withProps((props, path, errors, context) => {
  optionalString(props, 'title', path, errors)
  if (context.hidden && !isNonEmptyString(props.url)) return
  try {
    parseEmbedUrl(String(props.url ?? ''), typeof props.title === 'string' ? props.title : undefined)
  } catch (error) {
    errors.push(`${path}: ${(error as Error).message}`, 'url')
  }
})

const validateVideoList = withProps((props, path, errors) => {
  optionalEnum(props, 'source', ['manual', 'userIndex'], path, errors)
  if (isBlockPropertyAvailable('videoList', props, 'layout'))
    optionalEnum(props, 'layout', ['grid', 'row'], path, errors)
  if (isBlockPropertyAvailable('videoList', props, 'columns'))
    optionalNumber(props, 'columns', 1, 6, path, errors, true)
  optionalNumber(props, 'maxItems', 1, 50, path, errors, true)
  optionalBoolean(props, 'showTitle', path, errors)
  if (isBlockPropertyAvailable('videoList', props, 'title')) optionalString(props, 'title', path, errors)
  if (isBlockPropertyAvailable('videoList', props, 'items')) {
    validateItems(props, path, errors, (item, itemPath) => {
      optionalHttpsUrl(item, 'url', itemPath, errors)
      optionalString(item, 'title', itemPath, errors)
    })
  }
})

const validateSocialLinks = withProps((props, path, errors) => {
  optionalEnum(props, 'size', ['sm', 'md', 'lg'], path, errors)
  optionalEnum(props, 'variant', ['round', 'square'], path, errors)
  optionalBoolean(props, 'showLabel', path, errors)
  validateItems(props, path, errors, (item, itemPath) => {
    if (!isHttpsUrl(item.url)) errors.push(`${itemPath}: url 必须是 https URL`, validationFieldPath(itemPath, 'url'))
    optionalEnum(item, 'platform', SOCIAL_PLATFORM_IDS, itemPath, errors)
    optionalString(item, 'label', itemPath, errors)
  })
})

const validateMusic = withProps((props, path, errors, context) => {
  optionalEnum(props, 'provider', ['netease', 'spotify', 'custom'], path, errors)
  const heightRange = getBlockPropertyNumberRange('musicPlayer', props, 'height')
  if (isBlockPropertyAvailable('musicPlayer', props, 'height') && heightRange)
    optionalNumber(props, 'height', heightRange.min, heightRange.max, path, errors)
  optionalBoolean(props, 'compact', path, errors)
  if (context.hidden && !isNonEmptyString(props.url)) return
  try {
    parseMusicEmbedUrl(
      (props.provider ?? 'netease') as 'netease' | 'spotify' | 'custom',
      String(props.url ?? ''),
      Number(props.height) || 300,
    )
  } catch (error) {
    errors.push(`${path}: ${(error as Error).message}`, 'url')
  }
})

const validateTextItems = (fields: string[]): Validator =>
  withProps((props, path, errors) =>
    validateItems(props, path, errors, (item, itemPath) => {
      fields.forEach((field) => optionalString(item, field, itemPath, errors))
    }),
  )

const validateFeedback = withProps((props, path, errors, context) => {
  ;['title', 'description', 'url', 'buttonText'].forEach((key) => {
    if (isBlockPropertyAvailable('feedback', props, key)) optionalString(props, key, path, errors)
  })
  if (isBlockPropertyAvailable('feedback', props, 'embedMode'))
    optionalEnum(props, 'embedMode', ['questionBox', 'iframe'], path, errors)
  optionalBoolean(props, 'embed', path, errors)
  if (isBlockPropertyAvailable('feedback', props, 'height')) optionalNumber(props, 'height', 200, 1200, path, errors)
  if (isBlockPropertyAvailable('feedback', props, 'url') && isNonEmptyString(props.url) && !isHttpsUrl(props.url))
    errors.push(`${path}: url 必须是 https URL`, 'url')
  if (props.embed === true && props.embedMode === 'iframe' && !(context.hidden && !isNonEmptyString(props.url))) {
    try {
      parseFeedbackEmbedUrl(String(props.url ?? ''))
    } catch (error) {
      errors.push(`${path}: ${(error as Error).message}`, 'url')
    }
  }
})

const validateSupporter = withProps((props, path, errors) => {
  optionalString(props, 'title', path, errors)
  optionalString(props, 'description', path, errors)
  validateItems(props, path, errors, (item, itemPath) => {
    optionalEnum(item, 'platform', ['afdian', 'kofi', 'patreon', 'paypal', 'other'], itemPath, errors)
    if (!isHttpsUrl(item.url)) errors.push(`${itemPath}: url 必须是 https URL`, validationFieldPath(itemPath, 'url'))
    optionalString(item, 'label', itemPath, errors)
  })
})

const definition = (
  type: BlockType,
  label: string,
  category: BlockCategory,
  keywords: string[],
  defaultProps: PropsObject,
  validate: Validator = () => {},
  requiresProps = false,
): SharedBlockDefinition => ({ type, label, category, keywords, defaultProps, validate, requiresProps })

export const SHARED_BLOCK_DEFINITIONS = [
  definition('profile', '个人信息', 'basic', ['头像', '简介'], {}, validateProfile),
  definition(
    'layout',
    '布局容器',
    'layout',
    ['分组', '网格', '排列'],
    { layout: 'row', wrap: true, gap: 12, maxWidth: '', columns: 2, justify: 'start', align: 'stretch', children: [] },
    validateLayout,
    true,
  ),
  definition(
    'heading',
    '标题',
    'basic',
    ['标题', 'heading'],
    { text: '标题', level: 2, textEffect: 'none', effectIntensity: 'mid' },
    withProps((p, path, errors, context) => {
      if (!context.hidden) requiredString(p, 'text', path, errors)
      optionalEnum(p, 'level', [1, 2, 3], path, errors)
      optionalEnum(p, 'textEffect', ['none', 'gradient', 'glow', 'shine', 'breathe', 'rainbow', 'typewriter'], path, errors)
      optionalEnum(p, 'effectIntensity', ['low', 'mid', 'high'], path, errors)
    }),
    true,
  ),
  definition(
    'text',
    '文本',
    'basic',
    ['文字', '段落'],
    { text: '', textEffect: 'none', effectIntensity: 'mid' },
    withProps((p, path, errors) => {
      if (typeof p.text !== 'string') errors.push(`${path}: text 必须是 string`, 'text')
      optionalEnum(p, 'textEffect', ['none', 'gradient', 'glow', 'shine', 'breathe', 'rainbow', 'typewriter'], path, errors)
      optionalEnum(p, 'effectIntensity', ['low', 'mid', 'high'], path, errors)
    }),
    true,
  ),
  definition(
    'richText',
    '富文本',
    'content',
    ['HTML', '格式化'],
    { html: '', imagesFile: [], framed: false, backgrounded: false },
    validateRichText,
    true,
  ),
  definition(
    'customHtml',
    '自定义 HTML/CSS',
    'content',
    ['代码', 'HTML', 'CSS', '组件'],
    DEFAULT_CUSTOM_HTML_PROPS,
    validateCustomHtml,
    true,
  ),
  definition(
    'alert',
    '提示框',
    'content',
    ['通知', '警告'],
    { type: 'info', title: '提示', text: '这里是一段提示内容', showIcon: true, bordered: false },
    withProps((p, path, errors) => {
      optionalEnum(p, 'type', ['default', 'info', 'success', 'warning', 'error'], path, errors)
      optionalString(p, 'title', path, errors)
      optionalString(p, 'text', path, errors)
      booleans(p, ['showIcon', 'bordered'], path, errors)
    }),
    true,
  ),
  definition('links', '链接列表', 'interaction', ['网址', '导航'], { items: [] }, validateLinks, true),
  definition(
    'button',
    '按钮',
    'interaction',
    ['链接', '跳转'],
    {
      label: '按钮',
      page: 'home',
      type: 'default',
      variant: 'solid',
      fullWidth: false,
      align: 'start',
      size: 'md',
      radius: 'default',
      radiusPx: 12,
      borderWidth: 0,
      opacity: 1,
      effect: 'none',
      effectIntensity: 'mid',
      framed: false,
      backgrounded: false,
    },
    validateButton,
    true,
  ),
  definition(
    'buttons',
    '按钮组',
    'interaction',
    ['链接', '导航'],
    {
      items: [],
      direction: 'vertical',
      type: 'default',
      variant: 'solid',
      gap: 10,
      fullWidth: false,
      align: 'start',
      size: 'md',
      radius: 'default',
      radiusPx: 12,
      borderWidth: 0,
      opacity: 1,
      effect: 'none',
      effectIntensity: 'mid',
      framed: false,
      backgrounded: false,
    },
    validateButtons,
    true,
  ),
  definition(
    'image',
    '图片',
    'media',
    ['照片', '封面'],
    { alt: '', maxWidth: '', maxHeight: '', shape: 'rounded' },
    validateImage,
    true,
  ),
  definition(
    'imageGallery',
    '图片组',
    'media',
    ['相册', '轮播', '画廊'],
    {
      layout: 'grid',
      columns: 3,
      gap: 12,
      maxWidth: '',
      maxHeight: '',
      fit: 'cover',
      items: [],
      framed: false,
      backgrounded: false,
    },
    validateGallery,
    true,
  ),
  definition(
    'qrcode',
    '二维码',
    'media',
    ['扫码', '链接', '下载'],
    {
      content: 'https://vtsuru.suki.club',
      title: '',
      size: 256,
      foreground: '#000000',
      background: '#ffffff',
      level: 'M',
      margin: 8,
    },
    validateQrCode,
    true,
  ),
  definition(
    'featureNav',
    '功能入口',
    'interaction',
    ['歌单', '提问箱', '签到', '积分', '论坛', '日程'],
    { items: USER_FEATURE_KEYS.map((key) => ({ key })) },
    validateFeatureNav,
    true,
  ),
  definition(
    'songList',
    '歌单与点歌',
    'data',
    ['歌曲', '点歌', '搜索'],
    { variant: 'compact', maxItems: 6, showSearch: true, showRequestStatus: true },
    withProps((p, path, errors) => {
      optionalEnum(p, 'variant', ['compact', 'full'], path, errors)
      optionalNumber(p, 'maxItems', 3, 30, path, errors, true)
      booleans(p, ['showSearch', 'showRequestStatus'], path, errors)
    }),
  ),
  definition(
    'cardList',
    '图文卡片列表',
    'content',
    ['作品集', '委托', '服务', '周边', '合作'],
    { layout: 'grid', columns: 3, items: [] },
    validateCardList,
    true,
  ),
  definition(
    'checkInRanking',
    '紧凑签到榜',
    'data',
    ['签到', '排行', '连续签到'],
    { count: 3, showMonthly: true, showTotal: false },
    withProps((p, path, errors) => {
      optionalEnum(p, 'count', [3, 10], path, errors)
      booleans(p, ['showMonthly', 'showTotal'], path, errors)
    }),
  ),
  definition(
    'featuredGoods',
    '精选积分礼物',
    'data',
    ['积分', '兑换', '商品', '周边'],
    { count: 3, selection: 'pinned', goodsIds: [], showDescription: true, showStock: true },
    withProps((p, path, errors) => {
      optionalEnum(p, 'count', [3, 4, 5, 6], path, errors)
      optionalEnum(p, 'selection', ['pinned', 'available'], path, errors)
      const goodsIds = p.goodsIds
      if (
        goodsIds !== undefined &&
        (!Array.isArray(goodsIds) ||
          goodsIds.length > 6 ||
          goodsIds.some((id) => !Number.isInteger(id) || id <= 0) ||
          new Set(goodsIds).size !== goodsIds.length)
      ) {
        errors.push(`${path}: goodsIds 必须是最多 6 项且不重复的正整数数组`, validationFieldPath(path, 'goodsIds'))
      }
      booleans(p, ['showDescription', 'showStock'], path, errors)
    }),
  ),
  definition(
    'videoCollect',
    '当前视频征集',
    'data',
    ['视频', '征集', '投稿', '活动'],
    { count: 3, showDescription: true, showProgress: true },
    withProps((p, path, errors) => {
      optionalNumber(p, 'count', 1, 6, path, errors, true)
      booleans(p, ['showDescription', 'showProgress'], path, errors)
    }),
  ),
  definition(
    'sectionNav',
    '自动页面目录',
    'interaction',
    ['目录', '锚点', '章节', '导航'],
    { layout: 'horizontal', levels: [2, 3], showNumbers: false },
    validateSectionNav,
    true,
  ),
  definition(
    'nowPlaying',
    '当前播放与点歌队列',
    'data',
    ['当前歌曲', '正在演唱', '点歌', '队列'],
    { showRequester: true },
    withProps((p, path, errors) => optionalBoolean(p, 'showRequester', path, errors)),
  ),
  definition('embed', '嵌入视频', 'media', ['B站', 'YouTube', '视频'], { url: '', title: '' }, validateEmbed, true),
  definition(
    'divider',
    '分割线',
    'layout',
    ['间隔', '分隔'],
    { text: '', titlePlacement: 'center', marginTop: 12, marginBottom: 12 },
    withProps((p, path, errors) => {
      optionalString(p, 'text', path, errors)
      if (isBlockPropertyAvailable('divider', p, 'titlePlacement'))
        optionalEnum(p, 'titlePlacement', ['left', 'center', 'right'], path, errors)
      optionalNumber(p, 'marginTop', 0, 80, path, errors)
      optionalNumber(p, 'marginBottom', 0, 80, path, errors)
    }),
  ),
  definition(
    'spacer',
    '间距',
    'layout',
    ['空白', '留白'],
    { size: 'md' },
    withProps((p, path, errors) => optionalEnum(p, 'size', ['sm', 'md', 'lg'], path, errors)),
  ),
  definition(
    'footer',
    '页脚',
    'layout',
    ['底部', '版权'],
    { text: '', framed: false, backgrounded: false },
    strings(['text']),
  ),
  definition(
    'liveStatus',
    '直播状态',
    'data',
    ['开播', '直播间'],
    { variant: 'card', showTitle: true, showArea: true, showCover: true, showButtons: true },
    withProps((p, path, errors) => {
      optionalEnum(p, 'variant', ['card', 'compact'], path, errors)
      booleans(p, ['showTitle', 'showArea', 'showCover', 'showButtons'], path, errors)
    }),
  ),
  definition(
    'streamSchedule',
    '直播日程',
    'data',
    ['日历', '排期'],
    { layout: 'list', weeksCount: 1, showIcs: true, highlightToday: true, showTag: true },
    withProps((p, path, errors) => {
      optionalEnum(p, 'layout', ['list', 'table'], path, errors)
      optionalNumber(p, 'weeksCount', 1, 8, path, errors, true)
      booleans(p, ['showIcs', 'highlightToday', 'showTag'], path, errors)
    }),
  ),
  definition(
    'biliInfo',
    'B站数据卡片',
    'data',
    ['哔哩哔哩', '粉丝'],
    {
      variant: 'card',
      showAvatar: true,
      showName: true,
      showSign: true,
      showStats: true,
      showButtons: true,
      showLiveRoom: true,
      spaceUrl: '',
    },
    withProps((p, path, errors) => {
      optionalEnum(p, 'variant', ['card', 'compact'], path, errors)
      booleans(p, ['showAvatar', 'showName', 'showSign', 'showStats', 'showButtons'], path, errors)
      if (isBlockPropertyAvailable('biliInfo', p, 'showLiveRoom')) optionalBoolean(p, 'showLiveRoom', path, errors)
      if (isBlockPropertyAvailable('biliInfo', p, 'spaceUrl')) optionalHttpsUrl(p, 'spaceUrl', path, errors)
    }),
  ),
  definition(
    'videoList',
    '视频列表',
    'data',
    ['投稿', '视频'],
    { source: 'manual', maxItems: 6, showTitle: true, items: [] },
    validateVideoList,
  ),
  definition(
    'socialLinks',
    '社交图标组',
    'interaction',
    ['社交', '平台'],
    { size: 'md', variant: 'round', showLabel: false, items: [] },
    validateSocialLinks,
  ),
  definition(
    'musicPlayer',
    '音乐播放器',
    'media',
    ['网易云', 'Spotify', '音乐'],
    { provider: 'netease', url: '', height: 300, compact: false },
    validateMusic,
  ),
  definition(
    'tags',
    '标签组',
    'content',
    ['标签', '关键词'],
    { size: 'medium', rounded: true, items: [], framed: false, backgrounded: false },
    withProps((p, path, errors) => {
      optionalEnum(p, 'size', ['small', 'medium'], path, errors)
      optionalBoolean(p, 'rounded', path, errors)
      if (isBlockPropertyAvailable('tags', p, 'borderTitle')) optionalString(p, 'borderTitle', path, errors)
      if (isBlockPropertyAvailable('tags', p, 'borderTitleAlign'))
        optionalEnum(p, 'borderTitleAlign', ['left', 'center', 'right'], path, errors)
      validateItems(p, path, errors, (item, itemPath) => {
        optionalString(item, 'text', itemPath, errors)
        optionalString(item, 'color', itemPath, errors)
        optionalEnum(item, 'type', ['default', 'info', 'success', 'warning', 'error'], itemPath, errors)
      })
    }),
  ),
  definition(
    'milestone',
    '里程碑/时间轴',
    'content',
    ['时间线', '经历'],
    { title: '里程碑', mode: 'timeline', items: [] },
    withProps((p, path, errors) => {
      optionalString(p, 'title', path, errors)
      optionalEnum(p, 'mode', ['timeline', 'list'], path, errors)
      validateTextItems(['date', 'title', 'description'])(p, path, errors, { hidden: false })
    }),
  ),
  definition(
    'faq',
    '折叠问答',
    'content',
    ['常见问题', '问答'],
    { accordion: false, items: [] },
    withProps((p, path, errors) => {
      optionalBoolean(p, 'accordion', path, errors)
      validateTextItems(['q', 'a'])(p, path, errors, { hidden: false })
    }),
  ),
  definition(
    'quote',
    '金句引用',
    'content',
    ['引用', '语录'],
    { text: '', author: '', align: 'center', textEffect: 'none', effectIntensity: 'mid' },
    withProps((p, path, errors) => {
      optionalString(p, 'text', path, errors)
      optionalString(p, 'author', path, errors)
      optionalEnum(p, 'align', ['left', 'center', 'right'], path, errors)
      optionalEnum(p, 'textEffect', ['none', 'gradient', 'glow', 'shine', 'breathe', 'rainbow', 'typewriter'], path, errors)
      optionalEnum(p, 'effectIntensity', ['low', 'mid', 'high'], path, errors)
    }),
  ),
  definition(
    'marquee',
    '走马灯/公告',
    'content',
    ['滚动', '公告'],
    { text: '', direction: 'left', durationSec: 18, pauseOnHover: true, framed: false, backgrounded: false },
    withProps((p, path, errors) => {
      optionalString(p, 'text', path, errors)
      optionalEnum(p, 'direction', ['left', 'right', 'up', 'down'], path, errors)
      optionalNumber(p, 'durationSec', 4, 120, path, errors)
      optionalBoolean(p, 'pauseOnHover', path, errors)
    }),
  ),
  definition(
    'countdown',
    '倒计时',
    'content',
    ['计时', '日期'],
    {
      title: '',
      target: '',
      style: 'cards',
      showSeconds: true,
      doneText: '已到达',
      framed: false,
      backgrounded: false,
    },
    withProps((p, path, errors) => {
      optionalString(p, 'title', path, errors)
      optionalString(p, 'target', path, errors)
      optionalEnum(p, 'style', ['cards', 'inline'], path, errors)
      optionalBoolean(p, 'showSeconds', path, errors)
      optionalString(p, 'doneText', path, errors)
    }),
  ),
  definition(
    'feedback',
    '表单/留言',
    'interaction',
    ['提问箱', '表单'],
    {
      title: '留言 / 提问',
      description: '',
      url: '',
      buttonText: '打开',
      embed: false,
      embedMode: 'questionBox',
      height: 520,
    },
    validateFeedback,
  ),
  definition(
    'supporter',
    '支持/赞助',
    'interaction',
    ['赞助', '支持'],
    { title: '支持我', description: '', items: [] },
    validateSupporter,
  ),
] as const satisfies readonly SharedBlockDefinition[]

export const SHARED_BLOCK_DEFINITION_MAP = Object.fromEntries(
  SHARED_BLOCK_DEFINITIONS.map((item) => [item.type, item]),
) as Record<BlockType, SharedBlockDefinition>

if (
  SHARED_BLOCK_DEFINITIONS.length !== BLOCK_TYPES.length ||
  SHARED_BLOCK_DEFINITIONS.length !== new Set(SHARED_BLOCK_DEFINITIONS.map((item) => item.type)).size ||
  BLOCK_TYPES.some((type) => !SHARED_BLOCK_DEFINITION_MAP[type])
) {
  throw new Error('区块共享定义不完整或包含重复 type')
}
