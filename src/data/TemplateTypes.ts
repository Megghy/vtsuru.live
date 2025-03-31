import {
  ScheduleWeekInfo,
  Setting_LiveRequest,
  SongRequestInfo,
  SongsInfo,
  UserInfo
} from '@/api/api-models'

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
}
