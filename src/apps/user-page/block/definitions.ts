import { parseEmbedUrl, parseFeedbackEmbedUrl, parseMusicEmbedUrl } from './embed'
import { BLOCK_TYPES } from './schemaTypes'
import type { BlockType } from './schemaTypes'
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

function withProps(validate: (props: PropsObject, path: string, errors: ValidationErrors, context: BlockValidationContext) => void): Validator {
  return (props, path, errors, context) => {
    if (props) validate(props, path, errors, context)
  }
}

function strings(keys: string[]): Validator {
  return withProps((props, path, errors) => keys.forEach(key => optionalString(props, key, path, errors)))
}

function booleans(props: PropsObject, keys: string[], path: string, errors: ValidationErrors) {
  keys.forEach(key => optionalBoolean(props, key, path, errors))
}

const validateLayout = withProps((props, path, errors) => {
  optionalEnum(props, 'layout', ['row', 'column', 'grid'], path, errors)
  optionalNumber(props, 'gap', 0, 80, path, errors)
  optionalNumber(props, 'columns', 1, 12, path, errors, true)
  optionalBoolean(props, 'wrap', path, errors)
  optionalCssSize(props, 'maxWidth', path, errors)
  optionalEnum(props, 'justify', ['start', 'center', 'end', 'between', 'around', 'evenly'], path, errors)
  optionalEnum(props, 'align', ['start', 'center', 'end', 'stretch'], path, errors)
  if (props.layout === 'grid' && props.columns === undefined) errors.push(`${path}: grid 模式必须提供 columns`)
  if (!Array.isArray(props.children)) errors.push(`${path}: children 必须是 array`)
})

const validateProfile = withProps((props, path, errors) => {
  optionalFile(props, 'avatarFile', path, errors)
  optionalHttpsUrl(props, 'avatarUrl', path, errors)
  optionalString(props, 'displayName', path, errors)
  optionalString(props, 'bio', path, errors)
})

const validateRichText = withProps((props, path, errors) => {
  if (typeof props.html !== 'string') errors.push(`${path}: html 必须是 string`)
  else if (props.html.length > 10000) errors.push(`${path}: html 过长（最多 10000 字符）`)
  if (props.imagesFile !== undefined) {
    if (!Array.isArray(props.imagesFile)) errors.push(`${path}: imagesFile 必须是 array`)
    else props.imagesFile.forEach((file, index) => optionalFile({ file }, 'file', `${path}: imagesFile[${index}]`, errors))
  }
})

const validateLinks = withProps((props, path, errors) => validateItems(props, path, errors, (item, itemPath) => {
  requiredString(item, 'label', itemPath, errors)
  if (!isHttpsUrl(item.url)) errors.push(`${itemPath}: url 必须是 https URL`)
}, true))

function validateButtonAppearance(props: PropsObject, path: string, errors: ValidationErrors) {
  optionalEnum(props, 'type', ['default', 'primary', 'info', 'success', 'warning', 'error'], path, errors)
  optionalEnum(props, 'variant', ['solid', 'secondary', 'tertiary', 'quaternary', 'ghost'], path, errors)
  optionalBoolean(props, 'fullWidth', path, errors)
  optionalEnum(props, 'align', ['start', 'center', 'end'], path, errors)
}

const validateButton = withProps((props, path, errors, context) => {
  if (!context.hidden) requiredString(props, 'label', path, errors)
  validateLinkTarget(props, path, errors)
  validateButtonAppearance(props, path, errors)
})

const validateButtons = withProps((props, path, errors, context) => {
  validateItems(props, path, errors, (item, itemPath) => {
    if (!context.hidden) requiredString(item, 'label', itemPath, errors)
    validateLinkTarget(item, itemPath, errors)
  }, true)
  optionalEnum(props, 'direction', ['vertical', 'horizontal'], path, errors)
  validateButtonAppearance(props, path, errors)
  optionalNumber(props, 'gap', 0, 32, path, errors)
  optionalString(props, 'borderTitle', path, errors)
  optionalEnum(props, 'borderTitleAlign', ['left', 'center', 'right'], path, errors)
})

const validateImage = withProps((props, path, errors, context) => {
  optionalFile(props, 'imageFile', path, errors)
  if (!context.hidden && props.imageFile === undefined) errors.push(`${path}: imageFile 必须提供`)
  optionalString(props, 'alt', path, errors)
  optionalEnum(props, 'shape', ['rounded', 'square', 'circle'], path, errors)
  optionalCssSize(props, 'maxWidth', path, errors)
  optionalCssSize(props, 'maxHeight', path, errors)
})

const validateGallery = withProps((props, path, errors) => {
  optionalEnum(props, 'layout', ['grid', 'masonry', 'carousel'], path, errors)
  if (props.layout !== 'carousel' && props.columns === undefined) errors.push(`${path}: 非 carousel 模式必须提供 columns`)
  optionalNumber(props, 'columns', 1, 12, path, errors, true)
  optionalNumber(props, 'gap', 0, 80, path, errors)
  optionalCssSize(props, 'maxWidth', path, errors)
  optionalCssSize(props, 'maxHeight', path, errors)
  optionalEnum(props, 'fit', ['cover', 'contain'], path, errors)
  booleans(props, ['autoplay', 'showArrow', 'showDots', 'loop', 'draggable', 'touchable'], path, errors)
  optionalNumber(props, 'interval', 1000, 60000, path, errors)
  optionalEnum(props, 'effect', ['slide', 'fade', 'card', 'custom'], path, errors)
  optionalEnum(props, 'dotType', ['dot', 'line'], path, errors)
  optionalEnum(props, 'dotPlacement', ['top', 'bottom', 'left', 'right'], path, errors)
  optionalEnum(props, 'trigger', ['hover', 'click'], path, errors)
  validateItems(props, path, errors, (item, itemPath) => {
    optionalFile(item, 'imageFile', itemPath, errors)
    if (isNonEmptyString(item.url) && !isHttpsUrl(item.url)) errors.push(`${itemPath}: url 必须是 https URL`)
    if (item.imageFile === undefined && !isNonEmptyString(item.url)) errors.push(`${itemPath}: url 或 imageFile 必须提供一个`)
    optionalString(item, 'desc', itemPath, errors)
    optionalString(item, 'alt', itemPath, errors)
  }, true)
})

const validateEmbed = withProps((props, path, errors, context) => {
  optionalString(props, 'title', path, errors)
  if (context.hidden && !isNonEmptyString(props.url)) return
  try { parseEmbedUrl(String(props.url ?? ''), typeof props.title === 'string' ? props.title : undefined) }
  catch (error) { errors.push(`${path}: ${(error as Error).message}`) }
})

const validateVideoList = withProps((props, path, errors) => {
  optionalEnum(props, 'source', ['manual', 'userIndex'], path, errors)
  optionalEnum(props, 'layout', ['grid', 'row'], path, errors)
  optionalNumber(props, 'columns', 1, 6, path, errors, true)
  optionalNumber(props, 'maxItems', 1, 50, path, errors, true)
  optionalBoolean(props, 'showTitle', path, errors)
  validateItems(props, path, errors, (item, itemPath) => {
    optionalHttpsUrl(item, 'url', itemPath, errors)
    optionalString(item, 'title', itemPath, errors)
  })
})

const validateSocialLinks = withProps((props, path, errors) => {
  optionalEnum(props, 'size', ['sm', 'md', 'lg'], path, errors)
  optionalEnum(props, 'variant', ['round', 'square'], path, errors)
  optionalBoolean(props, 'showLabel', path, errors)
  validateItems(props, path, errors, (item, itemPath) => {
    if (!isHttpsUrl(item.url)) errors.push(`${itemPath}: url 必须是 https URL`)
    optionalEnum(item, 'platform', ['bilibili', 'youtube', 'x', 'discord', 'twitch', 'qqgroup', 'github', 'website', 'netease', 'spotify', 'other'], itemPath, errors)
    optionalString(item, 'label', itemPath, errors)
  })
})

const validateMusic = withProps((props, path, errors, context) => {
  optionalEnum(props, 'provider', ['netease', 'spotify', 'custom'], path, errors)
  optionalNumber(props, 'height', 60, 900, path, errors)
  optionalBoolean(props, 'compact', path, errors)
  if (context.hidden && !isNonEmptyString(props.url)) return
  try { parseMusicEmbedUrl((props.provider ?? 'netease') as 'netease' | 'spotify' | 'custom', String(props.url ?? ''), Number(props.height) || 300) }
  catch (error) { errors.push(`${path}: ${(error as Error).message}`) }
})

const validateTextItems = (fields: string[]): Validator => withProps((props, path, errors) => validateItems(props, path, errors, (item, itemPath) => {
  fields.forEach(field => optionalString(item, field, itemPath, errors))
}))

const validateFeedback = withProps((props, path, errors, context) => {
  ;['title', 'description', 'url', 'buttonText'].forEach(key => optionalString(props, key, path, errors))
  optionalEnum(props, 'embedMode', ['questionBox', 'iframe'], path, errors)
  optionalBoolean(props, 'embed', path, errors)
  optionalNumber(props, 'height', 200, 1200, path, errors)
  if (isNonEmptyString(props.url) && !isHttpsUrl(props.url)) errors.push(`${path}: url 必须是 https URL`)
  if (props.embed === true && props.embedMode === 'iframe' && !(context.hidden && !isNonEmptyString(props.url))) {
    try { parseFeedbackEmbedUrl(String(props.url ?? '')) }
    catch (error) { errors.push(`${path}: ${(error as Error).message}`) }
  }
})

const validateSupporter = withProps((props, path, errors) => {
  optionalString(props, 'title', path, errors)
  optionalString(props, 'description', path, errors)
  validateItems(props, path, errors, (item, itemPath) => {
    optionalEnum(item, 'platform', ['afdian', 'kofi', 'patreon', 'paypal', 'other'], itemPath, errors)
    if (!isHttpsUrl(item.url)) errors.push(`${itemPath}: url 必须是 https URL`)
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
  definition('layout', '布局容器', 'layout', ['分组', '网格', '排列'], { layout: 'row', wrap: true, gap: 12, maxWidth: '', columns: 2, justify: 'start', align: 'stretch', children: [] }, validateLayout, true),
  definition('heading', '标题', 'basic', ['标题', 'heading'], { text: '标题', level: 2 }, withProps((p, path, errors, context) => { if (!context.hidden) requiredString(p, 'text', path, errors); optionalEnum(p, 'level', [1, 2, 3], path, errors) }), true),
  definition('text', '文本', 'basic', ['文字', '段落'], { text: '' }, withProps((p, path, errors) => { if (typeof p.text !== 'string') errors.push(`${path}: text 必须是 string`) }), true),
  definition('richText', '富文本', 'content', ['HTML', '格式化'], { html: '', imagesFile: [], framed: false, backgrounded: false }, validateRichText, true),
  definition('alert', '提示框', 'content', ['通知', '警告'], { type: 'info', title: '提示', text: '这里是一段提示内容', showIcon: true, bordered: false }, withProps((p, path, errors) => { optionalEnum(p, 'type', ['default', 'info', 'success', 'warning', 'error'], path, errors); optionalString(p, 'title', path, errors); optionalString(p, 'text', path, errors); booleans(p, ['showIcon', 'bordered'], path, errors) }), true),
  definition('links', '链接列表', 'interaction', ['网址', '导航'], { items: [] }, validateLinks, true),
  definition('button', '按钮', 'interaction', ['链接', '跳转'], { label: '按钮', page: 'home', type: 'primary', variant: 'solid', fullWidth: true, align: 'start', framed: false, backgrounded: false }, validateButton, true),
  definition('buttons', '按钮组', 'interaction', ['链接', '导航'], { items: [], direction: 'vertical', type: 'primary', variant: 'solid', gap: 10, fullWidth: true, align: 'start', framed: false, backgrounded: false, borderTitle: '', borderTitleAlign: 'left' }, validateButtons, true),
  definition('image', '图片', 'media', ['照片', '封面'], { alt: '', maxWidth: '', maxHeight: '', shape: 'rounded' }, validateImage, true),
  definition('imageGallery', '图片组', 'media', ['相册', '轮播', '画廊'], { layout: 'grid', columns: 3, gap: 12, maxWidth: '', maxHeight: '', fit: 'cover', autoplay: false, interval: 5000, effect: 'slide', showArrow: true, showDots: true, dotType: 'line', dotPlacement: 'bottom', loop: true, draggable: true, touchable: true, trigger: 'click', items: [], framed: false, backgrounded: false }, validateGallery, true),
  definition('embed', '嵌入视频', 'media', ['B站', 'YouTube', '视频'], { url: '', title: '' }, validateEmbed, true),
  definition('divider', '分割线', 'layout', ['间隔', '分隔'], { text: '', titlePlacement: 'center', marginTop: 12, marginBottom: 12 }, withProps((p, path, errors) => { optionalString(p, 'text', path, errors); optionalEnum(p, 'titlePlacement', ['left', 'center', 'right'], path, errors); optionalNumber(p, 'marginTop', 0, 80, path, errors); optionalNumber(p, 'marginBottom', 0, 80, path, errors) })),
  definition('spacer', '间距', 'layout', ['空白', '留白'], { size: 'md' }, withProps((p, path, errors) => optionalEnum(p, 'size', ['sm', 'md', 'lg'], path, errors))),
  definition('footer', '页脚', 'layout', ['底部', '版权'], { text: '', framed: false, backgrounded: false }, strings(['text'])),
  definition('liveStatus', '直播状态', 'data', ['开播', '直播间'], { variant: 'card', showTitle: true, showArea: true, showCover: true, showButtons: true }, withProps((p, path, errors) => { optionalEnum(p, 'variant', ['card', 'compact'], path, errors); booleans(p, ['showTitle', 'showArea', 'showCover', 'showButtons'], path, errors) })),
  definition('streamSchedule', '直播日程', 'data', ['日历', '排期'], { layout: 'list', weeksCount: 1, showIcs: true, highlightToday: true, showTag: true }, withProps((p, path, errors) => { optionalEnum(p, 'layout', ['list', 'table'], path, errors); optionalNumber(p, 'weeksCount', 1, 8, path, errors, true); booleans(p, ['showIcs', 'highlightToday', 'showTag'], path, errors) })),
  definition('biliInfo', 'B站数据卡片', 'data', ['哔哩哔哩', '粉丝'], { variant: 'card', showAvatar: true, showName: true, showSign: true, showStats: true, showButtons: true, showLiveRoom: true, spaceUrl: '' }, withProps((p, path, errors) => { optionalEnum(p, 'variant', ['card', 'compact'], path, errors); booleans(p, ['showAvatar', 'showName', 'showSign', 'showStats', 'showButtons', 'showLiveRoom'], path, errors); optionalHttpsUrl(p, 'spaceUrl', path, errors) })),
  definition('videoList', '视频列表', 'data', ['投稿', '视频'], { source: 'manual', layout: 'grid', columns: 2, maxItems: 6, showTitle: true, items: [] }, validateVideoList),
  definition('socialLinks', '社交图标组', 'interaction', ['社交', '平台'], { size: 'md', variant: 'round', showLabel: false, items: [] }, validateSocialLinks),
  definition('musicPlayer', '音乐播放器', 'media', ['网易云', 'Spotify', '音乐'], { provider: 'netease', url: '', height: 300, compact: false }, validateMusic),
  definition('tags', '标签组', 'content', ['标签', '关键词'], { size: 'medium', rounded: true, items: [], framed: false, backgrounded: false, borderTitle: '', borderTitleAlign: 'left' }, withProps((p, path, errors) => { optionalEnum(p, 'size', ['small', 'medium'], path, errors); optionalBoolean(p, 'rounded', path, errors); optionalString(p, 'borderTitle', path, errors); optionalEnum(p, 'borderTitleAlign', ['left', 'center', 'right'], path, errors); validateItems(p, path, errors, (item, itemPath) => { optionalString(item, 'text', itemPath, errors); optionalString(item, 'color', itemPath, errors); optionalEnum(item, 'type', ['default', 'info', 'success', 'warning', 'error'], itemPath, errors) }) })),
  definition('milestone', '里程碑/时间轴', 'content', ['时间线', '经历'], { mode: 'timeline', items: [] }, withProps((p, path, errors) => { optionalEnum(p, 'mode', ['timeline', 'list'], path, errors); validateTextItems(['date', 'title', 'description'])(p, path, errors, { hidden: false }) })),
  definition('faq', '折叠问答', 'content', ['常见问题', '问答'], { accordion: false, items: [] }, withProps((p, path, errors) => { optionalBoolean(p, 'accordion', path, errors); validateTextItems(['q', 'a'])(p, path, errors, { hidden: false }) })),
  definition('quote', '金句引用', 'content', ['引用', '语录'], { text: '', author: '', align: 'center' }, withProps((p, path, errors) => { optionalString(p, 'text', path, errors); optionalString(p, 'author', path, errors); optionalEnum(p, 'align', ['left', 'center', 'right'], path, errors) })),
  definition('marquee', '走马灯/公告', 'content', ['滚动', '公告'], { text: '', direction: 'left', durationSec: 18, pauseOnHover: true, framed: false, backgrounded: false }, withProps((p, path, errors) => { optionalString(p, 'text', path, errors); optionalEnum(p, 'direction', ['left', 'right'], path, errors); optionalNumber(p, 'durationSec', 4, 120, path, errors); optionalBoolean(p, 'pauseOnHover', path, errors) })),
  definition('countdown', '倒计时', 'content', ['计时', '日期'], { title: '', target: '', style: 'cards', showSeconds: true, doneText: '已到达', framed: false, backgrounded: false }, withProps((p, path, errors) => { optionalString(p, 'title', path, errors); optionalString(p, 'target', path, errors); optionalEnum(p, 'style', ['cards', 'inline'], path, errors); optionalBoolean(p, 'showSeconds', path, errors); optionalString(p, 'doneText', path, errors) })),
  definition('feedback', '表单/留言', 'interaction', ['提问箱', '表单'], { title: '留言 / 提问', description: '', url: '', buttonText: '打开', embed: false, embedMode: 'questionBox', height: 520 }, validateFeedback),
  definition('supporter', '支持/赞助', 'interaction', ['赞助', '支持'], { title: '支持我', description: '', items: [] }, validateSupporter),
] as const satisfies readonly SharedBlockDefinition[]

export const SHARED_BLOCK_DEFINITION_MAP = Object.fromEntries(
  SHARED_BLOCK_DEFINITIONS.map(item => [item.type, item]),
) as Record<BlockType, SharedBlockDefinition>

if (SHARED_BLOCK_DEFINITIONS.length !== BLOCK_TYPES.length
  || SHARED_BLOCK_DEFINITIONS.length !== new Set(SHARED_BLOCK_DEFINITIONS.map(item => item.type)).size
  || BLOCK_TYPES.some(type => !SHARED_BLOCK_DEFINITION_MAP[type])) {
  throw new Error('区块共享定义不完整或包含重复 type')
}
