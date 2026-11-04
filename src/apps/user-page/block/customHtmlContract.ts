import type { APIFileModel } from '@/api/generated/model'

export const CUSTOM_VUE_MAX_BYTES = 512 * 1024
export const GLOBAL_CUSTOM_CSS_MAX_BYTES = 64 * 1024
export const CUSTOM_HTML_MAX_ASSETS = 100
export const CUSTOM_HTML_MIN_HEIGHT = 80
export const CUSTOM_HTML_MAX_HEIGHT = 10000
export const CUSTOM_HTML_MIN_AUTO_HEIGHT = 160
export const CUSTOM_HTML_ASSET_KEY_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/
export const CUSTOM_HTML_ALLOWED_IMPORTS = {
  vue: 'Vue',
  dayjs: 'dayjs',
  '@vueuse/core': 'VueUse',
} as const

export interface CustomHtmlAsset {
  key: string
  file: APIFileModel
}

export interface CustomHtmlProps {
  source: string
  heightMode: 'auto' | 'fixed' | 'viewport'
  height: number
  maxHeight: number
  assets: CustomHtmlAsset[]
  framed: boolean
  backgrounded: boolean
  immersive: boolean
}

export const DEFAULT_CUSTOM_VUE_SOURCE = `<script setup lang="ts">
import { onMounted, ref } from 'vue'

const ctx = ref<VtsuruPageContext | null>(null)

onMounted(async () => {
  ctx.value = await vtsuru.getContext()
})
</script>

<template>
  <section class="custom-panel">
    <h2>{{ ctx?.streamer?.name || '自定义内容' }}</h2>
    <p>用 Vue SFC 编写页面。可通过 window.vtsuru 读取公开数据并触发点歌、提问等交互。</p>
  </section>
</template>

<style>
  .custom-panel {
    padding: 24px;
    border: var(--border-width) var(--border-style) var(--border);
    border-radius: var(--radius);
    color: var(--foreground);
    background: var(--popover);
    box-shadow: var(--ui-shadow);
  }
  .custom-panel h2 {
    margin: 0 0 8px;
    font-size: 22px;
  }
  .custom-panel p {
    margin: 0;
    color: var(--muted-foreground);
  }
</style>
`

export const DEFAULT_CUSTOM_HTML_PROPS: Readonly<CustomHtmlProps> = {
  source: DEFAULT_CUSTOM_VUE_SOURCE,
  heightMode: 'auto',
  height: 320,
  maxHeight: 1200,
  assets: [],
  framed: false,
  backgrounded: false,
  immersive: false,
}

export function createDefaultCustomPageProps(): CustomHtmlProps {
  return { ...DEFAULT_CUSTOM_HTML_PROPS, assets: [], heightMode: 'viewport' }
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function boundedInteger(value: unknown, fallback: number, min: number, max: number) {
  return Number.isInteger(value) ? Math.min(max, Math.max(min, Number(value))) : fallback
}

export function normalizeCustomHtmlProps(value: unknown): CustomHtmlProps {
  const source = asObject(value) ?? {}
  const assets = Array.isArray(source.assets)
    ? source.assets.flatMap((item) => {
        const asset = asObject(item)
        const file = asObject(asset?.file)
        if (
          !asset ||
          typeof asset.key !== 'string' ||
          !file ||
          typeof file.id !== 'number' ||
          typeof file.path !== 'string'
        )
          return []
        return [{ key: asset.key, file: file as unknown as APIFileModel }]
      })
    : []

  return {
    source: typeof source.source === 'string' ? source.source : '',
    heightMode: source.heightMode === 'fixed' || source.heightMode === 'viewport' ? source.heightMode : 'auto',
    height: boundedInteger(
      source.height,
      DEFAULT_CUSTOM_HTML_PROPS.height,
      CUSTOM_HTML_MIN_HEIGHT,
      CUSTOM_HTML_MAX_HEIGHT,
    ),
    maxHeight: boundedInteger(
      source.maxHeight,
      DEFAULT_CUSTOM_HTML_PROPS.maxHeight,
      CUSTOM_HTML_MIN_AUTO_HEIGHT,
      CUSTOM_HTML_MAX_HEIGHT,
    ),
    assets,
    framed: typeof source.framed === 'boolean' ? source.framed : false,
    backgrounded: typeof source.backgrounded === 'boolean' ? source.backgrounded : false,
    immersive: typeof source.immersive === 'boolean' ? source.immersive : false,
  }
}

export function utf8ByteLength(value: string) {
  return new TextEncoder().encode(value).byteLength
}
