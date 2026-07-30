import type { UserPageThemeConfig } from '../themeConfig'

export const BLOCK_TYPES = [
  'profile',
  'layout',
  'heading',
  'text',
  'richText',
  'customHtml',
  'alert',
  'links',
  'button',
  'buttons',
  'image',
  'imageGallery',
  'qrcode',
  'featureNav',
  'songList',
  'cardList',
  'checkInRanking',
  'featuredGoods',
  'videoCollect',
  'sectionNav',
  'nowPlaying',
  'embed',
  'divider',
  'spacer',
  'footer',
  'liveStatus',
  'streamSchedule',
  'biliInfo',
  'videoList',
  'socialLinks',
  'musicPlayer',
  'tags',
  'milestone',
  'faq',
  'quote',
  'marquee',
  'countdown',
  'feedback',
  'supporter',
] as const

export type BlockType = (typeof BLOCK_TYPES)[number]

export const BLOCK_PAGE_VERSION = 1 as const
export const MAX_PAGE_IMAGES = 50

export type PageBackgroundType = 'none' | 'color' | 'image'
export type PageBackgroundBlurMode = 'none' | 'background' | 'glass'
export type PageBackgroundImageFit = 'cover' | 'contain' | 'fill' | 'none'
export type PageBackgroundScrimMode = 'auto' | 'black' | 'white'
export type PageThemeMode = 'auto' | 'light' | 'dark'

export interface BlockPageTheme extends UserPageThemeConfig {
  pageBackgroundType?: PageBackgroundType
  pageBackgroundColor?: string
  pageBackgroundImageFile?: unknown
  pageBackgroundImageFit?: PageBackgroundImageFit
  pageBackgroundCoverSidebar?: boolean
  pageBackgroundBlurMode?: PageBackgroundBlurMode
  pageBackgroundBlur?: number
  pageBackgroundScrimMode?: PageBackgroundScrimMode
  pageBackgroundScrimStrength?: number
}

export interface BlockNode {
  id: string
  type: BlockType
  name?: string
  hidden?: boolean
  visibility?: BlockVisibility
  props?: unknown
}

export interface BlockVisibility {
  liveState?: 'live' | 'offline'
  device?: 'desktop' | 'mobile'
  startsAt?: number
  endsAt?: number
}

export interface BlockVisibilityContext {
  isLive: boolean
  device: 'desktop' | 'mobile'
  now: number
}

export interface BlockPageProject {
  version: typeof BLOCK_PAGE_VERSION
  theme?: BlockPageTheme
  blocks: BlockNode[]
}
