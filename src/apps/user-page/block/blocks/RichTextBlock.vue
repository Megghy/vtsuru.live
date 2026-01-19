<script setup lang="ts">
import { computed } from 'vue'
import BlockCard from '../BlockCard.vue'

const props = defineProps<{ blockProps: unknown, userInfo?: unknown, biliInfo?: unknown }>()

function asObject(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== 'object') return null
  if (Array.isArray(v)) return null
  return v as Record<string, unknown>
}

function isSafeUrlString(url: string) {
  if (url.startsWith('//')) return false
  if (url.startsWith('/')) return true
  const colonIndex = url.indexOf(':')
  const slashIndex = url.indexOf('/')
  if (colonIndex !== -1 && (slashIndex === -1 || colonIndex < slashIndex)) {
    try {
      const u = new URL(url)
      return u.protocol === 'https:'
    } catch {
      return false
    }
  }
  return true
}

function sanitizeRichText(input: string) {
  const trimmed = input.trim()
  if (!trimmed) return ''

  function isSafeCssColor(value: string): boolean {
    const v = value.trim().toLowerCase()
    if (!v) return false
    if (/url\s*\(/.test(v)) return false
    if (/^var\(--[a-z0-9_-]+\)$/.test(v)) return true
    if (/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(v)) return true
    if (/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/.test(v)) return true
    if (/^hsla?\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/.test(v)) return true
    return false
  }

  function isSafeCssLength(value: string): boolean {
    const v = value.trim().toLowerCase()
    if (!v) return false
    if (/url\s*\(/.test(v)) return false

    const m = v.match(/^(\d+(?:\.\d+)?)(px|em|rem|%)$/)
    if (!m) return false
    const n = Number(m[1])
    if (!Number.isFinite(n)) return false
    const unit = m[2]
    if (unit === 'px') return n >= 8 && n <= 72
    if (unit === 'em' || unit === 'rem') return n >= 0.75 && n <= 3.5
    if (unit === '%') return n >= 50 && n <= 220
    return false
  }

  function isSafeLineHeight(value: string): boolean {
    const v = value.trim().toLowerCase()
    if (!v) return false
    if (/url\s*\(/.test(v)) return false

    // unitless number
    if (/^\d+(?:\.\d+)?$/.test(v)) {
      const n = Number(v)
      return Number.isFinite(n) && n >= 0.8 && n <= 3
    }

    const m = v.match(/^(\d+(?:\.\d+)?)(px|%)$/)
    if (!m) return false
    const n = Number(m[1])
    if (!Number.isFinite(n)) return false
    const unit = m[2]
    if (unit === 'px') return n >= 10 && n <= 96
    if (unit === '%') return n >= 80 && n <= 300
    return false
  }

  function sanitizeInlineStyle(styleText: string): string {
    const out: string[] = []
    const chunks = styleText.split(';')
    for (const chunk of chunks) {
      const idx = chunk.indexOf(':')
      if (idx === -1) continue
      const prop = chunk.slice(0, idx).trim().toLowerCase()
      const value = chunk.slice(idx + 1).trim()
      if (!prop || !value) continue

      if (prop === 'text-align') {
        const v = value.toLowerCase()
        if (['left', 'center', 'right', 'justify', 'start', 'end'].includes(v)) out.push(`text-align:${v}`)
        continue
      }
      if (prop === 'color' || prop === 'background-color') {
        if (isSafeCssColor(value)) out.push(`${prop}:${value}`)
        continue
      }
      if (prop === 'font-size') {
        if (isSafeCssLength(value)) out.push(`font-size:${value}`)
        continue
      }
      if (prop === 'line-height') {
        if (isSafeLineHeight(value)) out.push(`line-height:${value}`)
        continue
      }
    }
    return out.join(';')
  }

  const allowedTags = new Set([
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
  ])

  const parser = new DOMParser()
  const doc = parser.parseFromString(trimmed, 'text/html')
  const outDoc = document.implementation.createHTMLDocument('')

  const container = outDoc.createElement('div')

  function sanitizeNode(node: Node): Node | null {
    if (node.nodeType === Node.TEXT_NODE) {
      return outDoc.createTextNode(node.textContent ?? '')
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return null

    const el = node as Element
    const tag = el.tagName.toLowerCase()

    if (!allowedTags.has(tag)) {
      if (['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta'].includes(tag)) return null
      const frag = outDoc.createDocumentFragment()
      Array.from(el.childNodes).forEach((child) => {
        const sanitized = sanitizeNode(child)
        if (sanitized) frag.appendChild(sanitized)
      })
      return frag
    }

    const outEl = outDoc.createElement(tag)

    const classAlign = Array.from(el.classList).find((c) => c.startsWith('ql-align-'))
    const alignValue = classAlign ? classAlign.slice('ql-align-'.length) : ''
    const inlineStyle = el.getAttribute('style') ?? ''
    const safeStyleParts: string[] = []
    const safeInlineStyle = inlineStyle ? sanitizeInlineStyle(inlineStyle) : ''
    if (safeInlineStyle) safeStyleParts.push(safeInlineStyle)
    if (alignValue && ['left', 'center', 'right', 'justify'].includes(alignValue.toLowerCase())) {
      if (!safeStyleParts.some((s) => /(^|;)text-align:/i.test(s))) safeStyleParts.push(`text-align:${alignValue.toLowerCase()}`)
    }
    if (safeStyleParts.length) outEl.setAttribute('style', safeStyleParts.join(';'))

    if (tag === 'a') {
      const href = el.getAttribute('href')?.trim() ?? ''
      if (href && isSafeUrlString(href)) {
        outEl.setAttribute('href', href)
        outEl.setAttribute('target', '_blank')
        outEl.setAttribute('rel', 'noopener noreferrer')
      }
    }

    if (tag === 'img') {
      const src = el.getAttribute('src')?.trim() ?? ''
      if (!src || !isSafeUrlString(src)) return null
      outEl.setAttribute('src', src)
      const alt = el.getAttribute('alt')
      if (alt) outEl.setAttribute('alt', alt)
      outEl.setAttribute('loading', 'lazy')
      outEl.setAttribute('decoding', 'async')
    }

    Array.from(el.childNodes).forEach((child) => {
      const sanitized = sanitizeNode(child)
      if (sanitized) outEl.appendChild(sanitized)
    })

    return outEl
  }

  Array.from(doc.body.childNodes).forEach((child) => {
    const sanitized = sanitizeNode(child)
    if (sanitized) container.appendChild(sanitized)
  })

  return container.innerHTML
}

const rawHtml = computed(() => {
  const o = asObject(props.blockProps) ?? {}
  return typeof o.html === 'string' ? o.html : ''
})

const safeHtml = computed(() => sanitizeRichText(rawHtml.value))
const framed = computed(() => {
  const o = asObject(props.blockProps) ?? {}
  return typeof (o as any).framed === 'boolean' ? (o as any).framed : false
})
const backgrounded = computed(() => {
  const o = asObject(props.blockProps) ?? {}
  return typeof (o as any).backgrounded === 'boolean' ? (o as any).backgrounded : false
})
</script>

<template>
  <BlockCard :framed="framed" :backgrounded="backgrounded">
    <div class="rich-text" v-html="safeHtml" />
  </BlockCard>
</template>

<style scoped>
.rich-text {
  line-height: 1.75;
  word-break: break-word;
  font-size: 14px;
  color: var(--n-text-color);
}

.rich-text :deep(p) {
  margin: 1em 0;
}

.rich-text :deep(p:first-child) { margin-top: 0; }
.rich-text :deep(p:last-child) { margin-bottom: 0; }

.rich-text :deep(strong), .rich-text :deep(b) {
  font-weight: 700;
}

.rich-text :deep(ul),
.rich-text :deep(ol) {
  margin: 1em 0;
  padding-left: 1.5em;
}

.rich-text :deep(li) {
  margin-bottom: 0.25em;
}

.rich-text :deep(a) {
  color: var(--n-primary-color);
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: all 0.2s ease;
  font-weight: 500;
}

.rich-text :deep(a:hover) {
  border-bottom-color: var(--n-primary-color);
  opacity: 0.8;
}

.rich-text :deep(img) {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 1.5em auto;
  border-radius: var(--vtsuru-page-radius);
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
}

.rich-text :deep(blockquote) {
  margin: 1.5em 0;
  padding: 0.5em 1.25em;
  border-left: 4px solid var(--n-divider-color);
  background: var(--n-action-color);
  border-radius: 4px;
  color: var(--n-text-color-2);
}

.rich-text :deep(h1),
.rich-text :deep(h2),
.rich-text :deep(h3),
.rich-text :deep(h4),
.rich-text :deep(h5),
.rich-text :deep(h6) {
  margin: 1.2em 0 0.6em;
  line-height: 1.25;
  font-weight: 750;
  letter-spacing: -0.02em;
}
.rich-text :deep(h1) { font-size: 28px; }
.rich-text :deep(h2) { font-size: 22px; }
.rich-text :deep(h3) { font-size: 18px; }
.rich-text :deep(h4) { font-size: 16px; }
.rich-text :deep(h5) { font-size: 14px; opacity: 0.95; }
.rich-text :deep(h6) { font-size: 13px; opacity: 0.9; }

.rich-text :deep(h1:first-child),
.rich-text :deep(h2:first-child),
.rich-text :deep(h3:first-child),
.rich-text :deep(h4:first-child),
.rich-text :deep(h5:first-child),
.rich-text :deep(h6:first-child) { margin-top: 0; }

.rich-text :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

.rich-text :deep(:not(pre) > code) {
  padding: 0.14em 0.4em;
  border-radius: 6px;
  background: color-mix(in srgb, var(--n-code-color) 82%, transparent);
  border: 1px solid var(--n-divider-color);
  font-size: 0.92em;
  letter-spacing: -0.01em;
  white-space: break-spaces;
}

.rich-text :deep(pre > code) {
  padding: 0;
  background: transparent;
  border: none;
  font-size: inherit;
  line-height: 1.6;
}

.rich-text :deep(pre) {
  margin: 1.5em 0;
  padding: 12px 16px;
  border-radius: var(--vtsuru-page-radius);
  background: var(--n-code-color);
  border: 1px solid var(--n-divider-color);
  overflow: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 13px;
}

.rich-text :deep(hr) {
  margin: 2em 0;
  border: none;
  border-top: 1px solid var(--n-divider-color);
}
</style>
