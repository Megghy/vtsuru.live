import { generate, parse, walk } from 'css-tree'
import type { CssNode } from 'css-tree'

import { resolveFileUrl } from '@/shared/config'

import type { CustomHtmlAsset } from './customHtmlContract'

const ALLOWED_AT_RULES = new Set(['container', 'keyframes', 'media', 'supports'])
const MAX_CSS_RULES = 2000
const MAX_CSS_DECLARATIONS = 8000
const STYLE_BLOCK_RE = /<style\b[^>]*>([\s\S]*?)<\/style>/gi
const ASSET_ATTR_RE = /data-vtsuru-asset\s*=\s*["']([a-z0-9-]+)["']/gi
const ASSET_VAR_RE = /var\(\s*--vtsuru-asset-([a-z0-9-]+)/gi
const ASSET_CALL_RE = /getAssetUrl\(\s*["']([a-z0-9-]+)["']/g

export interface CustomCodeIssue {
  field: 'source' | 'css' | 'assets'
  message: string
  line: number
  column: number
}

export interface CustomHtmlTheme {
  fg: string
  fgMuted: string
  bg: string
  bgElevated: string
  border: string
  primary: string
  primaryReadable: string
  radius: string
  borderWidth?: string
  borderStyle?: string
  shadow?: string
  colorScheme: string
}

export interface CompiledCustomVueOutput {
  js: string
  css: string
}

function locationOf(node: CssNode) {
  return { line: node.loc?.start.line ?? 1, column: node.loc?.start.column ?? 1 }
}

function issue(field: CustomCodeIssue['field'], message: string, line = 1, column = 1): CustomCodeIssue {
  return { field, message, line, column }
}

function isSafeAssetPath(value: string) {
  const path = value.trim()
  if (!path || path.startsWith('//')) return false
  if (path.startsWith('/')) return true
  try {
    const url = new URL(path)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
  } catch {
    return false
  }
}

export function resolveCustomHtmlAssetMap(assets: CustomHtmlAsset[]) {
  return new Map(
    assets
      .filter((asset) => isSafeAssetPath(asset.file.path))
      .map((asset) => [asset.key, { ...asset.file, path: resolveFileUrl(asset.file.path) }]),
  )
}

export function extractSfcStyleBlocks(source: string) {
  return [...source.matchAll(STYLE_BLOCK_RE)].map((match) => match[1])
}

export function collectCustomHtmlAssetKeys(source: string) {
  const keys = new Set<string>()
  for (const match of source.matchAll(ASSET_ATTR_RE)) keys.add(match[1])
  for (const match of source.matchAll(ASSET_VAR_RE)) keys.add(match[1])
  for (const match of source.matchAll(ASSET_CALL_RE)) keys.add(match[1])
  return keys
}

export function inspectCustomCss(css: string, assets?: CustomHtmlAsset[]) {
  const issues: CustomCodeIssue[] = []
  if (!css.trim()) return { css: '', issues }
  let ast: CssNode
  try {
    ast = parse(css, { positions: true, parseValue: true, parseCustomProperty: true })
  } catch (error) {
    const syntaxError = error as { message: string; line?: number; column?: number }
    return { css: '', issues: [issue('css', syntaxError.message, syntaxError.line, syntaxError.column)] }
  }

  let rules = 0
  let declarations = 0
  walk(ast, (node) => {
    if (node.type === 'Atrule') {
      const name = node.name.toLowerCase()
      const { line, column } = locationOf(node)
      if (name === 'import' || !ALLOWED_AT_RULES.has(name)) {
        issues.push(issue('css', name === 'import' ? '不允许使用 @import' : `不允许使用 @${name}`, line, column))
      }
    }
    if (node.type === 'Rule') rules += 1
    if (node.type === 'Declaration') {
      declarations += 1
      const name = node.property.toLowerCase()
      const value = css.slice(node.value.loc?.start.offset ?? 0, node.value.loc?.end.offset ?? 0)
      if (name === 'behavior' || name === '-moz-binding') {
        issues.push(issue('css', `不允许使用属性 ${name}`, locationOf(node).line, locationOf(node).column))
      }
      if (/url\s*\(/i.test(value)) {
        issues.push(issue('css', '不允许直接加载 URL', locationOf(node).line, locationOf(node).column))
      }
      if (/expression\s*\(/i.test(value)) {
        issues.push(issue('css', '不允许使用 expression()', locationOf(node).line, locationOf(node).column))
      }
    }
  })
  if (rules > MAX_CSS_RULES) issues.push(issue('css', `规则不能超过 ${MAX_CSS_RULES} 条`))
  if (declarations > MAX_CSS_DECLARATIONS) issues.push(issue('css', `声明不能超过 ${MAX_CSS_DECLARATIONS} 条`))
  if (assets) {
    for (const key of collectCustomHtmlAssetKeys(css)) {
      if (!resolveCustomHtmlAssetMap(assets).has(key)) issues.push(issue('assets', `找不到资源键：${key}`))
    }
  }
  return { css: issues.length ? '' : generate(ast), issues }
}

export function inspectCustomSource(source: string, assets: CustomHtmlAsset[]) {
  const issues: CustomCodeIssue[] = []
  const files = resolveCustomHtmlAssetMap(assets)
  for (const key of collectCustomHtmlAssetKeys(source)) {
    if (!files.has(key)) issues.push(issue('assets', `找不到资源键：${key}`))
  }
  for (const css of extractSfcStyleBlocks(source)) issues.push(...inspectCustomCss(css).issues)
  return issues
}
