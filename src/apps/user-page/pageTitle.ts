import type { BlockNode } from './block/schema'
import type { UserPageConfig } from './types'

const TITLED_BLOCK_TYPES = new Set([
  'commission',
  'ocProfile',
  'alert',
  'faq',
  'milestone',
  'countdown',
  'feedback',
  'supporter',
  'danmakuVote',
  'queueStatus',
  'voiceBoard',
  'biliVideos',
  'biliDynamics',
  'videoList',
  'qrcode',
  'embed',
])

function asRecord(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  return v as Record<string, unknown>
}

function normalizeTitle(v: unknown): string {
  if (typeof v !== 'string') return ''
  return v.replace(/\s+/g, ' ').trim()
}

function extractRichTextHeading(html: unknown): string {
  if (typeof html !== 'string' || !html.includes('<h')) return ''
  const match = /<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i.exec(html)
  if (!match) return ''
  return normalizeTitle(match[1].replace(/<[^>]+>/g, ''))
}

function extractBlockFallbackTitle(blocks: BlockNode[]): string | null {
  let secondaryTitle = ''

  const walk = (nodes: unknown[]): string | null => {
    for (const raw of nodes) {
      const node = asRecord(raw)
      if (!node || typeof node.type !== 'string' || node.hidden === true) continue
      const props = asRecord(node.props) ?? {}

      if (node.type === 'layout') {
        const children = Array.isArray(props.children) ? props.children : []
        const found = walk(children)
        if (found) return found
        continue
      }

      if (node.type === 'heading') {
        const text = normalizeTitle(props.text)
        if (text) return text
        continue
      }

      if (secondaryTitle) continue

      if (TITLED_BLOCK_TYPES.has(node.type)) {
        const title = normalizeTitle(props.title)
        if (title) {
          secondaryTitle = title
          continue
        }
        if (node.type === 'ocProfile') {
          const characterName = normalizeTitle(props.characterName)
          if (characterName) {
            secondaryTitle = characterName
            continue
          }
        }
      }

      if (node.type === 'profile') {
        const displayName = normalizeTitle(props.displayName)
        if (displayName) {
          secondaryTitle = displayName
          continue
        }
      }

      if (node.type === 'richText') {
        const heading = extractRichTextHeading(props.html)
        if (heading) {
          secondaryTitle = heading
        }
      }
    }
    return null
  }

  return walk(blocks) ?? (secondaryTitle || null)
}

/** 解析公开展示子页的显示标题：优先使用显式配置的 title，未配置时从区块内容自动提取主标题。 */
export function resolveUserPageTitle(cfg: UserPageConfig | null | undefined): string | null {
  const explicit = normalizeTitle(cfg?.title)
  if (explicit) return explicit
  if (cfg?.mode === 'block' && Array.isArray(cfg.block?.blocks)) {
    return extractBlockFallbackTitle(cfg.block.blocks)
  }
  return null
}

/** 解析公开导航栏与预览壳层中自定义子页的显示名称。 */
export function resolveUserPageNavLabel(slug: string, cfg: UserPageConfig | null | undefined): string {
  return resolveUserPageTitle(cfg) ?? slug
}
