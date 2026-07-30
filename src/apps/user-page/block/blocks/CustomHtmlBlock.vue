<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import BlockCard from '../BlockCard.vue'
import { CUSTOM_HTML_MIN_AUTO_HEIGHT, normalizeCustomHtmlProps } from '../customHtmlContract'
import { buildCustomHtmlDocument } from '../customHtmlRuntime'
import type { CustomHtmlTheme } from '../customHtmlRuntime'

const props = defineProps<{ blockProps: unknown; theme?: CustomHtmlTheme }>()
const host = ref<HTMLElement | null>(null)
const frame = ref<HTMLIFrameElement | null>(null)
const contentHeight = ref(CUSTOM_HTML_MIN_AUTO_HEIGHT)
const themeReady = ref(Boolean(props.theme))
const detectedTheme = ref<CustomHtmlTheme>({
  fg: '#18181b',
  fgMuted: '#71717a',
  bg: '#ffffff',
  bgElevated: '#ffffff',
  border: '#e4e4e7',
  primary: '#18a058',
  radius: '8px',
  borderWidth: '1px',
  borderStyle: 'solid',
  shadow: 'none',
  colorScheme: 'light',
})
let themeObserver: MutationObserver | null = null

const config = computed(() => normalizeCustomHtmlProps(props.blockProps))
const activeTheme = computed(() => props.theme ?? detectedTheme.value)
const documentResult = computed(() => buildCustomHtmlDocument(config.value, activeTheme.value))
const iframeHeight = computed(() =>
  config.value.heightMode === 'fixed'
    ? config.value.height
    : Math.min(config.value.maxHeight, Math.max(CUSTOM_HTML_MIN_AUTO_HEIGHT, contentHeight.value)),
)

function readTheme() {
  if (!host.value) return
  const style = getComputedStyle(host.value)
  const read = (primary: string, fallback: string) =>
    style.getPropertyValue(primary).trim() || style.getPropertyValue(fallback).trim()
  const nextTheme: CustomHtmlTheme = {
    fg: read('--vtsuru-block-fg', '--vtsuru-fg') || '#18181b',
    fgMuted: read('--vtsuru-block-fg-muted', '--vtsuru-fg-muted') || '#71717a',
    bg: read('--vtsuru-block-bg', '--vtsuru-bg') || '#ffffff',
    bgElevated: read('--vtsuru-block-bg-elevated', '--vtsuru-bg-elevated') || '#ffffff',
    border: read('--vtsuru-block-border', '--vtsuru-border') || '#e4e4e7',
    primary: read('--vtsuru-page-primary', '--vtsuru-brand') || '#18a058',
    radius: read('--vtsuru-page-radius', '--vtsuru-radius') || '8px',
    borderWidth: read('--vtsuru-page-border-width', '--vtsuru-border-width') || '1px',
    borderStyle: read('--vtsuru-page-border-style', '--vtsuru-border-style') || 'solid',
    shadow: read('--vtsuru-page-shadow', '--vtsuru-shadow') || 'none',
    colorScheme: style.colorScheme || 'light',
  }
  if (
    Object.keys(nextTheme).some(
      (key) => nextTheme[key as keyof CustomHtmlTheme] !== detectedTheme.value[key as keyof CustomHtmlTheme],
    )
  ) {
    detectedTheme.value = nextTheme
  }
  themeReady.value = true
}

function handleMessage(event: MessageEvent) {
  if (event.source !== frame.value?.contentWindow || event.data?.type !== 'vtsuru-custom-html-height') return
  const height = Number(event.data.height)
  if (Number.isFinite(height) && height > 0) contentHeight.value = Math.ceil(height)
}

watch(
  () => documentResult.value.srcdoc,
  () => {
    contentHeight.value = CUSTOM_HTML_MIN_AUTO_HEIGHT
  },
)

onMounted(() => {
  readTheme()
  window.addEventListener('message', handleMessage)
  themeObserver = new MutationObserver(readTheme)
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] })
})

onBeforeUnmount(() => {
  window.removeEventListener('message', handleMessage)
  themeObserver?.disconnect()
})
</script>

<template>
  <BlockCard
    :framed="config.framed"
    :backgrounded="config.backgrounded"
    :content-style="{ padding: 0, overflow: 'hidden' }"
  >
    <div
      ref="host"
      class="custom-html-host"
    >
      <iframe
        v-if="themeReady"
        ref="frame"
        :srcdoc="documentResult.srcdoc"
        :style="{ height: `${iframeHeight}px` }"
        title="自定义内容"
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
        referrerpolicy="no-referrer"
        loading="lazy"
      />
    </div>
  </BlockCard>
</template>

<style scoped>
.custom-html-host {
  container-type: inline-size;
  width: 100%;
  min-width: 0;
}

iframe {
  display: block;
  width: 100%;
  min-height: 80px;
  border: 0;
  background: transparent;
}
</style>
