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
  canRequestSong: boolean
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

  biliAuthCode?: string
  biliAuthCodeStatus: BiliAuthCodeStatusType

  eventFetcherOnline: boolean
  eventFetcherStatus: string

  nextSendEmailTime?: number
  isServerFetcherOnline:boolean
}
export enum BiliAuthCodeStatusType {
  NotBind,
  Active,
  Notfound,
  Inactive,
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
  songRequest: Setting_SongRequest
  queue: Setting_Queue
  enableFunctions: FunctionTypes[]

  indexTemplate: string | null
  songListTemplate: string | null
  scheduleTemplate: string | null
}
export interface Setting_SongRequest {
  orderPrefix: string
  onlyAllowSongList: boolean
  queueMaxSize: number
  allowAllDanmaku: boolean
  allowFromWeb: boolean
  needWearFanMedal: boolean
  needJianzhang: boolean
  needTidu: boolean
  needZongdu: boolean
  allowSC: boolean
  scIgnoreLimit: boolean
  scMinPrice: number
  fanMedalMinLevel: number
  allowReorderSong: boolean
  enableCooldown: boolean
  cooldownSecond: number
  zongduCooldownSecond: number
  tiduCooldownSecond: number
  jianzhangCooldownSecond: number
}
export interface Setting_Queue {
  keyword: string
  matchType: KeywordMatchType
  sortType?: QueueSortType
  queueMaxSize: number

  allowAllDanmaku: boolean
  allowFromWeb: boolean
  needJianzhang: boolean
  needTidu: boolean
  needZongdu: boolean
  fanMedalMinLevel?: number

  allowGift: boolean
  giftNames?: string[]
  minGiftPrice?: number
  giftFilterType: QueueGiftFilterType
  allowIncreasePaymentBySendGift: boolean
  allowIncreaseByAnyPayment: boolean

  enableCooldown: boolean
  cooldownSecond: number
  zongduCooldownSecond: number
  tiduCooldownSecond: number
  jianzhangCooldownSecond: number
}

export enum KeywordMatchType {
  Full,
  Contains,
  Regex,
}

export enum QueueSortType {
  GuardFirst,
  PaymentFist,
  TimeFirst,
}

export enum QueueGiftFilterType {
  Or,
  And,
}
export enum FunctionTypes {
  SongList,
  QuestionBox,
  Schedule,
  SongRequest,
  Queue,
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
  //paidSong: boolean
  options?: SongRequestOption
}
export interface SongRequestOption {
  needJianzhang: boolean
  needTidu: boolean
  needZongdu: boolean
  scMinPrice?: number
  fanMedalMinLevel?: number
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
export interface VideoCollectTable {
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
export enum VideoFrom {
  Collect,
  Spam,
}
export enum VideoStatus {
  Pending,
  Accepted,
  Rejected,
}
export interface VideoSender {
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
export interface GameInfo {
  game_id: string
}

export interface WebsocketInfo {
  auth_body: string
  wss_link: string[]
}

export interface AnchorInfo {
  room_id: number
  uname: string
  uface: string
  uid: number
}

export interface OpenLiveInfo {
  game_info: GameInfo
  websocket_info: WebsocketInfo
  anchor_info: AnchorInfo
}
export interface OpenLiveLotteryUserInfo {
  name: string
  uId: number
  level?: number
  avatar: string
  fans_medal_level: number
  fans_medal_name: string //粉丝勋章名
  fans_medal_wearing_status: boolean //该房间粉丝勋章佩戴情况
  guard_level: number
}
export enum OpenLiveLotteryType {
  Waiting,
  Result,
}
export interface UpdateLiveLotteryUsersModel {
  users: OpenLiveLotteryUserInfo[]
  resultUsers: OpenLiveLotteryUserInfo[]
  type: OpenLiveLotteryType
}
export interface SongRequestInfo {
  id: number
  songName: string
  song?: SongsInfo
  status: SongRequestStatus
  from: SongRequestFrom
  scPrice?: number
  user?: DanmakuUserInfo
  createAt: number
  finishAt?: number
  isInLocal?: boolean
}
export interface DanmakuUserInfo {
  name: string
  uid: number
  guard_level: number
  fans_medal_level: number
  fans_medal_name: string
  fans_medal_wearing_status: boolean
}

export enum SongRequestFrom {
  Manual,
  Danmaku,
  SC,
  Web,
}
export enum QueueFrom {
  Manual,
  Danmaku,
  Gift,
  Web,
}

export enum SongRequestStatus {
  Waiting,
  Singing,
  Finish,
  Cancel,
}
export enum QueueStatus {
  Waiting,
  Progressing,
  Finish,
  Cancel,
}
export interface EventModel {
  type: EventDataTypes
  name: string
  avatar: string
  uid: number
  msg: string
  time: number
  num: number
  price: number
  guard_level: number
  fans_medal_level: number
  fans_medal_name: string
  fans_medal_wearing_status: boolean
}
export enum EventDataTypes {
  Guard,
  SC,
  Gift,
  Message,
}
export interface ResponseQueueModel {
  id: number
  status: QueueStatus
  from: QueueFrom
  giftPrice?: number
  user?: DanmakuUserInfo
  createAt: number
  finishAt?: number | null
  isInLocal?: boolean
}
export interface ResponseLiveInfoModel {
  liveId: string
  isFinish: boolean
  parentArea: string
  area: string
  coverUrl: string
  danmakusCount: number
  startAt: number
  stopAt: number | null
  title: string
  totalIncome: number
  totalIncomeWithGuard: number
  likeCount: number
  paymentCount: number
  interactionCount: number
}
export interface DanmakuModel {
  id: string
  uId: number
  uName: string
  type: EventDataTypes // Assuming EventDataTypes is an enum or type available in your TypeScript codebase
  time: number
  msg: string | null
  price: number | null
  isEmoji: boolean
  num: number
}
export interface ResponseFeedbackModel {
  message: string
  type: FeedbackType
  status: FeedbackStatus
  replyMessage?: string
  userName?: string
  createAt: number
}
export enum FeedbackType {
  Opinion,
  Bug,
  FunctionRequest,
  Other,
}
export enum FeedbackStatus {
  Padding,
  Progressing,
  Finish,
  Todo,
  Reject,
}
