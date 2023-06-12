export interface APIRoot<T> {
  code: number
  message: string
  data: T
}
export interface PaginationResponse<T> {
  total: number
  index: number
  size: number
  hasMore: boolean
  datas: T
}
export interface UserInfo {
  name: string
  id: number
  createAt: number
  biliId?: number
  biliRoomId?: number
}
export interface AccountInfo extends UserInfo {
  isEmailVerified: boolean
  isBiliVerified: boolean
  enableFunctions: string[]
  biliVerifyCode?: string
  emailVerifyUrl?: string
}
export interface SongAuthorInfo {
  name: string
  id: number
}
export enum SongFrom {
  Custom,
  Netease,
  FiveSing,
}
export interface SongsInfo {
  id: number
  key: string
  name: string
  author: string[]
  url: string
  from: SongFrom
  language: SongLanguage[]
  description?: string
  tags?: string[]
}
export enum SongLanguage {
  Chinese, // 中文
  English, // 英文
  Japanese, // 日文
  Spanish, // 西班牙文
  French, // 法文
  Other, //其他
}
