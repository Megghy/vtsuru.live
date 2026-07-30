<script setup lang="ts">
import { computed } from 'vue'
import { sanitizeRichText } from '../richTextSanitizer'
import BlockCard from '../BlockCard.vue'

const props = defineProps<{ blockProps: unknown, userInfo?: unknown, biliInfo?: unknown }>()

const config = computed(() => {
  const value = props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps)
    ? props.blockProps as Record<string, unknown>
    : {}
  return {
    html: typeof value.html === 'string' ? value.html : '',
    framed: typeof value.framed === 'boolean' ? value.framed : false,
    backgrounded: typeof value.backgrounded === 'boolean' ? value.backgrounded : false,
  }
})

const safeHtml = computed(() => sanitizeRichText(config.value.html))
</script>

<template>
  <BlockCard :framed="config.framed" :backgrounded="config.backgrounded">
    <div class="rich-text" v-html="safeHtml" />
  </BlockCard>
</template>

<style scoped>
.rich-text { color: var(--vtsuru-block-fg); font-size: 14px; line-height: 1.75; overflow-wrap: anywhere; }
.rich-text :deep(p) { margin: 1em 0; }
.rich-text :deep(p:first-child) { margin-top: 0; }
.rich-text :deep(p:last-child) { margin-bottom: 0; }
.rich-text :deep(strong), .rich-text :deep(b) { font-weight: 700; }
.rich-text :deep(ul), .rich-text :deep(ol) { margin: 1em 0; padding-left: 1.5em; }
.rich-text :deep(li) { margin-bottom: 0.25em; }
.rich-text :deep(a) { color: var(--vtsuru-page-primary, var(--vtsuru-brand)); border-bottom: 1px solid transparent; font-weight: 500; text-decoration: none; transition: border-color 0.2s ease, opacity 0.2s ease; }
.rich-text :deep(a:hover) { border-bottom-color: var(--vtsuru-page-primary, var(--vtsuru-brand)); opacity: 0.8; }
.rich-text :deep(a:focus-visible) { outline: 2px solid var(--vtsuru-page-primary, var(--vtsuru-brand)); outline-offset: 2px; }
.rich-text :deep(img) { display: block; max-width: 100%; height: auto; margin: 1.5em auto; border: var(--vtsuru-page-border-width) var(--vtsuru-page-border-style) var(--vtsuru-block-border); border-radius: var(--vtsuru-page-radius); }
.rich-text :deep(blockquote) { margin: 1.5em 0; padding: 0.5em 1.25em; border-left: 4px solid var(--vtsuru-block-border); border-radius: var(--vtsuru-page-radius); color: var(--vtsuru-block-fg-muted); background: var(--vtsuru-block-bg-muted); }
.rich-text :deep(h1), .rich-text :deep(h2), .rich-text :deep(h3), .rich-text :deep(h4), .rich-text :deep(h5), .rich-text :deep(h6) { margin: 1.2em 0 0.6em; line-height: 1.25; font-weight: 750; letter-spacing: 0; }
.rich-text :deep(h1) { font-size: 28px; }
.rich-text :deep(h2) { font-size: 22px; }
.rich-text :deep(h3) { font-size: 18px; }
.rich-text :deep(h4) { font-size: 16px; }
.rich-text :deep(h5) { font-size: 14px; }
.rich-text :deep(h6) { font-size: 13px; }
.rich-text :deep(h1:first-child), .rich-text :deep(h2:first-child), .rich-text :deep(h3:first-child), .rich-text :deep(h4:first-child), .rich-text :deep(h5:first-child), .rich-text :deep(h6:first-child) { margin-top: 0; }
.rich-text :deep(code), .rich-text :deep(pre) { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
.rich-text :deep(:not(pre) > code) { padding: 0.14em 0.4em; border: var(--vtsuru-page-border-width) var(--vtsuru-page-border-style) var(--vtsuru-block-border); border-radius: var(--vtsuru-page-radius); background: var(--vtsuru-block-bg-muted); font-size: 0.92em; white-space: break-spaces; }
.rich-text :deep(pre) { margin: 1.5em 0; padding: 12px 16px; overflow: auto; border: var(--vtsuru-page-border-width) var(--vtsuru-page-border-style) var(--vtsuru-block-border); border-radius: var(--vtsuru-page-radius); background: var(--vtsuru-block-bg-muted); font-size: 13px; }
.rich-text :deep(pre > code) { padding: 0; border: 0; background: transparent; font-size: inherit; line-height: 1.6; }
.rich-text :deep(hr) { margin: 2em 0; border: 0; border-top: var(--vtsuru-page-border-width) var(--vtsuru-page-border-style) var(--vtsuru-block-border); }
@media (prefers-reduced-motion: reduce) { .rich-text :deep(a) { transition: none; } }
</style>
