<script setup lang="ts">
import * as smd from 'streaming-markdown'
import { onBeforeUnmount, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  content: string
  streaming?: boolean
}>(), {
  streaming: false,
})

const root = ref<HTMLElement | null>(null)
const hrefProtocols = ['http:', 'https:', 'mailto:'] as const
const srcProtocols = ['http:', 'https:'] as const

let parser: smd.Parser | null = null
let rendered = ''
let ended = false

function resolveUrl(value: string, protocols: readonly string[]) {
  try {
    const url = new URL(value, window.location.href)
    return protocols.includes(url.protocol) ? url.href : null
  } catch {
    return null
  }
}

function normalizeLanguage(value: string) {
  const lang = value.trim().replace(/^language-/i, '')
  return /^[\w#+.-]{1,40}$/.test(lang) ? `language-${lang}` : null
}

function applyAttribute(data: smd.Default_Renderer_Data, type: smd.Attr, value: string) {
  const node = data.nodes[data.index]

  if (type === smd.Attr.Href && node instanceof HTMLAnchorElement) {
    const href = resolveUrl(value, hrefProtocols)
    if (!href) return
    node.href = href
    node.target = '_blank'
    node.rel = 'noopener noreferrer nofollow'
    return
  }

  if (type === smd.Attr.Src && node instanceof HTMLImageElement) {
    const src = resolveUrl(value, srcProtocols)
    if (!src) return
    node.src = src
    node.loading = 'lazy'
    node.decoding = 'async'
    node.referrerPolicy = 'no-referrer'
    return
  }

  if (type === smd.Attr.Lang) {
    const lang = normalizeLanguage(value)
    if (lang) node.className = lang
    return
  }

  if (type === smd.Attr.Checked && node instanceof HTMLInputElement) {
    node.checked = true
    node.setAttribute('checked', '')
    return
  }

  if (type === smd.Attr.Start && node instanceof HTMLOListElement) {
    const start = Number.parseInt(value, 10)
    if (Number.isFinite(start) && start > 0) node.start = start
  }
}

function createParser() {
  const el = root.value
  if (!el) return

  el.replaceChildren()
  const renderer = smd.default_renderer(el)
  renderer.set_attr = applyAttribute
  parser = smd.parser(renderer)
  rendered = ''
  ended = false
}

function endParser() {
  if (!parser || ended) return
  smd.parser_end(parser)
  ended = true
}

function syncMarkdown() {
  if (!root.value) return
  if (!parser || ended || !props.content.startsWith(rendered)) createParser()
  if (!parser) return

  const delta = props.content.slice(rendered.length)
  if (delta) {
    smd.parser_write(parser, delta)
    rendered = props.content
  }

  if (!props.streaming) endParser()
}

watch(
  () => [props.content, props.streaming, root.value] as const,
  syncMarkdown,
  { immediate: true, flush: 'post' },
)

onBeforeUnmount(endParser)
</script>

<template>
  <div ref="root" class="streaming-markdown" />
</template>

<style scoped>
.streaming-markdown {
  display: block;
  color: inherit;
  font-size: 14px;
  line-height: 1.65;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.streaming-markdown :deep(*) {
  box-sizing: border-box;
}

.streaming-markdown :deep(p) {
  margin: 0 0 0.55em;
}

.streaming-markdown :deep(:last-child) {
  margin-bottom: 0;
}

.streaming-markdown :deep(h1),
.streaming-markdown :deep(h2),
.streaming-markdown :deep(h3),
.streaming-markdown :deep(h4),
.streaming-markdown :deep(h5),
.streaming-markdown :deep(h6) {
  margin: 0.7em 0 0.35em;
  color: inherit;
  font-weight: 650;
  line-height: 1.35;
}

.streaming-markdown :deep(h1) { font-size: 18px; }
.streaming-markdown :deep(h2) { font-size: 16px; }
.streaming-markdown :deep(h3) { font-size: 15px; }
.streaming-markdown :deep(h4),
.streaming-markdown :deep(h5),
.streaming-markdown :deep(h6) { font-size: 14px; }

.streaming-markdown :deep(ul),
.streaming-markdown :deep(ol) {
  margin: 0.25em 0 0.65em;
  padding-left: 1.35em;
}

.streaming-markdown :deep(li) {
  margin: 0.12em 0;
  padding-left: 0.1em;
}

.streaming-markdown :deep(li > input[type="checkbox"]) {
  width: 14px;
  height: 14px;
  margin: 0 0.45em 0 -1.35em;
  vertical-align: -2px;
  accent-color: var(--vtsuru-brand, #23ade5);
}

.streaming-markdown :deep(blockquote) {
  margin: 0.55em 0;
  padding: 6px 10px;
  border-left: 3px solid var(--vtsuru-brand-tint, rgba(35, 173, 229, 0.24));
  border-radius: 0 6px 6px 0;
  background: var(--vtsuru-bg-muted, rgba(128, 128, 128, 0.08));
  color: var(--vtsuru-fg-muted, inherit);
}

.streaming-markdown :deep(a) {
  color: var(--vtsuru-brand, #23ade5);
  text-decoration: none;
}

.streaming-markdown :deep(a:hover) {
  text-decoration: underline;
}

.streaming-markdown :deep(code) {
  border: 1px solid var(--vtsuru-border, rgba(128, 128, 128, 0.18));
  border-radius: 4px;
  background: var(--vtsuru-bg-elevated, rgba(128, 128, 128, 0.08));
  color: inherit;
  font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace;
  font-size: 0.92em;
}

.streaming-markdown :deep(:not(pre) > code) {
  padding: 0.08em 0.32em;
}

.streaming-markdown :deep(pre) {
  max-width: 100%;
  margin: 0.65em 0;
  overflow: auto;
  padding: 10px 12px;
  border: 1px solid var(--vtsuru-border, rgba(128, 128, 128, 0.18));
  border-radius: 8px;
  background: var(--vtsuru-bg-elevated, rgba(128, 128, 128, 0.08));
  color: inherit;
  font-size: 13px;
  line-height: 1.55;
}

.streaming-markdown :deep(pre code) {
  display: block;
  min-width: max-content;
  padding: 0;
  border: 0;
  background: transparent;
}

.streaming-markdown :deep(table) {
  display: block;
  max-width: 100%;
  margin: 0.65em 0;
  overflow-x: auto;
  border-collapse: collapse;
  font-size: 13px;
}

.streaming-markdown :deep(th),
.streaming-markdown :deep(td) {
  padding: 6px 8px;
  border: 1px solid var(--vtsuru-border, rgba(128, 128, 128, 0.18));
  text-align: left;
}

.streaming-markdown :deep(th) {
  background: var(--vtsuru-bg-muted, rgba(128, 128, 128, 0.08));
  font-weight: 650;
}

.streaming-markdown :deep(img) {
  display: block;
  max-width: 100%;
  max-height: 260px;
  margin: 0.5em 0;
  border: 1px solid var(--vtsuru-border, rgba(128, 128, 128, 0.18));
  border-radius: 8px;
  object-fit: contain;
}

.streaming-markdown :deep(hr) {
  width: 100%;
  margin: 0.8em 0;
  border: 0;
  border-top: 1px solid var(--vtsuru-border, rgba(128, 128, 128, 0.18));
}

.streaming-markdown :deep(strong) {
  font-weight: 650;
}

.streaming-markdown :deep(equation-block) {
  display: block;
  margin: 0.55em 0;
}
</style>
