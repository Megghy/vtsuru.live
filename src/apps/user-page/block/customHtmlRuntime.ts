import { generate, parse, walk } from 'css-tree'
import type { CssNode } from 'css-tree'
import DOMPurify from 'dompurify'

import { FILE_BASE_URL, getCurrentAPIUrl, resolveFileUrl } from '@/shared/config'

import { createSandboxSdkSource } from '../runtime/customHtmlBridge'
import type { CustomHtmlAsset, CustomHtmlProps } from './customHtmlContract'

const ALLOWED_TAGS = [
  'a',
  'article',
  'abbr',
  'aside',
  'b',
  'blockquote',
  'br',
  'caption',
  'canvas',
  'code',
  'dd',
  'div',
  'dl',
  'dialog',
  'details',
  'dt',
  'em',
  'fieldset',
  'figcaption',
  'figure',
  'form',
  'footer',
  'legend',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'i',
  'img',
  'li',
  'main',
  'mark',
  'meter',
  'nav',
  'optgroup',
  'option',
  'ol',
  'p',
  'pre',
  'progress',
  'rp',
  'rt',
  'ruby',
  'samp',
  's',
  'section',
  'small',
  'select',
  'span',
  'strong',
  'summary',
  'textarea',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'time',
  'var',
  'u',
  'ul',
  'button',
  'input',
  'label',
  'lineargradient',
  'radialgradient',
  'svg',
  'g',
  'path',
  'circle',
  'ellipse',
  'line',
  'polygon',
  'polyline',
  'rect',
  'text',
  'tspan',
  'defs',
  'stop',
  'clippath',
  'mask',
  'pattern',
  'use',
  'symbol',
  'view',
] as const
const ALLOWED_TAG_SET = new Set<string>(ALLOWED_TAGS)
const GLOBAL_ATTRIBUTES = new Set([
  'aria-describedby',
  'aria-label',
  'aria-labelledby',
  'aria-hidden',
  'aria-expanded',
  'aria-current',
  'aria-selected',
  'aria-controls',
  'aria-live',
  'class',
  'id',
  'role',
  'tabindex',
  'title',
])
const FORM_ATTRIBUTES = new Set([
  'type',
  'value',
  'placeholder',
  'disabled',
  'readonly',
  'checked',
  'selected',
  'multiple',
  'name',
  'for',
  'min',
  'max',
  'step',
  'maxlength',
  'minlength',
  'rows',
  'cols',
  'autocomplete',
])
const SVG_ATTRIBUTES = new Set([
  'viewbox',
  'xmlns',
  'fill',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-dasharray',
  'stroke-dashoffset',
  'd',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'points',
  'transform',
  'opacity',
  'fill-opacity',
  'stroke-opacity',
  'fill-rule',
  'clip-rule',
  'gradientunits',
  'gradienttransform',
  'offset',
  'stop-color',
  'stop-opacity',
  'preserveaspectratio',
])
const TAG_ATTRIBUTES: Record<string, Set<string>> = {
  a: new Set(['href']),
  img: new Set(['alt', 'data-vtsuru-asset', 'height', 'width']),
  td: new Set(['colspan', 'rowspan']),
  th: new Set(['colspan', 'rowspan', 'scope']),
}
const ALLOWED_AT_RULES = new Set(['container', 'keyframes', 'media', 'supports'])
const MAX_CSS_RULES = 2000
const MAX_CSS_DECLARATIONS = 8000

export interface CustomCodeIssue {
  field: 'html' | 'css' | 'js' | 'assets'
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

function locationOf(node: CssNode) {
  return { line: node.loc?.start.line ?? 1, column: node.loc?.start.column ?? 1 }
}

function issue(field: CustomCodeIssue['field'], message: string, line = 1, column = 1): CustomCodeIssue {
  return { field, message, line, column }
}

function isSafeLink(value: string) {
  const target = value.trim()
  if (!target || target.startsWith('//')) return false
  if (target.startsWith('#') || (target.startsWith('/') && !target.startsWith('//'))) return true
  try {
    const url = new URL(target)
    return url.protocol === 'https:' && !url.username && !url.password
  } catch {
    return false
  }
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

function assetMap(assets: CustomHtmlAsset[]) {
  return new Map(
    assets
      .filter((asset) => isSafeAssetPath(asset.file.path))
      .map((asset) => [asset.key, { ...asset.file, path: resolveFileUrl(asset.file.path) }]),
  )
}

export function inspectCustomHtml(html: string, assets: CustomHtmlAsset[]): CustomCodeIssue[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const files = assetMap(assets)
  const issues: CustomCodeIssue[] = []

  const elements = [...doc.head.querySelectorAll('*'), ...doc.body.querySelectorAll('*')]
  elements.forEach((element) => {
    const tag = element.tagName.toLowerCase()
    if (!ALLOWED_TAG_SET.has(tag)) issues.push(issue('html', `<${tag}> 不允许使用`))

    for (const attribute of element.attributes) {
      const name = attribute.name.toLowerCase()
      const allowed =
        GLOBAL_ATTRIBUTES.has(name) ||
        FORM_ATTRIBUTES.has(name) ||
        SVG_ATTRIBUTES.has(name) ||
        /^data-[a-z0-9_-]+$/.test(name) ||
        TAG_ATTRIBUTES[tag]?.has(name)
      if (!allowed) issues.push(issue('html', `<${tag}> 不允许使用属性 ${name}`))
    }

    if (
      element instanceof HTMLAnchorElement &&
      element.hasAttribute('href') &&
      !isSafeLink(element.getAttribute('href') ?? '')
    ) {
      issues.push(issue('html', '链接只允许 HTTPS、站内相对地址或当前组件锚点'))
    }
    if (element instanceof HTMLImageElement) {
      const key = element.dataset.vtsuruAsset ?? ''
      if (!key) issues.push(issue('html', '图片必须使用 data-vtsuru-asset 指定资源键'))
      else if (!files.has(key)) issues.push(issue('assets', `找不到资源键：${key}`))
    }
  })
  return issues
}

export function inspectCustomCss(css: string, assets?: CustomHtmlAsset[]) {
  const issues: CustomCodeIssue[] = []
  const files = assets ? assetMap(assets) : null
  const missingAssetKeys = new Set<string>()
  let ast: CssNode
  try {
    ast = parse(css, {
      positions: true,
      parseCustomProperty: true,
      onParseError(error, fallbackNode) {
        const position = locationOf(fallbackNode)
        issues.push(issue('css', error.message, position.line, position.column))
      },
    })
  } catch (error) {
    const syntaxError = error as SyntaxError & { line?: number; column?: number }
    return { css: '', issues: [issue('css', syntaxError.message, syntaxError.line, syntaxError.column)] }
  }

  let ruleCount = 0
  let declarationCount = 0
  walk(ast, (node) => {
    const position = locationOf(node)
    if (node.type === 'Raw') issues.push(issue('css', '包含无法解析的 CSS', position.line, position.column))
    if (node.type === 'Url')
      issues.push(issue('css', 'CSS 不允许直接加载 URL，请使用资源变量', position.line, position.column))
    if (node.type === 'Atrule' && !ALLOWED_AT_RULES.has(node.name.toLowerCase())) {
      issues.push(issue('css', `不允许使用 @${node.name}`, position.line, position.column))
    }
    if (node.type === 'Function' && node.name.toLowerCase() === 'expression') {
      issues.push(issue('css', '不允许使用 expression()', position.line, position.column))
    }
    if (files && node.type === 'Function' && node.name.toLowerCase() === 'var') {
      const match = generate(node).match(/^var\(--vtsuru-asset-([a-z0-9-]+)(?:,|\))/)
      const key = match?.[1]
      if (key && !files.has(key) && !missingAssetKeys.has(key)) {
        missingAssetKeys.add(key)
        issues.push(issue('assets', `找不到资源键：${key}`, position.line, position.column))
      }
    }
    if (node.type === 'Declaration') {
      declarationCount += 1
      if (['behavior', '-moz-binding'].includes(node.property.toLowerCase())) {
        issues.push(issue('css', `不允许使用属性 ${node.property}`, position.line, position.column))
      }
    }
    if (node.type === 'Rule') ruleCount += 1
  })

  if (ruleCount > MAX_CSS_RULES) issues.push(issue('css', `CSS 规则不能超过 ${MAX_CSS_RULES} 条`))
  if (declarationCount > MAX_CSS_DECLARATIONS) issues.push(issue('css', `CSS 声明不能超过 ${MAX_CSS_DECLARATIONS} 条`))
  return { css: issues.length ? '' : generate(ast, { mode: 'safe' }), issues }
}

function collectCssAssetKeys(css: string, keys: Set<string>) {
  for (const match of css.matchAll(/var\(\s*--vtsuru-asset-([a-z0-9-]+)/gi)) keys.add(match[1])
}

export function collectCustomHtmlAssetKeys(html: string, css: string) {
  const keys = new Set<string>()
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll<HTMLElement>('[data-vtsuru-asset]').forEach((element) => {
    const key = element.dataset.vtsuruAsset
    if (key) keys.add(key)
  })
  try {
    const ast = parse(css, { parseCustomProperty: true })
    walk(ast, (node) => {
      if (node.type !== 'Function' || node.name.toLowerCase() !== 'var') return
      const match = generate(node).match(/^var\(--vtsuru-asset-([a-z0-9-]+)(?:,|\))/)
      if (match) keys.add(match[1])
    })
  } catch {
    collectCssAssetKeys(css, keys)
  }
  return keys
}

function sanitizeHtml(html: string, assets: CustomHtmlAsset[]) {
  const files = assetMap(assets)
  const fragment = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [...ALLOWED_TAGS],
    ALLOWED_ATTR: [
      ...new Set([
        'alt',
        'aria-label',
        'aria-labelledby',
        'aria-describedby',
        ...GLOBAL_ATTRIBUTES,
        ...FORM_ATTRIBUTES,
        ...SVG_ATTRIBUTES,
        'class',
        'colspan',
        'data-vtsuru-asset',
        'height',
        'href',
        'id',
        'rowspan',
        'scope',
        'title',
        'width',
      ]),
    ],
    ALLOW_ARIA_ATTR: true,
    ALLOW_DATA_ATTR: true,
    RETURN_DOM_FRAGMENT: true,
  })

  fragment.querySelectorAll<HTMLAnchorElement>('a').forEach((anchor) => {
    const href = anchor.getAttribute('href') ?? ''
    if (!isSafeLink(href)) anchor.removeAttribute('href')
    else if (!href.startsWith('#')) {
      anchor.target = '_blank'
      anchor.rel = 'noopener noreferrer'
    }
  })
  fragment.querySelectorAll<HTMLImageElement>('img').forEach((image) => {
    const file = files.get(image.dataset.vtsuruAsset ?? '')
    if (!file) {
      image.removeAttribute('src')
      return
    }
    image.src = file.path
    image.loading = 'lazy'
    image.decoding = 'async'
    image.referrerPolicy = 'no-referrer'
  })

  const container = document.createElement('div')
  container.append(fragment)
  return container.innerHTML
}

function escapeStyleText(value: string) {
  return value.replaceAll('<', '\\3C ')
}

function escapeScriptText(value: string) {
  return value.replace(/<\/script/gi, '<\\/script')
}

function escapeCssString(value: string) {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"')
    .replace(/[\r\n\f]/g, '')
}

function createNonce() {
  return crypto.randomUUID().replaceAll('-', '')
}

function imageSources(assets: CustomHtmlAsset[]) {
  const urls = [...assetMap(assets).values()].map((file) => {
    const url = new URL(file.path, location.href)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
      throw new Error('Invalid asset URL')
    return url.href.replace(/[?#].*$/, '')
  })
  const apiFilePath = new URL('/f/', getCurrentAPIUrl()).href
  return ['data:', 'blob:', 'https://*.hdslb.com', FILE_BASE_URL, apiFilePath, ...urls].join(' ')
}

export function buildCustomHtmlDocument(props: CustomHtmlProps, theme: CustomHtmlTheme) {
  const htmlIssues = inspectCustomHtml(props.html, props.assets)
  const cssResult = inspectCustomCss(props.css, props.assets)
  const safeHtml = sanitizeHtml(props.html, props.assets)
  const assetVariables = [...assetMap(props.assets)]
    .map(([key, file]) => `--vtsuru-asset-${key}:url("${escapeCssString(file.path)}")`)
    .join(';')
  const themeVariables = [
    `--foreground:${theme.fg}`,
    `--muted-foreground:${theme.fgMuted}`,
    `--background:${theme.bg}`,
    `--popover:${theme.bgElevated}`,
    `--border:${theme.border}`,
    `--primary:${theme.primary}`,
    `--primary-readable:${theme.primaryReadable}`,
    `--radius:${theme.radius}`,
    `--border-width:${theme.borderWidth ?? '1px'}`,
    `--border-style:${theme.borderStyle ?? 'solid'}`,
    `--ui-shadow:${theme.shadow ?? 'none'}`,
    assetVariables,
  ]
    .filter(Boolean)
    .join(';')
  const nonce = createNonce()
  const channelId = createNonce()
  const bridge = `(()=>{let frame=0;const send=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>vtsuru.reportHeight(Math.ceil(Math.max(document.body.scrollHeight,document.body.getBoundingClientRect().height))))};new ResizeObserver(send).observe(document.body);addEventListener('load',send);send()})()`
  const assets = Object.fromEntries([...assetMap(props.assets)].map(([key, file]) => [key, file.path]))
  const reportError = `(()=>{const send=error=>parent.postMessage({__vtsuruBridge:true,channelId:${JSON.stringify(channelId)},direction:'error',error:String(error)},'*');addEventListener('error',event=>send(event.message));addEventListener('unhandledrejection',event=>send(event.reason))})()`
  const userScript = `(async()=>{\n${props.js}\n})().catch(error=>{parent.postMessage({__vtsuruBridge:true,channelId:${JSON.stringify(channelId)},direction:'error',error:String(error)},'*')})`
  const baseCss = `:root{${themeVariables};color-scheme:${theme.colorScheme}}*{box-sizing:border-box}html,body{min-width:0;margin:0;padding:0}body{color:var(--foreground);background:transparent;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:0.875rem;line-height:1.5;overflow-wrap:anywhere}img{max-width:100%;height:auto}a{color:var(--primary-readable)}@media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}`

  return {
    issues: [...htmlIssues, ...cssResult.issues],
    channelId,
    srcdoc: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${imageSources(props.assets)}; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; connect-src 'none'; font-src https://fonts.gstatic.com data:; media-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'"><style>${escapeStyleText(baseCss)}\n${escapeStyleText(cssResult.css)}</style></head><body>${safeHtml}<script nonce="${nonce}">${createSandboxSdkSource(channelId, assets)}</script><script nonce="${nonce}">${reportError}</script><script nonce="${nonce}">${bridge}</script><script nonce="${nonce}">${escapeScriptText(userScript)}</script></body></html>`,
  }
}
