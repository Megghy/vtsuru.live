import type { Component } from 'vue'

import type {
  DocCategoryGroup,
  DocCategoryId,
  DocCategoryMeta,
  DocEntry,
  DocFrontmatter,
  DocSearchResult,
} from './types'

export const DOC_CATEGORIES: readonly DocCategoryMeta[] = [
  {
    id: 'getting-started',
    title: '快速上手',
    description: '从账号绑定到第一个 OBS 画面跑起来，顺便认识一下桌面客户端',
    order: 10,
  },
  {
    id: 'obs',
    title: 'OBS 场景与挂件',
    description: '多场景画布编排、弹幕机、PNGtuber 与 20+ 纯前端透明小挂件',
    order: 20,
  },
  {
    id: 'live',
    title: '直播互动与播控',
    description: '四栏直播中控台、多引擎读弹幕、点歌排队与投票抽奖玩法',
    order: 30,
  },
  {
    id: 'client',
    title: '桌面客户端进阶',
    description: '自动回复感谢、JS 脚本沙箱、VTube Studio 联动与本地语音转写',
    order: 35,
  },
  {
    id: 'page',
    title: '个人主页与社区',
    description: '44 种积木拼装主页、日程歌单模板、棉花糖提问箱与讨论区',
    order: 40,
  },
  {
    id: 'ops',
    title: '运营与数据分析',
    description: '积分兑换商城、直播收益洞察、场次语音复盘与创作者工具箱',
    order: 50,
  },
]

const CATEGORY_MAP = new Map<DocCategoryId, DocCategoryMeta>(DOC_CATEGORIES.map((c) => [c.id, c]))

const mdFrontmatters = import.meta.glob('@/content/docs/**/*.md', {
  eager: true,
  query: '?doc-meta',
  import: 'default',
}) as Record<string, DocFrontmatter | undefined>

const mdComponents = import.meta.glob<{ default: Component }>('@/content/docs/**/*.md')

const mdRawLoaders = import.meta.glob('@/content/docs/**/*.md', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>

function pathToSlug(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  const marker = '/content/docs/'
  const idx = normalized.indexOf(marker)
  const rel = idx >= 0 ? normalized.slice(idx + marker.length) : normalized
  return rel.replace(/\.md$/i, '')
}

function inferCategory(slug: string, explicit?: DocCategoryId): DocCategoryId {
  if (explicit && CATEGORY_MAP.has(explicit)) return explicit
  const firstSegment = slug.split('/')[0] as DocCategoryId
  if (CATEGORY_MAP.has(firstSegment)) return firstSegment
  return 'getting-started'
}

export const ALL_DOCS: readonly DocEntry[] = Object.entries(mdFrontmatters)
  .map(([path, fm]) => {
    const slug = pathToSlug(path)
    const loader = mdComponents[path]
    const category = inferCategory(slug, fm?.category)
    return {
      slug,
      title: fm?.title || slug,
      description: fm?.description || '',
      category,
      order: typeof fm?.order === 'number' ? fm.order : 100,
      badge: fm?.badge,
      tags: Array.isArray(fm?.tags) ? fm.tags : [],
      manageRoute: fm?.manageRoute,
      manageLabel: fm?.manageLabel,
      updatedAt: fm?.updatedAt,
      loadComponent: loader,
    } satisfies DocEntry
  })
  .filter((item) => Boolean(item.loadComponent))
  .toSorted((a, b) => {
    const catA = CATEGORY_MAP.get(a.category)?.order ?? 999
    const catB = CATEGORY_MAP.get(b.category)?.order ?? 999
    if (catA !== catB) return catA - catB
    if (a.order !== b.order) return a.order - b.order
    return a.title.localeCompare(b.title, 'zh-CN')
  })

export const DOC_GROUPS: readonly DocCategoryGroup[] = DOC_CATEGORIES.map((cat) => ({
  ...cat,
  items: ALL_DOCS.filter((doc) => doc.category === cat.id),
})).filter((group) => group.items.length > 0)

export function getDocCategory(id: DocCategoryId): DocCategoryMeta {
  return CATEGORY_MAP.get(id) ?? DOC_CATEGORIES[0]
}

export function getDocBySlug(slug: string): DocEntry | undefined {
  const clean = slug.replace(/^\/+|\/+$/g, '')
  return ALL_DOCS.find((doc) => doc.slug === clean)
}

export function getPrevNextDocs(slug: string): { prev?: DocEntry; next?: DocEntry } {
  const clean = slug.replace(/^\/+|\/+$/g, '')
  const idx = ALL_DOCS.findIndex((doc) => doc.slug === clean)
  if (idx < 0) return {}
  return {
    prev: idx > 0 ? ALL_DOCS[idx - 1] : undefined,
    next: idx < ALL_DOCS.length - 1 ? ALL_DOCS[idx + 1] : undefined,
  }
}

const rawTextCache = new Map<string, string>()

function stripMarkdownToPlainText(raw: string): string {
  return raw
    .replace(/^---[\s\S]*?---\s*/m, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#>*`_~|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function ensureRawIndexLoaded(): Promise<void> {
  if (rawTextCache.size === Object.keys(mdRawLoaders).length) return
  await Promise.all(
    Object.entries(mdRawLoaders).map(async ([path, load]) => {
      const slug = pathToSlug(path)
      if (rawTextCache.has(slug)) return
      const raw = await load()
      rawTextCache.set(slug, stripMarkdownToPlainText(raw))
    }),
  )
}

function buildSnippet(plainText: string, keyword: string): string {
  if (!plainText) return ''
  const lower = plainText.toLowerCase()
  const idx = lower.indexOf(keyword)
  if (idx < 0) return plainText.slice(0, 96) + (plainText.length > 96 ? '...' : '')
  const start = Math.max(0, idx - 28)
  const end = Math.min(plainText.length, idx + keyword.length + 68)
  return `${start > 0 ? '...' : ''}${plainText.slice(start, end)}${end < plainText.length ? '...' : ''}`
}

/**
 * 检索文档标题、描述、标签与正文纯文本；首次检索时懒加载 `?raw` 文档缓存。
 */
export async function searchDocs(query: string): Promise<DocSearchResult[]> {
  const keyword = query.trim().toLowerCase()
  if (!keyword) {
    return ALL_DOCS.map((entry) => ({
      entry,
      categoryTitle: getDocCategory(entry.category).title,
      snippet: entry.description,
      score: 1,
    }))
  }

  await ensureRawIndexLoaded()

  const results: DocSearchResult[] = []
  for (const entry of ALL_DOCS) {
    const titleLower = entry.title.toLowerCase()
    const descLower = entry.description.toLowerCase()
    const tagsLower = entry.tags.join(' ').toLowerCase()
    const bodyText = rawTextCache.get(entry.slug) ?? ''
    const bodyLower = bodyText.toLowerCase()

    let score = 0
    if (titleLower.includes(keyword)) score += 10
    if (tagsLower.includes(keyword)) score += 6
    if (descLower.includes(keyword)) score += 4
    if (bodyLower.includes(keyword)) score += 2

    if (score > 0) {
      results.push({
        entry,
        categoryTitle: getDocCategory(entry.category).title,
        snippet: bodyLower.includes(keyword) ? buildSnippet(bodyText, keyword) : entry.description,
        score,
      })
    }
  }

  return results.toSorted((a, b) => b.score - a.score)
}
