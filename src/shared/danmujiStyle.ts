import { defaultDanmujiCss } from '@/shared/config/defaultDanmujiCss'

export interface DanmujiStyle {
  preset: 'classic' | 'bubble' | 'minimal'
  opacity: number
  fontSize: number
  reverse: boolean
  autoHide: number
  pinned: boolean
  pinnedMinPrice: number
  customCss: string
}

export const defaultDanmujiStyle: DanmujiStyle = {
  preset: 'classic', opacity: 1, fontSize: 18, reverse: true,
  autoHide: 0, pinned: false, pinnedMinPrice: 30, customCss: '',
}

/** 配置文件与 URL 都是外部输入，在进入渲染器前统一校验。 */
export function normalizeDanmujiStyle(input: unknown): DanmujiStyle {
  const raw = input && typeof input === 'object' ? input as Record<string, unknown> : {}
  const style = { ...defaultDanmujiStyle }
  if (raw.preset === 'classic' || raw.preset === 'bubble' || raw.preset === 'minimal') style.preset = raw.preset
  for (const key of ['reverse', 'pinned'] as const) {
    if (typeof raw[key] === 'boolean') style[key] = raw[key]
  }
  for (const [key, min, max] of [['opacity', 0, 1], ['fontSize', 10, 72], ['autoHide', 0, 3600], ['pinnedMinPrice', 0, 100000]] as const) {
    const value = raw[key]
    if (typeof value === 'number' && Number.isFinite(value)) style[key] = Math.min(max, Math.max(min, value))
  }
  if (typeof raw.customCss === 'string') style.customCss = raw.customCss
  return style
}

const presets = {
  classic: '',
  bubble: `yt-live-chat-text-message-renderer { background: #18212ee6 !important; border: 1px solid #ffffff26; border-radius: 12px; margin: 6px 4px; padding: 10px 12px !important; }`,
  minimal: `yt-live-chat-text-message-renderer #author-photo { display: none !important; }
yt-live-chat-text-message-renderer { padding: 3px 4px !important; }
yt-live-chat-text-message-renderer #author-name { color: #b8c5d6 !important; }`,
}

export function buildDanmujiCss(style: DanmujiStyle): string {
  return `${defaultDanmujiCss}
${presets[style.preset]}
yt-live-chat-renderer { opacity: ${style.opacity}; --danmuji-font-size: ${style.fontSize}px; }
yt-live-chat-renderer #message, yt-live-chat-renderer #message *,
yt-live-chat-renderer #author-name, yt-live-chat-renderer #author-name *,
yt-live-chat-renderer #content, yt-live-chat-renderer #content *,
yt-live-chat-renderer #purchase-amount { font-size: var(--danmuji-font-size) !important; line-height: 1.4 !important; }
yt-live-chat-ticker-renderer { display: ${style.pinned ? 'block' : 'none'} !important; }
${style.customCss}`
}
