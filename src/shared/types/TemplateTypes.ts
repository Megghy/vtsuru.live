import type { SongRequestInfo } from '@/api/client-types'
import type {
  ResponseScheduleModel,
  ResponseSongModel,
  ResponseUserInfo,
  SettingSongRequest,
} from '@/api/generated/model'
import type { BiliProfile } from '@/apps/user-page/types'

export interface SongListConfigType {
  userInfo: ResponseUserInfo | undefined
  biliInfo: BiliProfile | undefined
  liveRequestSettings?: SettingSongRequest
  liveRequestActive?: SongRequestInfo[]
  data: ResponseSongModel[] | undefined
  config?: Record<string, unknown>
}
export interface SongListConfigTypeWithConfig<T> extends Omit<SongListConfigType, 'config'> {
  config?: T
}
export interface ScheduleConfigType {
  userInfo: ResponseUserInfo | undefined
  biliInfo: BiliProfile | undefined
  data: ResponseScheduleModel[] | undefined
  /** 管理页预览使用的占位形象, 公开页不传入 */
  previewPortrait?: string
}

export interface ScheduleConfigTypeWithConfig<T> extends ScheduleConfigType {
  config?: T
}
