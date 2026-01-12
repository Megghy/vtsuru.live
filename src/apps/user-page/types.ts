import type { BlockPageProject, PageBackgroundBlurMode, PageBackgroundImageFit, PageBackgroundType } from './block/schema'

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
   * 可选：覆盖全局背景（仅对该页面生效）。
   * 字段命名与 BlockPageTheme.pageBackground* 保持一致，便于复用渲染逻辑。
   */
  background?: UserPageBackgroundConfigV1
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
