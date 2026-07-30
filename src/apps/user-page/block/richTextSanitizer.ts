import DOMPurify from 'dompurify'

const ALLOWED_TAGS = [
  'p',
  'br',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'div',
  'span',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'del',
  'code',
  'pre',
  'blockquote',
  'ul',
  'ol',
  'li',
  'a',
  'img',
  'hr',
]

function isSafeUrl(value: string, allowFragment: boolean) {
  const url = value.trim()
  if (!url || url.startsWith('//')) return false
  if (url.startsWith('/')) return true
  if (allowFragment && (url.startsWith('#') || url.startsWith('?'))) return true
  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return !url.includes(':')
  }
}

function isSafeColor(value: string) {
  const normalized = value.trim().toLowerCase()
  return (
    /^var\(--[a-z0-9_-]+\)$/.test(normalized) ||
    /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(normalized) ||
    /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/.test(normalized) ||
    /^hsla?\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/.test(normalized)
  )
}

function isSafeLength(value: string) {
  const match = value
    .trim()
    .toLowerCase()
    .match(/^(\d+(?:\.\d+)?)(px|em|rem|%)$/)
  if (!match) return false
  const size = Number(match[1])
  if (match[2] === 'px') return size >= 8 && size <= 72
  if (match[2] === '%') return size >= 50 && size <= 220
  return size >= 0.75 && size <= 3.5
}

function isSafeLineHeight(value: string) {
  const normalized = value.trim().toLowerCase()
  if (/^\d+(?:\.\d+)?$/.test(normalized)) {
    const size = Number(normalized)
    return size >= 0.8 && size <= 3
  }
  const match = normalized.match(/^(\d+(?:\.\d+)?)(px|%)$/)
  if (!match) return false
  const size = Number(match[1])
  return match[2] === 'px' ? size >= 10 && size <= 96 : size >= 80 && size <= 300
}

function sanitizeStyle(styleText: string, alignment = '') {
  const safe = new Map<string, string>()
  styleText.split(';').forEach((declaration) => {
    const separator = declaration.indexOf(':')
    if (separator < 0) return
    const property = declaration.slice(0, separator).trim().toLowerCase()
    const value = declaration.slice(separator + 1).trim()
    if (
      property === 'text-align' &&
      ['left', 'center', 'right', 'justify', 'start', 'end'].includes(value.toLowerCase())
    )
      safe.set(property, value.toLowerCase())
    else if ((property === 'color' || property === 'background-color') && isSafeColor(value)) safe.set(property, value)
    else if (property === 'font-size' && isSafeLength(value)) safe.set(property, value)
    else if (property === 'line-height' && isSafeLineHeight(value)) safe.set(property, value)
  })
  if (!safe.has('text-align') && ['left', 'center', 'right', 'justify'].includes(alignment))
    safe.set('text-align', alignment)
  return [...safe].map(([property, value]) => `${property}:${value}`).join(';')
}

export function sanitizeRichText(input: string): string {
  if (!input.trim()) return ''
  const fragment = DOMPurify.sanitize(input, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ['href', 'src', 'alt', 'style', 'class'],
    ALLOW_DATA_ATTR: false,
    RETURN_DOM_FRAGMENT: true,
  })

  fragment.querySelectorAll<HTMLElement>('*').forEach((element) => {
    const alignment =
      [...element.classList]
        .find((className) => className.startsWith('ql-align-'))
        ?.slice('ql-align-'.length)
        .toLowerCase() ?? ''
    element.removeAttribute('class')

    const style = sanitizeStyle(element.getAttribute('style') ?? '', alignment)
    if (style) element.setAttribute('style', style)
    else element.removeAttribute('style')

    if (element instanceof HTMLAnchorElement) {
      const href = element.getAttribute('href') ?? ''
      if (!isSafeUrl(href, true)) element.removeAttribute('href')
      if (element.hasAttribute('href')) {
        element.target = '_blank'
        element.rel = 'noopener noreferrer'
      }
    }

    if (element instanceof HTMLImageElement) {
      const src = element.getAttribute('src') ?? ''
      if (!isSafeUrl(src, false)) {
        element.remove()
        return
      }
      element.setAttribute('loading', 'lazy')
      element.setAttribute('decoding', 'async')
    }
  })

  const container = document.createElement('div')
  container.append(fragment)
  return container.innerHTML
}
