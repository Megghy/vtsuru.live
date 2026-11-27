import type { BlockNode, BlockVisibilityContext } from './schema'
import { isBlockVisible } from './visibility'

const RICH_TEXT_MEDIA_TAG = /<(?:img|video|audio|iframe|hr)\b/i

function isEmptyText(v: unknown): boolean {
  return typeof v !== 'string' || v.trim().length === 0
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  return v as Record<string, unknown>
}

function isEmptyRichText(html: unknown): boolean {
  if (typeof html !== 'string') return true
  if (RICH_TEXT_MEDIA_TAG.test(html)) return false
  if (typeof DOMParser !== 'undefined') {
    const bodyText = new DOMParser().parseFromString(html, 'text/html').body.textContent
    const text = (bodyText ?? '')
      .replace(/\u00A0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    return text.length === 0
  }
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').trim().length === 0
}

function hasValidButtonItem(raw: unknown): boolean {
  const item = asRecord(raw)
  if (!item) return false
  if (typeof item.label === 'string' && item.label.trim().length > 0) return true
  if (item.back === true) return true
  if (typeof item.copyText === 'string' && item.copyText.trim().length > 0) return true
  const page = typeof item.page === 'string' ? item.page.trim() : ''
  if (page.length > 0) return true
  const url = typeof item.url === 'string' ? item.url.trim() : ''
  return url.length > 0 && url !== 'https://'
}

function hasValidImage(propsObj: Record<string, unknown>): boolean {
  const file = asRecord(propsObj.imageFile)
  if (file && typeof file.path === 'string' && file.path.trim().length > 0) return true
  const url = typeof propsObj.url === 'string' ? propsObj.url.trim() : ''
  return /^https:\/\//i.test(url)
}

function hasValidCardListItem(raw: unknown): boolean {
  const item = asRecord(raw)
  if (!item) return false
  return (
    !isEmptyText(item.title) ||
    !isEmptyText(item.desc) ||
    !isEmptyText(item.url) ||
    Boolean(asRecord(item.imageFile)?.path)
  )
}

/** 判断区块在编辑器清理语义下是否为空（含 spacer/divider/footer 等）。 */
export function isEmptyBlock(block: BlockNode): boolean {
  const propsObj = asRecord(block.props) ?? {}

  if (block.type === 'layout') {
    const children = Array.isArray(propsObj.children) ? propsObj.children : []
    if (children.length === 0) return true
    return children.every((it) => {
      const child = asRecord(it)
      if (!child || typeof child.id !== 'string' || typeof child.type !== 'string') return true
      return isEmptyBlock(it as BlockNode)
    })
  }
  if (block.type === 'spacer') return true
  if (block.type === 'heading') return isEmptyText(propsObj.text)
  if (block.type === 'text') return isEmptyText(propsObj.text)
  if (block.type === 'divider') return isEmptyText(propsObj.text)
  if (block.type === 'footer') return isEmptyText(propsObj.text)
  if (block.type === 'embed') return isEmptyText(propsObj.url)
  if (block.type === 'image') return !hasValidImage(propsObj)
  if (block.type === 'imageGallery') {
    const items = Array.isArray(propsObj.items) ? propsObj.items : []
    if (items.length === 0) return true
    return items.every((it) => {
      const item = asRecord(it)
      if (!item) return true
      const hasFile = Boolean(item.imageFile)
      const url = typeof item.url === 'string' ? item.url.trim() : ''
      return !hasFile && url.length === 0
    })
  }
  if (block.type === 'links' || block.type === 'buttons') {
    const items = Array.isArray(propsObj.items) ? propsObj.items : []
    return !items.some(hasValidButtonItem)
  }
  if (block.type === 'button') {
    return !hasValidButtonItem(propsObj)
  }
  if (block.type === 'cardList') {
    const items = Array.isArray(propsObj.items) ? propsObj.items : []
    return !items.some(hasValidCardListItem)
  }
  if (block.type === 'richText') {
    const imagesFile = Array.isArray(propsObj.imagesFile) ? propsObj.imagesFile : []
    return imagesFile.length === 0 && isEmptyRichText(propsObj.html)
  }
  if (block.type === 'profile') {
    const hasAny = !!propsObj.avatarFile || !isEmptyText(propsObj.displayName) || !isEmptyText(propsObj.bio)
    return !hasAny
  }
  if (block.type === 'tags') {
    const items = Array.isArray(propsObj.items) ? propsObj.items : []
    return !items.some((it) => {
      const item = asRecord(it)
      return !isEmptyText(item?.text)
    })
  }
  if (block.type === 'socialLinks') {
    const items = Array.isArray(propsObj.items) ? propsObj.items : []
    return !items.some((it) => {
      const item = asRecord(it)
      const url = typeof item?.url === 'string' ? item.url.trim() : ''
      return url.length > 0 && url !== 'https://'
    })
  }
  if (block.type === 'videoList') {
    const source = String(propsObj.source || 'manual')
    if (source === 'userIndex') return false
    const items = Array.isArray(propsObj.items) ? propsObj.items : []
    return !items.some((it) => {
      const item = asRecord(it)
      const url = typeof item?.url === 'string' ? item.url.trim() : ''
      return url.length > 0 && url !== 'https://'
    })
  }
  if (block.type === 'musicPlayer') return isEmptyText(propsObj.url)
  if (block.type === 'faq') {
    const items = Array.isArray(propsObj.items) ? propsObj.items : []
    return !items.some((it) => {
      const item = asRecord(it)
      return !isEmptyText(item?.q) || !isEmptyText(item?.a)
    })
  }
  if (block.type === 'milestone') {
    const items = Array.isArray(propsObj.items) ? propsObj.items : []
    return !items.some((it) => {
      const item = asRecord(it)
      return !isEmptyText(item?.date) || !isEmptyText(item?.title) || !isEmptyText(item?.description)
    })
  }
  if (block.type === 'quote') return isEmptyText(propsObj.text)
  if (block.type === 'marquee') return isEmptyText(propsObj.text)
  if (block.type === 'countdown') return isEmptyText(propsObj.target)
  if (block.type === 'feedback') return isEmptyText(propsObj.url)
  if (block.type === 'supporter') {
    const items = Array.isArray(propsObj.items) ? propsObj.items : []
    return !items.some((it) => {
      const item = asRecord(it)
      const url = typeof item?.url === 'string' ? item.url.trim() : ''
      return url.length > 0 && url !== 'https://'
    })
  }
  return false
}

const PUBLIC_SKIP_WHEN_EMPTY_TYPES = new Set<BlockNode['type']>([
  'buttons',
  'links',
  'button',
  'tags',
  'socialLinks',
  'cardList',
  'heading',
  'text',
  'richText',
  'image',
])

/**
 * 判断区块在公开展示态是否应跳过渲染，避免空容器产生多余空白与 gap。
 * 保留 spacer/divider/footer 及动态数据源区块，不误杀刻意放置的装饰或实时组件。
 */
export function isBlockEmptyInPublicView(block: BlockNode, visibilityContext?: BlockVisibilityContext): boolean {
  if (block.type === 'layout') {
    const propsObj = asRecord(block.props) ?? {}
    const children = Array.isArray(propsObj.children) ? propsObj.children : []
    return children.every((it) => {
      const child = asRecord(it)
      if (!child || typeof child.id !== 'string' || typeof child.type !== 'string') return true
      const childBlock = it as BlockNode
      if (childBlock.hidden) return true
      if (visibilityContext && !isBlockVisible(childBlock, visibilityContext)) return true
      return isBlockEmptyInPublicView(childBlock, visibilityContext)
    })
  }
  if (!PUBLIC_SKIP_WHEN_EMPTY_TYPES.has(block.type)) return false
  return isEmptyBlock(block)
}
