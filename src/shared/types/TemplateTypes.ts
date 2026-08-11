import type { ScheduleWeekInfo, Setting_LiveRequest, SongRequestInfo, SongsInfo, UserInfo } from '@/api/api-models'
import type { BiliProfile } from '@/apps/user-page/types'

export interface SongListConfigType {
  userInfo: UserInfo | undefined
  biliInfo: BiliProfile | undefined
  liveRequestSettings?: Setting_LiveRequest
  liveRequestActive?: SongRequestInfo[]
  data: SongsInfo[] | undefined
  config?: Record<string, unknown>
}
export interface SongListConfigTypeWithConfig<T> extends Omit<SongListConfigType, 'config'> {
  config?: T
}
export interface ScheduleConfigType {
  userInfo: UserInfo | undefined
  biliInfo: BiliProfile | undefined
  data: ScheduleWeekInfo[] | undefined
  /** 管理页预览使用的占位形象, 公开页不传入 */
  previewPortrait?: string
}

export interface ScheduleConfigTypeWithConfig<T> extends ScheduleConfigType {
  config?: T
}
