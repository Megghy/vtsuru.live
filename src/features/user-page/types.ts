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
  contrib?: ContribPageRef
  block?: BlockPageProject
}

export interface UserPagesSettingsV1 {
  version: 1
  home?: UserPageConfig
  pages?: Record<string, UserPageConfig>
}

