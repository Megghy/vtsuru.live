import type { ScheduleWeekInfo, Setting_LiveRequest, SongRequestInfo, SongsInfo, UserInfo } from '@/api/api-models'

export interface SongListConfigType {
  userInfo: UserInfo | undefined
  biliInfo: any | undefined
  liveRequestSettings?: Setting_LiveRequest
  liveRequestActive?: SongRequestInfo[]
  data: SongsInfo[] | undefined
  config?: any
}
export interface SongListConfigTypeWithConfig<T> extends SongListConfigType {
  config?: T
}
export interface ScheduleConfigType {
  userInfo: UserInfo | undefined
  biliInfo: any | undefined
  data: ScheduleWeekInfo[] | undefined
  /** 管理页预览使用的占位形象, 公开页不传入 */
  previewPortrait?: string
}

export interface ScheduleConfigTypeWithConfig<T> extends ScheduleConfigType {
  config?: T
}
