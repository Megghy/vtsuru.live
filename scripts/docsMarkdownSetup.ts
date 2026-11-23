import fs from 'node:fs/promises'

import matter from 'gray-matter'
import type { Highlighter } from 'shiki'
import type { Plugin } from 'vite'

let highlighterPromise: Promise<Highlighter> | null = null

const SUPPORTED_LANGS = [
  'ts',
  'typescript',
  'js',
  'javascript',
  'vue',
  'html',
  'css',
  'json',
  'bash',
  'shell',
  'yaml',
  'markdown',
  'md',
] as const

async function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = import('shiki').then(({ createHighlighter }) =>
      createHighlighter({
        themes: ['github-light', 'github-dark'],
        langs: [...SUPPORTED_LANGS],
      }),
    )
  }
  return highlighterPromise
}

/**
 * 将标题文本转换为稳定的 URL 锚点 slug，兼容中文与英文字符。
 */
export function slugifyHeading(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[\s]+/g, '-')
    .replace(/[^\p{L}\p{N}_-]+/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * 为 markdown-exit 实例配置文档中心所需的标题锚点、懒加载图片与 Shiki 双主题高亮。
 */
export async function setupDocsMarkdown(md: any) {
  const highlighter = await getHighlighter()
  const loadedLangs = new Set<string>(SUPPORTED_LANGS)

  // 1. Shiki 构建期高亮（支持亮/暗双主题 CSS 变量切换）
  const origHighlight = md.options?.highlight
  md.options = md.options || {}
  md.options.highlight = (code: string, lang: string) => {
    const normalized = (lang || '').trim().toLowerCase() || 'text'
    if (normalized === 'text' || normalized === 'plaintext' || !loadedLangs.has(normalized)) {
      if (origHighlight) return origHighlight(code, lang, '')
      return ''
    }
    return highlighter.codeToHtml(code, {
      lang: normalized,
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
      defaultColor: false,
    })
  }

  // 2. 为 h2/h3/h4 标题注入唯一 id（配合前端 TOC 跳转与 IntersectionObserver）
  md.core.ruler.push('vtsuru_heading_anchors', (state: any) => {
    const usedIds = new Map<string, number>()
    const tokens = state.tokens
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]
      if (token.type !== 'heading_open') continue
      if (token.tag !== 'h2' && token.tag !== 'h3' && token.tag !== 'h4') continue

      const inlineToken = tokens[i + 1]
      const rawText =
        inlineToken?.children
          ?.filter((child: any) => child.type === 'text' || child.type === 'code_inline')
          .map((child: any) => child.content)
          .join('') ?? ''

      const baseSlug = slugifyHeading(rawText) || `section-${i}`
      const count = usedIds.get(baseSlug) ?? 0
      usedIds.set(baseSlug, count + 1)
      const finalSlug = count === 0 ? baseSlug : `${baseSlug}-${count + 1}`

      token.attrSet('id', finalSlug)
    }
  })

  // 3. 图片默认开启 lazy + async 解码
  const defaultImageRender =
    md.renderer.rules.image ||
    ((tokens: any[], idx: number, options: any, _env: any, self: any) => self.renderToken(tokens, idx, options))

  md.renderer.rules.image = (tokens: any[], idx: number, options: any, env: any, self: any) => {
    const token = tokens[idx]
    if (token.attrIndex('loading') < 0) token.attrSet('loading', 'lazy')
    if (token.attrIndex('decoding') < 0) token.attrSet('decoding', 'async')
    return defaultImageRender(tokens, idx, options, env, self)
  }
}

/**
 * 拦截 `.md?doc-meta` 请求，仅提取并返回 YAML frontmatter JSON，避免把完整文档组件打入首屏。
 */
export function docsFrontmatterMetaPlugin(): Plugin {
  const PREFIX = '\0vtsuru-doc-meta:'
  const SUFFIX = '.js'
  return {
    name: 'vtsuru-docs-frontmatter-meta',
    enforce: 'pre',
    async resolveId(source, importer) {
      const qIdx = source.indexOf('?')
      if (qIdx < 0) return null
      const rawPath = source.slice(0, qIdx)
      if (!rawPath.endsWith('.md')) return null
      const params = new URLSearchParams(source.slice(qIdx + 1))
      if (!params.has('doc-meta')) return null
      const resolved = await this.resolve(rawPath, importer, { skipSelf: true })
      if (!resolved) return null
      return `${PREFIX}${resolved.id}${SUFFIX}`
    },
    async load(id) {
      if (!id.startsWith(PREFIX)) return null
      const filePath = id.slice(PREFIX.length, -SUFFIX.length)
      this.addWatchFile(filePath)
      const raw = await fs.readFile(filePath, 'utf-8')
      const { data } = matter(raw)
      return `export default ${JSON.stringify(data)}`
    },
  }
}
