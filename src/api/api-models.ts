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
export enum IndexTypes {
  Default,
}
export enum SongListTypes {
  Default,
}
export interface UserInfo {
  name: string
  id: number
  createAt: number
  biliId?: number
  biliRoomId?: number
  extra?: {
    enableFunctions: FunctionTypes[]
    isInBlackList: boolean
    templateTypes: { [key: string]: string }
  }
}
export interface AccountInfo extends UserInfo {
  isEmailVerified: boolean
  isBiliVerified: boolean
  biliVerifyCode?: string
  bindEmail?: string
  settings: UserSetting
  token: string

  eventFetcherOnline: boolean
  eventFetcherStatus: string

  nextSendEmailTime?: number
}
export interface Setting_SendEmail {
  recieveQA: boolean
  recieveQAReply: boolean
}
export interface Setting_QuestionBox {
  allowUnregistedUser: boolean
}
export interface UserSetting {
  sendEmail: Setting_SendEmail
  questionBox: Setting_QuestionBox
  enableFunctions: FunctionTypes[]

  indexTemplate: string | null,
  songListTemplate: string | null
  scheduleTemplate: string | null
}
export enum FunctionTypes {
  SongList,
  QuestionBox,
  Schedule,
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
  translateName?: string
  author: string[]
  url: string
  from: SongFrom
  language: SongLanguage[]
  description?: string
  tags?: string[]
  createTime: number
  updateTime: number
}
export enum SongLanguage {
  Chinese, // 中文
  English, // 英文
  Japanese, // 日文
  Spanish, // 西班牙文
  French, // 法文
  Other, //其他
}
export enum LevelTypes {
  Info,
  Success,
  Warn,
  Error,
}
export interface NotifactionInfo {
  id: string
  createTime: number
  title: string
  message: string
  type: LevelTypes
}
export interface QAInfo {
  id: number
  sender: UserInfo
  target: UserInfo
  question: { message: string; image?: string }
  answer?: { message: string; image?: string }
  isReaded?: boolean
  isSenderRegisted: boolean
  isPublic: boolean
  isFavorite: boolean
  sendAt: number
}
export interface LotteryUserInfo {
  name: string
  uId: number
  level?: number
  avatar: string
  location?: string
  isVIP?: boolean
  card?: LotteryUserCardInfo
  visiable: boolean
}
export interface LotteryUserCardInfo {
  name: string
  level: number
  guardLevel: number
  isGuard: boolean
  isCharge: boolean
}
export interface ScheduleWeekInfo {
  year: number
  week: number
  days: ScheduleDayInfo[]
}
export interface ScheduleDayInfo {
  title: string | null
  tag: string | null
  tagColor: string | null
  time: string | null
}
export enum ThemeType {
  Auto = 'auto',
  Light = 'light',
  Dark = 'dark',
}
export interface VideoCollectCreateModel {
  id?: string
  name: string
  description: string
  endAt: number
  maxVideoCount: number
}
export interface VideoCollectTable{
  id: string
  shortId: string
  name: string
  description: string
  createAt: number
  endAt: number
  isFinish: boolean
  videoCount: number
  maxVideoCount: number
  owner: UserInfo
}
export interface VideoCollectVideo {
  id: string
  title: string
  description: string
  publistTime: number
  ownerName: string
  ownerUId: number
  cover: string
  length: number
  watched?: boolean
}
export enum VideoFrom{
  Collect,
  Spam
}
export enum VideoStatus
{
    Pending,
    Accepted,
    Rejected,
}
export interface VideoSender{
  sendAt: number
  sender?: string
  senderId?: number
  description?: string
  from: VideoFrom
}
export interface VideoInfo {
  bvid: string
  senders: VideoSender[]
  status: VideoStatus
}
export interface VideoCollectDetail {
  table: VideoCollectTable
  videos: { info: VideoInfo; video: VideoCollectVideo }[]
}
