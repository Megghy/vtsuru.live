import type { BlockPageProject } from './block/schema'

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
}

export interface UserPagesSettingsV1 {
  version: 1
  home?: UserPageConfig
  pages?: Record<string, UserPageConfig>
}

export interface UserPagesMyStateResponse {
  draftJson: string | null
  publishedJson: string | null
  rollbackJson: string | null
}
