export const BLOCK_TYPES = [
  'profile',
  'layout',
  'heading',
  'text',
  'richText',
  'alert',
  'links',
  'button',
  'buttons',
  'image',
  'imageGallery',
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

export type BlockType = typeof BLOCK_TYPES[number]

export const BLOCK_PAGE_VERSION = 1 as const
export const MAX_PAGE_IMAGES = 50

export type PageBackgroundType = 'none' | 'color' | 'image'
export type PageBackgroundBlurMode = 'none' | 'background' | 'glass'
export type PageBackgroundImageFit = 'cover' | 'contain' | 'fill' | 'none'
export type PageBackgroundScrimMode = 'auto' | 'black' | 'white'
export type PageThemeMode = 'auto' | 'light' | 'dark'

export interface BlockPageTheme {
  primaryColor?: string
  backgroundColor?: string
  textColor?: string
  radius?: number
  spacing?: 'compact' | 'normal' | 'relaxed'
  pageMaxWidth?: string
  pageThemeMode?: PageThemeMode
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
  props?: unknown
}

export interface BlockPageProject {
  version: typeof BLOCK_PAGE_VERSION
  theme?: BlockPageTheme
  blocks: BlockNode[]
}
