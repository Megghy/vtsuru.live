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

  const allowedTags = new Set([
    'p',
    'br',
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
  return typeof (o as any).framed === 'boolean' ? (o as any).framed : true
})
</script>

<template>
  <BlockCard :framed="framed">
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
  color: var(--n-text-color);
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
