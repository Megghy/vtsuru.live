import type { UploadFileResponse } from '@/api/api-models'

export const CUSTOM_HTML_MAX_BYTES = 32 * 1024
export const CUSTOM_CSS_MAX_BYTES = 24 * 1024
export const CUSTOM_HTML_MAX_ASSETS = 50
export const CUSTOM_HTML_MIN_HEIGHT = 80
export const CUSTOM_HTML_MAX_HEIGHT = 1600
export const CUSTOM_HTML_MIN_AUTO_HEIGHT = 160
export const CUSTOM_HTML_ASSET_KEY_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/

export interface CustomHtmlAsset {
  key: string
  file: UploadFileResponse
}

export interface CustomHtmlProps {
  html: string
  css: string
  heightMode: 'auto' | 'fixed'
  height: number
  maxHeight: number
  assets: CustomHtmlAsset[]
  framed: boolean
  backgrounded: boolean
}

export const DEFAULT_CUSTOM_HTML_PROPS: Readonly<CustomHtmlProps> = {
  html: '<section class="custom-panel">\n  <h2>自定义内容</h2>\n  <p>在代码编辑器中修改 HTML 和 CSS。</p>\n</section>',
  css: '.custom-panel {\n  padding: 24px;\n  border: 1px solid var(--vtsuru-border);\n  border-radius: var(--vtsuru-radius);\n  color: var(--vtsuru-fg);\n  background: var(--vtsuru-bg-elevated);\n}\n\n.custom-panel h2 {\n  margin: 0 0 8px;\n  font-size: 22px;\n}\n\n.custom-panel p {\n  margin: 0;\n  color: var(--vtsuru-fg-muted);\n}',
  heightMode: 'auto',
  height: 320,
  maxHeight: 1200,
  assets: [],
  framed: false,
  backgrounded: false,
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
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
        if (!asset || typeof asset.key !== 'string' || !file || typeof file.id !== 'number' || typeof file.path !== 'string') return []
        return [{ key: asset.key, file: file as unknown as UploadFileResponse }]
      })
    : []

  return {
    html: typeof source.html === 'string' ? source.html : '',
    css: typeof source.css === 'string' ? source.css : '',
    heightMode: source.heightMode === 'fixed' ? 'fixed' : 'auto',
    height: boundedInteger(source.height, DEFAULT_CUSTOM_HTML_PROPS.height, CUSTOM_HTML_MIN_HEIGHT, CUSTOM_HTML_MAX_HEIGHT),
    maxHeight: boundedInteger(source.maxHeight, DEFAULT_CUSTOM_HTML_PROPS.maxHeight, CUSTOM_HTML_MIN_AUTO_HEIGHT, CUSTOM_HTML_MAX_HEIGHT),
    assets,
    framed: typeof source.framed === 'boolean' ? source.framed : false,
    backgrounded: typeof source.backgrounded === 'boolean' ? source.backgrounded : false,
  }
}

export function utf8ByteLength(value: string) {
  return new TextEncoder().encode(value).byteLength
}
