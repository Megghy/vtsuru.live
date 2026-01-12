<script setup lang="ts">
import { computed } from 'vue'

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
</script>

<template>
  <div class="rich-text" v-html="safeHtml" />
</template>

<style scoped>
.rich-text {
  line-height: 1.7;
  word-break: break-word;
}
.rich-text :deep(p) {
  margin: 0.6em 0;
}
.rich-text :deep(ul),
.rich-text :deep(ol) {
  margin: 0.6em 0;
  padding-left: 1.25em;
}
.rich-text :deep(a) {
  color: var(--vtsuru-page-primary);
  text-decoration: underline;
}
.rich-text :deep(img) {
  max-width: 100%;
  display: block;
  border-radius: var(--vtsuru-page-radius);
}
.rich-text :deep(pre) {
  padding: 10px 12px;
  border-radius: var(--vtsuru-page-radius);
  background: rgba(127, 127, 127, 0.12);
  overflow: auto;
}
</style>
