import type { BlockPageProject, PageBackgroundBlurMode, PageBackgroundImageFit, PageBackgroundType, PageThemeMode } from './block/schema'

export type UserPageRenderMode = 'legacy' | 'block' | 'contrib'

export interface ContribPageRef {
  scope: 'global' | 'streamer'
  pageId: string
  streamerId?: number
  config?: unknown
}

export interface UserPageConfig {
  mode: UserPageRenderMode
  title?: string
  description?: string
  navVisible?: boolean
  navOrder?: number
  contrib?: ContribPageRef
  block?: BlockPageProject
  /**
   * 可选：覆盖全局主题（仅对该页面生效）。
   * 当区块页 theme 未显式设置某字段时，会回退到页面/全局主题（如有）。
   */
  theme?: UserPageThemeConfigV1
  /**
   * 可选：覆盖全局背景（仅对该页面生效）。
   * 字段命名与 BlockPageTheme.pageBackground* 保持一致，便于复用渲染逻辑。
   */
  background?: UserPageBackgroundConfigV1
}

export interface UserPageThemeConfigV1 {
  primaryColor?: string
  textColor?: string
  backgroundColor?: string
  pageThemeMode?: PageThemeMode
}

export interface UserPageBackgroundConfigV1 {
  pageBackgroundType?: PageBackgroundType
  pageBackgroundColor?: string
  pageBackgroundImageFile?: unknown
  pageBackgroundImageFit?: PageBackgroundImageFit
  pageBackgroundCoverSidebar?: boolean
  pageBackgroundBlurMode?: PageBackgroundBlurMode
  pageBackgroundBlur?: number
}

export interface UserPagesSettingsV1 {
  version: 1
  /**
   * 全局主题（对所有页面生效，包括内置页面）。
   * 页面可通过 UserPageConfig.theme 覆盖此设置。
   */
  theme?: UserPageThemeConfigV1
  /**
   * 全局背景（对所有页面生效，包括内置页面）。
   * 字段命名与 BlockPageTheme.pageBackground* 保持一致，便于复用渲染逻辑。
   */
  background?: UserPageBackgroundConfigV1
  home?: UserPageConfig
  pages?: Record<string, UserPageConfig>
}

export interface UserPagesMyStateResponse {
  draftJson: string | null
  publishedJson: string | null
  rollbackJson: string | null
}
