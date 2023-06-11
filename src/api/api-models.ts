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
export interface SongsInfo {
  id: string
  name: string
  author: string
  url: string
  cover: string
  from: string
  language: string
  desc: string
  tags: string[]
}
