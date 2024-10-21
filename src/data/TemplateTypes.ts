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
  songRequestSettings: Setting_LiveRequest
  songRequestActive: SongRequestInfo[]
  data: SongsInfo[] | undefined
}
export interface SongListConfigTypeWithConfig<T> extends SongListConfigType {
  config?: T
}
export interface ScheduleConfigType {
  userInfo: UserInfo | undefined
  biliInfo: any | undefined
  data: ScheduleWeekInfo[] | undefined
}
