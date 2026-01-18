export const BLOCK_TYPES = [
  'profile',
  'layout',
  'heading',
  'text',
  'richText',
  'alert',
  'links',
  'button',
  'buttons',
  'image',
  'imageGallery',
  'embed',
  'divider',
  'spacer',
  'footer',
  'liveStatus',
  'streamSchedule',
  'biliInfo',
  'videoList',
  'socialLinks',
  'musicPlayer',
  'tags',
  'milestone',
  'faq',
  'quote',
  'marquee',
  'countdown',
  'feedback',
  'supporter',
] as const

export type BlockType = typeof BLOCK_TYPES[number]

export const MAX_PAGE_IMAGES = 50

export type PageBackgroundType = 'none' | 'color' | 'image'
export type PageBackgroundBlurMode = 'none' | 'background' | 'glass'
export type PageBackgroundImageFit = 'cover' | 'contain' | 'fill' | 'none'
export type PageBackgroundScrimMode = 'auto' | 'black' | 'white'
export type PageThemeMode = 'auto' | 'light' | 'dark'

export interface BlockPageTheme {
  primaryColor?: string
  backgroundColor?: string
  textColor?: string
  radius?: number
  spacing?: 'compact' | 'normal' | 'relaxed'

  /**
   * 内容区域最大宽度（默认 820px）。
   * 支持 `none` / `100%` / `1200px` 这类格式。
   */
  pageMaxWidth?: string

  pageThemeMode?: PageThemeMode

  pageBackgroundType?: PageBackgroundType
  pageBackgroundColor?: string
  pageBackgroundImageFile?: unknown
  pageBackgroundImageFit?: PageBackgroundImageFit
  pageBackgroundCoverSidebar?: boolean
  pageBackgroundBlurMode?: PageBackgroundBlurMode
  pageBackgroundBlur?: number
  pageBackgroundScrimMode?: PageBackgroundScrimMode
  pageBackgroundScrimStrength?: number
}

export interface BlockNode {
  id: string
  type: BlockType
  /**
   * Optional user-defined name (editor-only). Should never affect rendering logic.
   * Backend will strip it for non-owner published responses.
   */
  name?: string
  hidden?: boolean
  props?: unknown
}

export interface BlockPageProject {
  version: 1
  theme?: BlockPageTheme
  blocks: BlockNode[]
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

function isHttpsUrlString(v: unknown): v is string {
  if (!isNonEmptyString(v)) return false
  try {
    const u = new URL(v)
    return u.protocol === 'https:'
  } catch {
    return false
  }
}

function isPageSlug(v: unknown): v is string {
  if (!isNonEmptyString(v)) return false
  if (v === 'home') return true
  return /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(v)
}

function asObject(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== 'object') return null
  if (Array.isArray(v)) return null
  return v as Record<string, unknown>
}

function validateBlockProps(block: BlockNode, userFacingName: string, errors: string[], depth = 0) {
  const propsObj = block.props === undefined ? null : asObject(block.props)
  if (block.props !== undefined && !propsObj) {
    errors.push(`${userFacingName}: props 必须是 object`)
    return
  }
  if (propsObj && propsObj.framed !== undefined && typeof propsObj.framed !== 'boolean') {
    errors.push(`${userFacingName}: framed 必须是 boolean`)
  }
  if (propsObj && propsObj.backgrounded !== undefined && typeof propsObj.backgrounded !== 'boolean') {
    errors.push(`${userFacingName}: backgrounded 必须是 boolean`)
  }

  if (block.name !== undefined) {
    if (typeof block.name !== 'string') errors.push(`${userFacingName}: name 必须是 string`)
    else if (block.name.trim().length === 0) errors.push(`${userFacingName}: name 不能为空`)
    else if (block.name.length > 50) errors.push(`${userFacingName}: name 不能超过 50 字符`)
  }

  switch (block.type) {
    case 'layout': {
      if (!propsObj) {
        errors.push(`${userFacingName}: 缺少 props`)
        break
      }
      if (depth >= 8) {
        errors.push(`${userFacingName}: layout 嵌套过深（最多 8 层）`)
        break
      }
      const layout = propsObj.layout
      if (layout !== 'row' && layout !== 'column' && layout !== 'grid') errors.push(`${userFacingName}: layout 仅支持 row/column/grid`)
      if (propsObj.gap !== undefined) {
        const gap = Number(propsObj.gap)
        if (!Number.isFinite(gap) || gap < 0 || gap > 80) errors.push(`${userFacingName}: gap 必须是 0~80 的数字`)
      }
      if (propsObj.columns !== undefined) {
        const cols = Number(propsObj.columns)
        if (!Number.isInteger(cols) || cols < 1 || cols > 12) errors.push(`${userFacingName}: columns 必须是 1~12 的整数`)
      } else if (layout === 'grid') {
        errors.push(`${userFacingName}: grid 模式必须提供 columns`)
      }
      if (propsObj.wrap !== undefined && typeof propsObj.wrap !== 'boolean') errors.push(`${userFacingName}: wrap 必须是 boolean`)
      if (propsObj.maxWidth !== undefined) {
        const v = propsObj.maxWidth
        if (typeof v !== 'string') errors.push(`${userFacingName}: maxWidth 必须是 string`)
        else if (v.trim().length > 0 && !/^\d+(?:\.\d+)?(?:px|%)$/.test(v.trim())) errors.push(`${userFacingName}: maxWidth 仅支持 100% 或 480px 这类格式`)
      }
      if (propsObj.justify !== undefined && !['start', 'center', 'end', 'between', 'around', 'evenly'].includes(String(propsObj.justify))) {
        errors.push(`${userFacingName}: justify 不支持`)
      }
      if (propsObj.align !== undefined && !['start', 'center', 'end', 'stretch'].includes(String(propsObj.align))) {
        errors.push(`${userFacingName}: align 不支持`)
      }
      const children = propsObj.children
      if (!Array.isArray(children)) {
        errors.push(`${userFacingName}: children 必须是 array`)
        break
      }
      children.forEach((it, idx) => {
        const childObj = asObject(it)
        const childName = `${userFacingName}.children[${idx}]`
        if (!childObj) {
          errors.push(`${childName} 必须是 object`)
          return
        }
        const type = childObj.type
        const id = childObj.id
        const name = childObj.name
        if (!isNonEmptyString(id)) errors.push(`${childName}: id 不能为空`)
        if (!isNonEmptyString(type)) {
          errors.push(`${childName}: type 不能为空`)
          return
        }
        if (!BLOCK_TYPES.includes(String(type) as any)) {
          errors.push(`${childName}: 不支持的 block type: ${String(type)}`)
          return
        }
        if (name !== undefined) {
          if (typeof name !== 'string') errors.push(`${childName}: name 必须是 string`)
          else if (name.trim().length === 0) errors.push(`${childName}: name 不能为空`)
          else if (name.length > 50) errors.push(`${childName}: name 不能超过 50 字符`)
        }
        if (childObj.hidden) return
        validateBlockProps(
          {
            id: String(id),
            type: type as any,
            name: typeof name === 'string' ? name : undefined,
            hidden: Boolean(childObj.hidden),
            props: childObj.props,
          },
          childName,
          errors,
          depth + 1,
        )
      })
      break
    }
    case 'profile':
      if (!propsObj) break
      if (propsObj.avatarFile !== undefined) {
        const f = asObject(propsObj.avatarFile)
        if (!f || typeof f.id !== 'number' || !Number.isInteger(f.id) || f.id <= 0) errors.push(`${userFacingName}: avatarFile.id 必须是正整数`)
      }
      if (propsObj.avatarUrl !== undefined && !isHttpsUrlString(propsObj.avatarUrl)) errors.push(`${userFacingName}: avatarUrl 必须是 https URL`)
      if (propsObj.displayName !== undefined && typeof propsObj.displayName !== 'string') errors.push(`${userFacingName}: displayName 必须是 string`)
      if (propsObj.bio !== undefined && typeof propsObj.bio !== 'string') errors.push(`${userFacingName}: bio 必须是 string`)
      break
    case 'heading':
      if (!propsObj) {
        errors.push(`${userFacingName}: 缺少 props`)
        break
      }
      if (!isNonEmptyString(propsObj.text)) errors.push(`${userFacingName}: text 不能为空`)
      if (propsObj.level !== undefined && ![1, 2, 3].includes(Number(propsObj.level))) errors.push(`${userFacingName}: level 仅支持 1/2/3`)
      break
    case 'text':
      if (!propsObj) {
        errors.push(`${userFacingName}: 缺少 props`)
        break
      }
      if (typeof propsObj.text !== 'string') errors.push(`${userFacingName}: text 必须是 string`)
      break
    case 'richText': {
      if (!propsObj) {
        errors.push(`${userFacingName}: 缺少 props`)
        break
      }
      if (typeof propsObj.html !== 'string') errors.push(`${userFacingName}: html 必须是 string`)
      if (typeof propsObj.html === 'string' && propsObj.html.length > 10000) errors.push(`${userFacingName}: html 过长（最多 10000 字符）`)
      if (propsObj.imagesFile !== undefined) {
        if (!Array.isArray(propsObj.imagesFile)) {
          errors.push(`${userFacingName}: imagesFile 必须是 array`)
        } else {
          ;(propsObj.imagesFile as unknown[]).forEach((it, idx) => {
            const f = asObject(it)
            if (!f || typeof f.id !== 'number' || !Number.isInteger(f.id) || f.id <= 0) errors.push(`${userFacingName}: imagesFile[${idx}].id 必须是正整数`)
          })
        }
      }
      break
    }
    case 'alert': {
      if (!propsObj) {
        errors.push(`${userFacingName}: 缺少 props`)
        break
      }
      if (propsObj.type !== undefined && !['default', 'info', 'success', 'warning', 'error'].includes(String(propsObj.type))) {
        errors.push(`${userFacingName}: type 不支持`)
      }
      if (propsObj.title !== undefined && typeof propsObj.title !== 'string') errors.push(`${userFacingName}: title 必须是 string`)
      if (typeof propsObj.text !== 'string') errors.push(`${userFacingName}: text 必须是 string`)
      if (typeof propsObj.text === 'string' && propsObj.text.length > 800) errors.push(`${userFacingName}: text 过长（最多 800 字符）`)
      if (propsObj.showIcon !== undefined && typeof propsObj.showIcon !== 'boolean') errors.push(`${userFacingName}: showIcon 必须是 boolean`)
      if (propsObj.bordered !== undefined && typeof propsObj.bordered !== 'boolean') errors.push(`${userFacingName}: bordered 必须是 boolean`)
      break
    }
    case 'links': {
      if (!propsObj) {
        errors.push(`${userFacingName}: 缺少 props`)
        break
      }
      const items = propsObj.items
      if (!Array.isArray(items)) {
        errors.push(`${userFacingName}: items 必须是 array`)
        break
      }
      items.forEach((it, idx) => {
        const obj = asObject(it)
        if (!obj) {
          errors.push(`${userFacingName}: items[${idx}] 必须是 object`)
          return
        }
        if (!isNonEmptyString(obj.label)) errors.push(`${userFacingName}: items[${idx}].label 不能为空`)
        if (!isHttpsUrlString(obj.url)) errors.push(`${userFacingName}: items[${idx}].url 必须是 https URL`)
      })
      break
    }
    case 'buttons': {
      if (!propsObj) {
        errors.push(`${userFacingName}: 缺少 props`)
        break
      }
      const items = propsObj.items
      if (!Array.isArray(items)) {
        errors.push(`${userFacingName}: items 必须是 array`)
        break
      }
      items.forEach((it, idx) => {
        const obj = asObject(it)
        if (!obj) {
          errors.push(`${userFacingName}: items[${idx}] 必须是 object`)
          return
        }
        if (!isNonEmptyString(obj.label)) errors.push(`${userFacingName}: items[${idx}].label 不能为空`)
        const hasUrl = obj.url !== undefined
        const hasPage = obj.page !== undefined
        const backDefined = obj.back !== undefined
        const hasBack = obj.back === true
        if (backDefined && typeof obj.back !== 'boolean') errors.push(`${userFacingName}: items[${idx}].back 必须是 boolean`)
        if (backDefined && obj.back === false) errors.push(`${userFacingName}: items[${idx}].back 必须为 true`)
        const setCount = Number(hasUrl) + Number(hasPage) + Number(hasBack)
        if (setCount > 1) {
          errors.push(`${userFacingName}: items[${idx}] 只能设置 url/page/back 其中一个`)
          return
        }
        if (setCount === 0) {
          errors.push(`${userFacingName}: items[${idx}] 必须提供 url/page/back`)
          return
        }
        if (hasUrl && !isHttpsUrlString(obj.url)) errors.push(`${userFacingName}: items[${idx}].url 必须是 https URL`)
        if (hasPage && !isPageSlug(obj.page)) errors.push(`${userFacingName}: items[${idx}].page 必须是 home 或合法 slug`)
      })
      if (propsObj.direction !== undefined && !['vertical', 'horizontal'].includes(String(propsObj.direction))) errors.push(`${userFacingName}: direction 仅支持 vertical/horizontal`)
      if (propsObj.type !== undefined && !['default', 'primary', 'info', 'success', 'warning', 'error'].includes(String(propsObj.type))) errors.push(`${userFacingName}: type 不支持`)
      if (propsObj.variant !== undefined && !['solid', 'secondary', 'tertiary', 'quaternary', 'ghost'].includes(String(propsObj.variant))) errors.push(`${userFacingName}: variant 不支持`)
      if (propsObj.fullWidth !== undefined && typeof propsObj.fullWidth !== 'boolean') errors.push(`${userFacingName}: fullWidth 必须是 boolean`)
      if (propsObj.align !== undefined && !['start', 'center', 'end'].includes(String(propsObj.align))) errors.push(`${userFacingName}: align 不支持`)
      if (propsObj.framed !== undefined && typeof propsObj.framed !== 'boolean') errors.push(`${userFacingName}: framed 必须是 boolean`)
      if (propsObj.gap !== undefined) {
        const v = Number(propsObj.gap)
        if (!Number.isFinite(v) || v < 0 || v > 32) errors.push(`${userFacingName}: gap 必须是 0~32 的数字`)
      }
      if (propsObj.borderTitle !== undefined && typeof propsObj.borderTitle !== 'string') errors.push(`${userFacingName}: borderTitle 必须是 string`)
      if (propsObj.borderTitleAlign !== undefined && !['left', 'center', 'right'].includes(String(propsObj.borderTitleAlign))) errors.push(`${userFacingName}: borderTitleAlign 不支持`)
      break
    }
    case 'button': {
      if (!propsObj) {
        errors.push(`${userFacingName}: 缺少 props`)
        break
      }
      if (!isNonEmptyString(propsObj.label)) errors.push(`${userFacingName}: label 不能为空`)

      const hasUrl = propsObj.url !== undefined
      const hasPage = propsObj.page !== undefined
      const backDefined = propsObj.back !== undefined
      const hasBack = propsObj.back === true
      if (backDefined && typeof propsObj.back !== 'boolean') errors.push(`${userFacingName}: back 必须是 boolean`)
      if (backDefined && propsObj.back === false) errors.push(`${userFacingName}: back 必须为 true`)
      const setCount = Number(hasUrl) + Number(hasPage) + Number(hasBack)
      if (setCount > 1) {
        errors.push(`${userFacingName}: 只能设置 url/page/back 其中一个`)
        break
      }
      if (setCount === 0) {
        errors.push(`${userFacingName}: 必须提供 url/page/back`)
        break
      }
      if (hasUrl && !isHttpsUrlString(propsObj.url)) errors.push(`${userFacingName}: url 必须是 https URL`)
      if (hasPage && !isPageSlug(propsObj.page)) errors.push(`${userFacingName}: page 必须是 home 或合法 slug`)

      if (propsObj.type !== undefined && !['default', 'primary', 'info', 'success', 'warning', 'error'].includes(String(propsObj.type))) errors.push(`${userFacingName}: type 不支持`)
      if (propsObj.variant !== undefined && !['solid', 'secondary', 'tertiary', 'quaternary', 'ghost'].includes(String(propsObj.variant))) errors.push(`${userFacingName}: variant 不支持`)
      if (propsObj.fullWidth !== undefined && typeof propsObj.fullWidth !== 'boolean') errors.push(`${userFacingName}: fullWidth 必须是 boolean`)
      if (propsObj.align !== undefined && !['start', 'center', 'end'].includes(String(propsObj.align))) errors.push(`${userFacingName}: align 不支持`)
      if (propsObj.framed !== undefined && typeof propsObj.framed !== 'boolean') errors.push(`${userFacingName}: framed 必须是 boolean`)
      break
    }
    case 'image': {
      if (!propsObj) {
        errors.push(`${userFacingName}: 缺少 props`)
        break
      }
      if (propsObj.imageFile !== undefined) {
        const f = asObject(propsObj.imageFile)
        if (!f || typeof f.id !== 'number' || !Number.isInteger(f.id) || f.id <= 0) errors.push(`${userFacingName}: imageFile.id 必须是正整数`)
      }
      const hasFile = propsObj.imageFile !== undefined
      if (!hasFile) errors.push(`${userFacingName}: imageFile 必须提供`)
      if (propsObj.alt !== undefined && typeof propsObj.alt !== 'string') errors.push(`${userFacingName}: alt 必须是 string`)
      if (propsObj.shape !== undefined && !['rounded', 'square', 'circle'].includes(String(propsObj.shape))) {
        errors.push(`${userFacingName}: shape 不支持`)
      }
      if (propsObj.maxWidth !== undefined) {
        const v = propsObj.maxWidth
        if (typeof v !== 'string') errors.push(`${userFacingName}: maxWidth 必须是 string`)
        else if (v.trim().length > 0 && !/^\d+(?:\.\d+)?(?:px|%)$/.test(v.trim())) errors.push(`${userFacingName}: maxWidth 仅支持 100% 或 480px 这类格式`)
      }
      if (propsObj.maxHeight !== undefined) {
        const v = propsObj.maxHeight
        if (typeof v !== 'string') errors.push(`${userFacingName}: maxHeight 必须是 string`)
        else if (v.trim().length > 0 && !/^\d+(?:\.\d+)?(?:px|%)$/.test(v.trim())) errors.push(`${userFacingName}: maxHeight 仅支持 100% 或 320px 这类格式`)
      }
      break
    }
    case 'imageGallery': {
      if (!propsObj) {
        errors.push(`${userFacingName}: 缺少 props`)
        break
      }
      if (propsObj.layout !== undefined && !['grid', 'masonry', 'carousel'].includes(String(propsObj.layout))) {
        errors.push(`${userFacingName}: layout 仅支持 grid/masonry/carousel`)
      }
      const layout = propsObj.layout === undefined ? 'grid' : String(propsObj.layout)
      if (propsObj.columns !== undefined) {
        const cols = Number(propsObj.columns)
        if (!Number.isInteger(cols) || cols < 1 || cols > 12) errors.push(`${userFacingName}: columns 必须是 1~12 的整数`)
      } else if (layout !== 'carousel') {
        errors.push(`${userFacingName}: 非 carousel 模式必须提供 columns`)
      }
      if (propsObj.gap !== undefined) {
        const gap = Number(propsObj.gap)
        if (!Number.isFinite(gap) || gap < 0 || gap > 80) errors.push(`${userFacingName}: gap 必须是 0~80 的数字`)
      }
      if (propsObj.maxWidth !== undefined) {
        const v = propsObj.maxWidth
        if (typeof v !== 'string') errors.push(`${userFacingName}: maxWidth 必须是 string`)
        else if (v.trim().length > 0 && !/^\d+(?:\.\d+)?(?:px|%)$/.test(v.trim())) errors.push(`${userFacingName}: maxWidth 仅支持 100% 或 480px 这类格式`)
      }
      if (propsObj.maxHeight !== undefined) {
        const v = propsObj.maxHeight
        if (typeof v !== 'string') errors.push(`${userFacingName}: maxHeight 必须是 string`)
        else if (v.trim().length > 0 && !/^\d+(?:\.\d+)?(?:px|%)$/.test(v.trim())) errors.push(`${userFacingName}: maxHeight 仅支持 100% 或 320px 这类格式`)
      }
      if (propsObj.fit !== undefined && !['cover', 'contain'].includes(String(propsObj.fit))) errors.push(`${userFacingName}: fit 仅支持 cover/contain`)
      if (propsObj.autoplay !== undefined && typeof propsObj.autoplay !== 'boolean') errors.push(`${userFacingName}: autoplay 必须是 boolean`)
      if (propsObj.interval !== undefined) {
        const v = Number(propsObj.interval)
        if (!Number.isFinite(v) || v < 1000 || v > 20000) errors.push(`${userFacingName}: interval 必须是 1000~20000 的数字`)
      }
      if (propsObj.effect !== undefined && !['slide', 'fade', 'card', 'custom'].includes(String(propsObj.effect))) errors.push(`${userFacingName}: effect 不支持`)
      if (propsObj.dotType !== undefined && !['dot', 'line'].includes(String(propsObj.dotType))) errors.push(`${userFacingName}: dotType 不支持`)
      if (propsObj.dotPlacement !== undefined && !['top', 'bottom', 'left', 'right'].includes(String(propsObj.dotPlacement))) errors.push(`${userFacingName}: dotPlacement 不支持`)
      if (propsObj.showArrow !== undefined && typeof propsObj.showArrow !== 'boolean') errors.push(`${userFacingName}: showArrow 必须是 boolean`)
      if (propsObj.showDots !== undefined && typeof propsObj.showDots !== 'boolean') errors.push(`${userFacingName}: showDots 必须是 boolean`)
      if (propsObj.loop !== undefined && typeof propsObj.loop !== 'boolean') errors.push(`${userFacingName}: loop 必须是 boolean`)
      if (propsObj.draggable !== undefined && typeof propsObj.draggable !== 'boolean') errors.push(`${userFacingName}: draggable 必须是 boolean`)
      if (propsObj.touchable !== undefined && typeof propsObj.touchable !== 'boolean') errors.push(`${userFacingName}: touchable 必须是 boolean`)
      if (propsObj.trigger !== undefined && !['click', 'hover'].includes(String(propsObj.trigger))) errors.push(`${userFacingName}: trigger 不支持`)

      const items = propsObj.items
      if (!Array.isArray(items)) {
        errors.push(`${userFacingName}: items 必须是 array`)
        break
      }
      items.forEach((it, idx) => {
        const obj = asObject(it)
        if (!obj) {
          errors.push(`${userFacingName}: items[${idx}] 必须是 object`)
          return
        }
        if (obj.imageFile !== undefined) {
          const f = asObject(obj.imageFile)
          if (!f || typeof f.id !== 'number' || !Number.isInteger(f.id) || f.id <= 0) errors.push(`${userFacingName}: items[${idx}].imageFile.id 必须是正整数`)
        }
        const hasUrl = typeof obj.url === 'string' && obj.url.length > 0
        const hasFile = obj.imageFile !== undefined
        if (!hasUrl && !hasFile) errors.push(`${userFacingName}: items[${idx}].url 或 items[${idx}].imageFile 必须提供一个`)
        if (hasUrl && !isHttpsUrlString(obj.url)) errors.push(`${userFacingName}: items[${idx}].url 必须是 https URL`)
        if (obj.desc !== undefined && typeof obj.desc !== 'string') errors.push(`${userFacingName}: items[${idx}].desc 必须是 string`)
        if (obj.alt !== undefined && typeof obj.alt !== 'string') errors.push(`${userFacingName}: items[${idx}].alt 必须是 string`)
      })
      break
    }
    case 'embed':
      if (!propsObj) {
        errors.push(`${userFacingName}: 缺少 props`)
        break
      }
      if (!isHttpsUrlString(propsObj.url)) errors.push(`${userFacingName}: url 必须是 https URL`)
      if (propsObj.title !== undefined && typeof propsObj.title !== 'string') errors.push(`${userFacingName}: title 必须是 string`)
      break
    case 'divider':
      if (!propsObj) break
      if (propsObj.text !== undefined && typeof propsObj.text !== 'string') errors.push(`${userFacingName}: text 必须是 string`)
      if (propsObj.titlePlacement !== undefined && !['left', 'center', 'right'].includes(String(propsObj.titlePlacement))) errors.push(`${userFacingName}: titlePlacement 不支持`)
      if (propsObj.marginTop !== undefined) {
        const v = Number(propsObj.marginTop)
        if (!Number.isFinite(v) || v < 0 || v > 80) errors.push(`${userFacingName}: marginTop 必须是 0~80 的数字`)
      }
      if (propsObj.marginBottom !== undefined) {
        const v = Number(propsObj.marginBottom)
        if (!Number.isFinite(v) || v < 0 || v > 80) errors.push(`${userFacingName}: marginBottom 必须是 0~80 的数字`)
      }
      break
    case 'spacer':
      if (!propsObj) break
      if (propsObj.size !== undefined && !['sm', 'md', 'lg'].includes(String(propsObj.size))) errors.push(`${userFacingName}: size 仅支持 sm/md/lg`)
      break
    case 'footer':
      if (!propsObj) break
      if (propsObj.text !== undefined && typeof propsObj.text !== 'string') errors.push(`${userFacingName}: text 必须是 string`)
      if (propsObj.framed !== undefined && typeof propsObj.framed !== 'boolean') errors.push(`${userFacingName}: framed 必须是 boolean`)
      break
    case 'liveStatus': {
      if (!propsObj) break
      if (propsObj.variant !== undefined && !['card', 'compact'].includes(String(propsObj.variant))) {
        errors.push(`${userFacingName}: variant 仅支持 card/compact`)
      }
      ;['showTitle', 'showArea', 'showCover', 'showButtons'].forEach((k) => {
        if (propsObj[k] !== undefined && typeof propsObj[k] !== 'boolean') errors.push(`${userFacingName}: ${k} 必须是 boolean`)
      })
      break
    }
    case 'streamSchedule': {
      if (!propsObj) break
      if (propsObj.layout !== undefined && !['list', 'table'].includes(String(propsObj.layout))) errors.push(`${userFacingName}: layout 仅支持 list/table`)
      if (propsObj.weeksCount !== undefined) {
        const v = Number(propsObj.weeksCount)
        if (!Number.isInteger(v) || v < 1 || v > 8) errors.push(`${userFacingName}: weeksCount 必须是 1~8 的整数`)
      }
      ;['showIcs', 'highlightToday', 'showTag'].forEach((k) => {
        if (propsObj[k] !== undefined && typeof propsObj[k] !== 'boolean') errors.push(`${userFacingName}: ${k} 必须是 boolean`)
      })
      break
    }
    case 'biliInfo': {
      if (!propsObj) break
      if (propsObj.variant !== undefined && !['card', 'compact'].includes(String(propsObj.variant))) {
        errors.push(`${userFacingName}: variant 仅支持 card/compact`)
      }
      ;['showAvatar', 'showName', 'showSign', 'showStats', 'showButtons', 'showLiveRoom'].forEach((k) => {
        if (propsObj[k] !== undefined && typeof propsObj[k] !== 'boolean') errors.push(`${userFacingName}: ${k} 必须是 boolean`)
      })
      if (propsObj.spaceUrl !== undefined && !isHttpsUrlString(propsObj.spaceUrl)) errors.push(`${userFacingName}: spaceUrl 必须是 https URL`)
      break
    }
    case 'videoList': {
      if (!propsObj) break
      if (propsObj.source !== undefined && !['manual', 'userIndex'].includes(String(propsObj.source))) errors.push(`${userFacingName}: source 不支持`)
      if (propsObj.layout !== undefined && !['grid', 'row'].includes(String(propsObj.layout))) errors.push(`${userFacingName}: layout 不支持`)
      if (propsObj.columns !== undefined) {
        const v = Number(propsObj.columns)
        if (!Number.isInteger(v) || v < 1 || v > 6) errors.push(`${userFacingName}: columns 必须是 1~6 的整数`)
      }
      if (propsObj.maxItems !== undefined) {
        const v = Number(propsObj.maxItems)
        if (!Number.isInteger(v) || v < 1 || v > 50) errors.push(`${userFacingName}: maxItems 必须是 1~50 的整数`)
      }
      if (propsObj.showTitle !== undefined && typeof propsObj.showTitle !== 'boolean') errors.push(`${userFacingName}: showTitle 必须是 boolean`)
      if (propsObj.items !== undefined) {
        if (!Array.isArray(propsObj.items)) {
          errors.push(`${userFacingName}: items 必须是 array`)
          break
        }
        propsObj.items.forEach((it, idx) => {
          const obj = asObject(it)
          if (!obj) {
            errors.push(`${userFacingName}: items[${idx}] 必须是 object`)
            return
          }
          if (obj.url !== undefined && !isHttpsUrlString(obj.url)) errors.push(`${userFacingName}: items[${idx}].url 必须是 https URL`)
          if (obj.title !== undefined && typeof obj.title !== 'string') errors.push(`${userFacingName}: items[${idx}].title 必须是 string`)
        })
      }
      break
    }
    case 'socialLinks': {
      if (!propsObj) break
      if (propsObj.size !== undefined && !['sm', 'md', 'lg'].includes(String(propsObj.size))) errors.push(`${userFacingName}: size 仅支持 sm/md/lg`)
      if (propsObj.variant !== undefined && !['round', 'square'].includes(String(propsObj.variant))) errors.push(`${userFacingName}: variant 仅支持 round/square`)
      if (propsObj.showLabel !== undefined && typeof propsObj.showLabel !== 'boolean') errors.push(`${userFacingName}: showLabel 必须是 boolean`)
      const items = propsObj.items
      if (items !== undefined) {
        if (!Array.isArray(items)) {
          errors.push(`${userFacingName}: items 必须是 array`)
          break
        }
        items.forEach((it, idx) => {
          const obj = asObject(it)
          if (!obj) {
            errors.push(`${userFacingName}: items[${idx}] 必须是 object`)
            return
          }
          if (!isNonEmptyString(obj.url)) errors.push(`${userFacingName}: items[${idx}].url 不能为空`)
          else if (!isHttpsUrlString(obj.url)) errors.push(`${userFacingName}: items[${idx}].url 必须是 https URL`)
          if (obj.platform !== undefined && !['bilibili', 'youtube', 'x', 'discord', 'twitch', 'qqgroup', 'github', 'website', 'netease', 'spotify', 'other'].includes(String(obj.platform))) {
            errors.push(`${userFacingName}: items[${idx}].platform 不支持`)
          }
          if (obj.label !== undefined && typeof obj.label !== 'string') errors.push(`${userFacingName}: items[${idx}].label 必须是 string`)
        })
      }
      break
    }
    case 'musicPlayer': {
      if (!propsObj) break
      if (propsObj.provider !== undefined && !['netease', 'spotify', 'custom'].includes(String(propsObj.provider))) errors.push(`${userFacingName}: provider 不支持`)
      if (propsObj.url !== undefined && !isHttpsUrlString(propsObj.url)) errors.push(`${userFacingName}: url 必须是 https URL`)
      if (propsObj.height !== undefined) {
        const v = Number(propsObj.height)
        if (!Number.isFinite(v) || v < 60 || v > 900) errors.push(`${userFacingName}: height 必须是 60~900 的数字`)
      }
      if (propsObj.compact !== undefined && typeof propsObj.compact !== 'boolean') errors.push(`${userFacingName}: compact 必须是 boolean`)
      break
    }
    case 'tags': {
      if (!propsObj) break
      if (propsObj.size !== undefined && !['small', 'medium'].includes(String(propsObj.size))) errors.push(`${userFacingName}: size 仅支持 small/medium`)
      if (propsObj.rounded !== undefined && typeof propsObj.rounded !== 'boolean') errors.push(`${userFacingName}: rounded 必须是 boolean`)
      if (propsObj.framed !== undefined && typeof propsObj.framed !== 'boolean') errors.push(`${userFacingName}: framed 必须是 boolean`)
      if (propsObj.borderTitle !== undefined && typeof propsObj.borderTitle !== 'string') errors.push(`${userFacingName}: borderTitle 必须是 string`)
      if (propsObj.borderTitleAlign !== undefined && !['left', 'center', 'right'].includes(String(propsObj.borderTitleAlign))) errors.push(`${userFacingName}: borderTitleAlign 不支持`)
      const items = propsObj.items
      if (items !== undefined) {
        if (!Array.isArray(items)) {
          errors.push(`${userFacingName}: items 必须是 array`)
          break
        }
        items.forEach((it, idx) => {
          const obj = asObject(it)
          if (!obj) {
            errors.push(`${userFacingName}: items[${idx}] 必须是 object`)
            return
          }
          if (obj.text !== undefined && typeof obj.text !== 'string') errors.push(`${userFacingName}: items[${idx}].text 必须是 string`)
          if (obj.color !== undefined && typeof obj.color !== 'string') errors.push(`${userFacingName}: items[${idx}].color 必须是 string`)
          if (obj.type !== undefined && !['default', 'info', 'success', 'warning', 'error'].includes(String(obj.type))) errors.push(`${userFacingName}: items[${idx}].type 不支持`)
        })
      }
      break
    }
    case 'milestone': {
      if (!propsObj) break
      if (propsObj.mode !== undefined && !['timeline', 'list'].includes(String(propsObj.mode))) errors.push(`${userFacingName}: mode 不支持`)
      const items = propsObj.items
      if (items !== undefined) {
        if (!Array.isArray(items)) {
          errors.push(`${userFacingName}: items 必须是 array`)
          break
        }
        items.forEach((it, idx) => {
          const obj = asObject(it)
          if (!obj) {
            errors.push(`${userFacingName}: items[${idx}] 必须是 object`)
            return
          }
          if (obj.date !== undefined && typeof obj.date !== 'string') errors.push(`${userFacingName}: items[${idx}].date 必须是 string`)
          if (obj.title !== undefined && typeof obj.title !== 'string') errors.push(`${userFacingName}: items[${idx}].title 必须是 string`)
          if (obj.description !== undefined && typeof obj.description !== 'string') errors.push(`${userFacingName}: items[${idx}].description 必须是 string`)
        })
      }
      break
    }
    case 'faq': {
      if (!propsObj) break
      if (propsObj.accordion !== undefined && typeof propsObj.accordion !== 'boolean') errors.push(`${userFacingName}: accordion 必须是 boolean`)
      const items = propsObj.items
      if (items !== undefined) {
        if (!Array.isArray(items)) {
          errors.push(`${userFacingName}: items 必须是 array`)
          break
        }
        items.forEach((it, idx) => {
          const obj = asObject(it)
          if (!obj) {
            errors.push(`${userFacingName}: items[${idx}] 必须是 object`)
            return
          }
          if (obj.q !== undefined && typeof obj.q !== 'string') errors.push(`${userFacingName}: items[${idx}].q 必须是 string`)
          if (obj.a !== undefined && typeof obj.a !== 'string') errors.push(`${userFacingName}: items[${idx}].a 必须是 string`)
        })
      }
      break
    }
    case 'quote': {
      if (!propsObj) break
      if (propsObj.text !== undefined && typeof propsObj.text !== 'string') errors.push(`${userFacingName}: text 必须是 string`)
      if (propsObj.author !== undefined && typeof propsObj.author !== 'string') errors.push(`${userFacingName}: author 必须是 string`)
      if (propsObj.align !== undefined && !['left', 'center', 'right'].includes(String(propsObj.align))) errors.push(`${userFacingName}: align 不支持`)
      break
    }
    case 'marquee': {
      if (!propsObj) break
      if (propsObj.text !== undefined && typeof propsObj.text !== 'string') errors.push(`${userFacingName}: text 必须是 string`)
      if (propsObj.direction !== undefined && !['left', 'right'].includes(String(propsObj.direction))) errors.push(`${userFacingName}: direction 不支持`)
      if (propsObj.pauseOnHover !== undefined && typeof propsObj.pauseOnHover !== 'boolean') errors.push(`${userFacingName}: pauseOnHover 必须是 boolean`)
      if (propsObj.durationSec !== undefined) {
        const v = Number(propsObj.durationSec)
        if (!Number.isFinite(v) || v < 4 || v > 120) errors.push(`${userFacingName}: durationSec 必须是 4~120 的数字`)
      }
      break
    }
    case 'countdown': {
      if (!propsObj) break
      if (propsObj.title !== undefined && typeof propsObj.title !== 'string') errors.push(`${userFacingName}: title 必须是 string`)
      if (propsObj.target !== undefined && typeof propsObj.target !== 'string') errors.push(`${userFacingName}: target 必须是 string`)
      if (propsObj.showSeconds !== undefined && typeof propsObj.showSeconds !== 'boolean') errors.push(`${userFacingName}: showSeconds 必须是 boolean`)
      if (propsObj.doneText !== undefined && typeof propsObj.doneText !== 'string') errors.push(`${userFacingName}: doneText 必须是 string`)
      if (propsObj.style !== undefined && !['cards', 'inline'].includes(String(propsObj.style))) errors.push(`${userFacingName}: style 不支持`)
      break
    }
    case 'feedback': {
      if (!propsObj) break
      if (propsObj.title !== undefined && typeof propsObj.title !== 'string') errors.push(`${userFacingName}: title 必须是 string`)
      if (propsObj.description !== undefined && typeof propsObj.description !== 'string') errors.push(`${userFacingName}: description 必须是 string`)
      if (propsObj.url !== undefined && !isHttpsUrlString(propsObj.url)) errors.push(`${userFacingName}: url 必须是 https URL`)
      if (propsObj.buttonText !== undefined && typeof propsObj.buttonText !== 'string') errors.push(`${userFacingName}: buttonText 必须是 string`)
      if (propsObj.embed !== undefined && typeof propsObj.embed !== 'boolean') errors.push(`${userFacingName}: embed 必须是 boolean`)
      if (propsObj.height !== undefined) {
        const v = Number(propsObj.height)
        if (!Number.isFinite(v) || v < 200 || v > 1200) errors.push(`${userFacingName}: height 必须是 200~1200 的数字`)
      }
      break
    }
    case 'supporter': {
      if (!propsObj) break
      if (propsObj.title !== undefined && typeof propsObj.title !== 'string') errors.push(`${userFacingName}: title 必须是 string`)
      if (propsObj.description !== undefined && typeof propsObj.description !== 'string') errors.push(`${userFacingName}: description 必须是 string`)
      const items = propsObj.items
      if (items !== undefined) {
        if (!Array.isArray(items)) {
          errors.push(`${userFacingName}: items 必须是 array`)
          break
        }
        items.forEach((it, idx) => {
          const obj = asObject(it)
          if (!obj) {
            errors.push(`${userFacingName}: items[${idx}] 必须是 object`)
            return
          }
          if (obj.platform !== undefined && !['afdian', 'kofi', 'patreon', 'paypal', 'other'].includes(String(obj.platform))) {
            errors.push(`${userFacingName}: items[${idx}].platform 不支持`)
          }
          if (!isNonEmptyString(obj.url)) errors.push(`${userFacingName}: items[${idx}].url 不能为空`)
          else if (!isHttpsUrlString(obj.url)) errors.push(`${userFacingName}: items[${idx}].url 必须是 https URL`)
          if (obj.label !== undefined && typeof obj.label !== 'string') errors.push(`${userFacingName}: items[${idx}].label 必须是 string`)
        })
      }
      break
    }
  }
}

function validateTheme(theme: unknown, errors: string[]) {
  if (theme === undefined || theme === null) return
  const obj = asObject(theme)
  if (!obj) {
    errors.push('theme 必须是 object')
    return
  }

  if (obj.primaryColor !== undefined && typeof obj.primaryColor !== 'string') errors.push('theme.primaryColor 必须是 string')
  if (obj.backgroundColor !== undefined && typeof obj.backgroundColor !== 'string') errors.push('theme.backgroundColor 必须是 string')
  if (obj.textColor !== undefined && typeof obj.textColor !== 'string') errors.push('theme.textColor 必须是 string')
  if (obj.pageMaxWidth !== undefined) {
    if (typeof obj.pageMaxWidth !== 'string') errors.push('theme.pageMaxWidth 必须是 string')
    else {
      const v = obj.pageMaxWidth.trim()
      if (v.length > 0 && v !== 'none' && !/^\d+(?:\.\d+)?(?:px|%)$/.test(v)) errors.push('theme.pageMaxWidth 仅支持 none / 100% / 1200px 这类格式')
    }
  }
  if (obj.radius !== undefined) {
    const v = Number(obj.radius)
    if (!Number.isFinite(v) || v < 0 || v > 32) errors.push('theme.radius 必须是 0~32 的数字')
  }
  if (obj.spacing !== undefined && !['compact', 'normal', 'relaxed'].includes(String(obj.spacing))) {
    errors.push('theme.spacing 不支持')
  }

  if (obj.pageThemeMode !== undefined && !['auto', 'light', 'dark'].includes(String(obj.pageThemeMode))) {
    errors.push('theme.pageThemeMode 不支持')
  }

  if (obj.pageBackgroundType !== undefined && !['none', 'color', 'image'].includes(String(obj.pageBackgroundType))) {
    errors.push('theme.pageBackgroundType 不支持')
  }
  if (obj.pageBackgroundColor !== undefined && typeof obj.pageBackgroundColor !== 'string') {
    errors.push('theme.pageBackgroundColor 必须是 string')
  }
  if (obj.pageBackgroundImageFit !== undefined && !['cover', 'contain', 'fill', 'none'].includes(String(obj.pageBackgroundImageFit))) {
    errors.push('theme.pageBackgroundImageFit 不支持')
  }
  if (obj.pageBackgroundCoverSidebar !== undefined && typeof obj.pageBackgroundCoverSidebar !== 'boolean') {
    errors.push('theme.pageBackgroundCoverSidebar 必须是 boolean')
  }
  if (obj.pageBackgroundBlurMode !== undefined && !['none', 'background', 'glass'].includes(String(obj.pageBackgroundBlurMode))) {
    errors.push('theme.pageBackgroundBlurMode 不支持')
  }
  if (obj.pageBackgroundBlur !== undefined) {
    const v = Number(obj.pageBackgroundBlur)
    if (!Number.isFinite(v) || v < 0 || v > 40) errors.push('theme.pageBackgroundBlur 必须是 0~40 的数字')
  }
  if (obj.pageBackgroundScrimMode !== undefined && !['auto', 'black', 'white'].includes(String(obj.pageBackgroundScrimMode))) {
    errors.push('theme.pageBackgroundScrimMode 不支持')
  }
  if (obj.pageBackgroundScrimStrength !== undefined) {
    const v = Number(obj.pageBackgroundScrimStrength)
    if (!Number.isFinite(v) || v < 0 || v > 100) errors.push('theme.pageBackgroundScrimStrength 必须是 0~100 的数字')
  }

  if (obj.pageBackgroundImageFile !== undefined) {
    const f = asObject(obj.pageBackgroundImageFile)
    if (!f || typeof f.id !== 'number' || !Number.isInteger(f.id) || f.id <= 0) errors.push('theme.pageBackgroundImageFile.id 必须是正整数')
  }

  const bgType = obj.pageBackgroundType === undefined ? 'none' : String(obj.pageBackgroundType)
  if (bgType === 'image' && obj.pageBackgroundImageFile === undefined) {
    errors.push('theme.pageBackgroundType=image 时必须提供 pageBackgroundImageFile')
  }
  if (bgType === 'color' && obj.pageBackgroundColor !== undefined && typeof obj.pageBackgroundColor !== 'string') {
    errors.push('theme.pageBackgroundType=color 时 pageBackgroundColor 必须是 string')
  }
}

export function validateBlockPageProject(project: unknown) {
  const errors: string[] = []
  const obj = asObject(project)
  if (!obj) return { ok: false as const, errors: ['BlockPageProject 必须是 object'] }
  if (obj.version !== 1) errors.push(`BlockPageProject.version 不支持: ${String(obj.version)}`)
  if (!Array.isArray(obj.blocks)) errors.push('BlockPageProject.blocks 必须是 array')

  validateTheme(obj.theme, errors)

  const blocks = Array.isArray(obj.blocks) ? (obj.blocks as unknown[]) : []
  blocks.forEach((b, idx) => {
    const bObj = asObject(b)
    if (!bObj) {
      errors.push(`blocks[${idx}] 必须是 object`)
      return
    }
    const type = bObj.type
    const id = bObj.id
    const name = bObj.name
    const userFacingName = `blocks[${idx}]`
    if (!isNonEmptyString(id)) errors.push(`${userFacingName}: id 不能为空`)
    if (!isNonEmptyString(type)) {
      errors.push(`${userFacingName}: type 不能为空`)
      return
    }
    if (!BLOCK_TYPES.includes(String(type) as any)) {
      errors.push(`${userFacingName}: 不支持的 block type: ${String(type)}`)
      return
    }
    if (name !== undefined) {
      if (typeof name !== 'string') errors.push(`${userFacingName}: name 必须是 string`)
      else if (name.trim().length === 0) errors.push(`${userFacingName}: name 不能为空`)
      else if (name.length > 50) errors.push(`${userFacingName}: name 不能超过 50 字符`)
    }
    if (bObj.hidden) return
    validateBlockProps(
      {
        id: String(id),
        type: type as any,
        name: typeof name === 'string' ? name : undefined,
        hidden: Boolean(bObj.hidden),
        props: bObj.props,
      },
      userFacingName,
      errors,
      0,
    )
  })

  if (!errors.length) {
    const imageCount = countImagesInBlocks(obj.blocks as any as BlockNode[], false)
    if (imageCount > MAX_PAGE_IMAGES) errors.push(`图片数量超出上限：${imageCount}/${MAX_PAGE_IMAGES}`)
  }

  if (errors.length) return { ok: false as const, errors }
  return { ok: true as const, project: obj as unknown as BlockPageProject }
}

export function countImagesInBlocks(blocks: BlockNode[], includeHidden = false): number {
  const walk = (nodes: BlockNode[]): number => {
    let count = 0
    for (const b of nodes) {
      if (!includeHidden && b.hidden) continue
      const propsObj = (b.props && typeof b.props === 'object' && !Array.isArray(b.props)) ? (b.props as any) : {}

      if (b.type === 'layout') {
        const children = Array.isArray(propsObj.children) ? (propsObj.children as BlockNode[]) : []
        count += walk(children)
        continue
      }
      if (b.type === 'image') {
        const hasFile = !!propsObj.imageFile
        if (hasFile) count += 1
        continue
      }
      if (b.type === 'imageGallery') {
        const items = Array.isArray(propsObj.items) ? propsObj.items : []
        items.forEach((it: any) => {
          if (!it || typeof it !== 'object' || Array.isArray(it)) return
          const hasFile = !!it.imageFile
          const hasUrl = typeof it.url === 'string' && it.url.trim().length > 0
          if (hasFile || hasUrl) count += 1
        })
        continue
      }
    }
    return count
  }
  return walk(blocks)
}
