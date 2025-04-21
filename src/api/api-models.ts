import { ExtendedDock24Filled } from '@vicons/fluent'
import { UserConsumptionSetting } from './models/consumption'

export interface APIRoot<T> {
  code: number
  message: string
  data: T
}
export interface PaginationResponse<T> extends APIRoot<T> {
  total: number
  pn: number
  ps: number
  more: boolean
}
export enum IndexTypes {
  Default
}
export enum SongListTypes {
  Default
}
export enum GuardLevel {
  None = 0,
  Zongdu = 1,
  Tidu = 2,
  Jianzhang = 3
}
export interface UserBasicInfo {
  name: string
  id: number
  isBiliAuthed: boolean
}
export interface UserInfo extends UserBasicInfo {
  createAt: number
  biliId?: number
  biliRoomId?: number
  canRequestSong: boolean
  streamerInfo?: BaseStreamerModel
  extra?: {
    enableFunctions: FunctionTypes[]
    isInBlackList: boolean
    templateTypes: { [key: string]: string }
    streamerInfo?: StreamerModel
  }
}
export interface EventFetcherStateModel {
  online: boolean
  status: { [errorCode: string]: string }
  version?: string
  todayReceive: number
  useCookie: boolean
  type: EventFetcherType
}

export enum EventFetcherType {
  Application,
  OBS,
  Tauri,
  Server
}
export interface AccountInfo extends UserInfo {
  isEmailVerified: boolean
  isBiliVerified: boolean
  biliVerifyCode?: string
  bindEmail?: string
  settings: UserSetting
  consumptionSettings: UserConsumptionSetting
  token: string
  point: number

  biliAuthCode?: string
  biliAuthCodeStatus: BiliAuthCodeStatusType

  eventFetcherState: EventFetcherStateModel

  nextSendEmailTime?: number
  isServerFetcherOnline: boolean
  blackList: UserBasicInfo[]
  biliBlackList: { [key: string]: string }
  streamerInfo?: StreamerModel
  biliUserAuthInfo?: BiliAuthModel
}
export interface BaseStreamerModel {
  name: string
  uId: number
  roomId: number
  faceUrl: string
  title: string
  coverUrl: string
  frameUrl: string
  area: string
  parentArea: string
  lastStreamAt: number
  isStreaming: boolean
}
export interface StreamerModel extends BaseStreamerModel {
  totalDanmakuCount: number
  totalIncome: number
  totalStreamCount: number
  totalStreamTime: number
  lastDanmakuCount: number
}
export enum BiliAuthCodeStatusType {
  NotBind,
  Active,
  Notfound,
  Inactive
}
export interface Setting_SendEmail {
  recieveQA: boolean
  recieveQAReply: boolean
}
export enum SaftyLevels {
  Disabled,
  Low,
  Medium,
  High
}
export interface Setting_QuestionBox {
  allowUnregistedUser: boolean

  saftyLevel: SaftyLevels
}
export interface UserSetting {
  sendEmail: Setting_SendEmail
  questionBox: Setting_QuestionBox
  songRequest: Setting_LiveRequest
  queue: Setting_Queue
  point: Setting_Point
  questionDisplay: Setting_QuestionDisplay
  index: Setting_Index

  enableFunctions: FunctionTypes[]

  indexTemplate: string | null
  songListTemplate: string | null
  scheduleTemplate: string | null
}
export interface Setting_Index {
  allowDisplayInIndex: boolean
  videos: string[]
  notification: string
  links: { [key: string]: string }
}
export interface Setting_LiveRequest {
  orderPrefix: string
  sortType?: QueueSortType
  enableOnStreaming: boolean
  onlyAllowSongList: boolean
  queueMaxSize: number
  allowAllDanmaku: boolean
  allowFromWeb: boolean
  allowAnonymousFromWeb: boolean
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

  allowGift: boolean
  giftNames?: string[]
  minGiftPrice?: number
  giftFilterType: QueueGiftFilterType
  allowIncreasePaymentBySendGift: boolean
  allowIncreaseByAnyPayment: boolean
  sendGiftIgnoreLimit: boolean

  showRequireInfo: boolean
  showUserName: boolean
  showFanMadelInfo: boolean
  obsTitle: string
  obsTitleToday: string

  isReverse: boolean
}
export interface Setting_Queue {
  keyword: string
  enableOnStreaming: boolean
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
  sendGiftDirectJoin: boolean
  sendGiftIgnoreLimit: boolean

  enableCooldown: boolean
  cooldownSecond: number
  zongduCooldownSecond: number
  tiduCooldownSecond: number
  jianzhangCooldownSecond: number

  showRequireInfo: boolean
  showPayment: boolean
  showFanMadelInfo: boolean

  isReverse: boolean
}
export interface Setting_Point {
  allowType: EventDataTypes[]
  jianzhangPoint: number // decimal maps to number in TypeScript
  tiduPoint: number // decimal maps to number in TypeScript
  zongduPoint: number // decimal maps to number in TypeScript
  giftPercentMap: { [key: string]: number } // Dictionary<string, double> maps to an index signature in TypeScript
  scPointPercent: number // double maps to number in TypeScript
  giftPointPercent: number // double maps to number in TypeScript
  giftAllowType: SettingPointGiftAllowType
}
export interface Setting_QuestionDisplay {
  font?: string // Optional string, with a maximum length of 30 characters
  nameFont: string // Optional string, with a maximum length of 30 characters
  fontSize: number // Default is 20
  fontWeight: number
  nameFontSize: number // Default is 20
  lineSpacing: number // Default is 0, 行间距
  fontColor?: string // Optional string, must exactly be 6 characters long
  nameFontColor?: string // Optional string, must exactly be 6 characters long
  nameFontWeight?: number
  backgroundColor?: string // Optional string, must exactly be 6 characters long
  showUserName: boolean // Default is true
  align: QuestionDisplayAlign // Default is QuestionDisplayAlign.Left, 对齐
  showImage: boolean // Default is false

  borderColor?: string
  borderWidth?: number
  syncScroll: boolean

  currentQuestion?: number
}

export enum QuestionDisplayAlign {
  Left,
  Right,
  Center
}
export enum SettingPointGiftAllowType {
  All,
  WhiteList
}
export enum KeywordMatchType {
  Full,
  Contains,
  Regex
}

export enum QueueSortType {
  GuardFirst,
  PaymentFist,
  TimeFirst,
  FansMedalFirst
}

export enum QueueGiftFilterType {
  Or,
  And
}
export enum FunctionTypes {
  SongList,
  QuestionBox,
  Schedule,
  SongRequest,
  Queue,
  Point,
  VideoCollect
}
export interface SongAuthorInfo {
  name: string
  id: number
}
export enum SongFrom {
  Custom,
  Netease,
  FiveSing,
  Kugou
}
export interface SongsInfo {
  id: number
  key: string
  name: string
  translateName?: string
  author: string[]
  url: string
  from: SongFrom
  language: string[]
  description?: string
  tags?: string[]
  createTime: number
  updateTime: number
  //paidSong: boolean
  options?: SongRequestOption
  cover?: string
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
  Other //其他
}
export enum LevelTypes {
  Info,
  Success,
  Warn,
  Error
}
export interface NotifactionInfo {
  id: string
  createTime: number
  title: string
  message: string
  type: LevelTypes
}
//SENSITIVE_TERM, HATE, VIOLENCE, PORNOGRAPHY, POLITICS, ADVERTISING, AGGRESSION
export enum ViolationTypes {
  SENSITIVE_TERM,
  HATE,
  VIOLENCE,
  PORNOGRAPHY,
  POLITICS,
  ADVERTISING,
  AGGRESSION
}
export type QAReviewInfo = {
  isApproved: boolean
  saftyScore: number
  violationType: ViolationTypes[]
}
export interface QAInfo {
  id: number
  sender: UserBasicInfo
  target: UserBasicInfo
  question: { message: string; image?: string }
  answer?: { message: string; image?: string, createdAt: number }
  isReaded?: boolean
  isSenderRegisted: boolean
  isPublic: boolean
  isFavorite: boolean
  sendAt: number
  isAnonymous: boolean

  tag?: string
  reviewResult?: QAReviewInfo
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
  Dark = 'dark'
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
  owner: UserBasicInfo
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
  Spam
}
export enum VideoStatus {
  Pending,
  Accepted,
  Rejected
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
  open_id: string
}

export interface OpenLiveInfo {
  game_info: GameInfo
  websocket_info: WebsocketInfo
  anchor_info: AnchorInfo
}
export interface OpenLiveLotteryUserInfo {
  name: string
  uId: number
  openId: string
  level?: number
  avatar: string
  fans_medal_level: number
  fans_medal_name: string //粉丝勋章名
  fans_medal_wearing_status: boolean //该房间粉丝勋章佩戴情况
  guard_level: number
}
export enum OpenLiveLotteryType {
  Waiting,
  Result
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
  price?: number
  user?: DanmakuUserInfo
  createAt: number
  finishAt?: number
  isInLocal?: boolean
}
export interface DanmakuUserInfo {
  name: string
  uid: number
  oid: string
  face: string
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
  Gift
}
export enum QueueFrom {
  Manual,
  Danmaku,
  Gift,
  Web
}

export enum SongRequestStatus {
  Waiting,
  Singing,
  Finish,
  Cancel
}
export enum QueueStatus {
  Waiting,
  Progressing,
  Finish,
  Cancel
}
export interface EventModel {
  type: EventDataTypes
  uname: string
  uface: string
  uid: number
  open_id: string
  msg: string
  time: number
  num: number
  price: number
  guard_level: GuardLevel
  fans_medal_level: number
  fans_medal_name: string
  fans_medal_wearing_status: boolean
  emoji?: string
  ouid: string
}
export enum EventDataTypes {
  Guard,
  SC,
  Gift,
  Message,
  Like,
  SCDel,
  Enter,
  Follow
}
export interface ResponseQueueModel {
  id: number
  status: QueueStatus
  from: QueueFrom
  giftPrice?: number
  content?: string
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
  ouId: string
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
  Other
}
export enum FeedbackStatus {
  Padding,
  Progressing,
  Finish,
  Todo,
  Reject,
  Developing
}
export interface TagInfo {
  name: string
  color: string
}
export enum GoodsStatus {
  Normal, // 商品正常
  //OutOfStock,  // 商品无货
  Discontinued // 商品下架
}
export enum GoodsTypes {
  Physical,
  Virtual
}
export interface PointGoodsSetting {
  guardFree?: { year: number; month: number }
  allowGuardLevel?: GuardLevel
}
export interface ResponsePointGoodModel {
  id: number
  name: string
  description: string
  content?: string
  count?: number
  price: number
  tags: string[]
  cover?: string
  images: string[]
  status: GoodsStatus
  type: GoodsTypes
  isAllowRebuy: boolean
  maxBuyCount?: number
  collectUrl?: string
  embedCollectUrl?: boolean

  canFreeBuy: boolean
  allowGuardLevel: GuardLevel
  setting: PointGoodsSetting
}
export interface ImageUploadModel {
  existImages: string[]
  newImagesBase64: string[]
}
export interface PointGoodsModel {
  id?: number
  name: string
  count?: number
  price: number
  tags: string[]
  cover?: ImageUploadModel
  status: GoodsStatus
  type: GoodsTypes
  collectUrl?: string
  embedCollectUrl?: boolean
  description: string
  content?: string
  isAllowRebuy: boolean
  maxBuyCount?: number

  setting: PointGoodsSetting
}
export interface AddressInfo {
  id?: string
  province: string
  city?: string
  district?: string
  street?: string
  address: string
  phone: number
  name: string
}
export interface BiliAuthBaseModel {
  id: number
  userId: number
  openId: string
  avatar: string
  name: string
  createAt: number
}
export interface BiliAuthModel extends BiliAuthBaseModel {
  address?: AddressInfo[]
  token: string
}
export interface ResponsePointUserModel {
  point: number
  orderCount: number
  isAuthed: boolean
  info: BiliAuthBaseModel
  updateAt: number
  createAt: number

  trackingNumber?: string
  expressCompany?: string
}

export interface ResponsePointOrder2OwnerModel {
  instanceOf: 'owner'
  id: number
  point: number
  type: GoodsTypes
  customer: BiliAuthModel
  address?: AddressInfo
  goodsId: number
  count: number
  createAt: number
  updateAt: number
  status: PointOrderStatus

  trackingNumber?: string
  expressCompany?: string
}

export interface ResponsePointOrder2UserModel {
  instanceOf: 'user'
  id: number
  point: number
  type: GoodsTypes
  address?: AddressInfo
  goods: ResponsePointGoodModel
  status: PointOrderStatus
  createAt: number

  trackingNumber?: string
  expressCompany?: string
}
export enum PointOrderStatus {
  Pending, // 订单正在等待处理
  Shipped, // 订单已发货
  Completed // 订单已完成
}
export interface ResponsePointHisrotyModel {
  point: number
  ouId: string
  type: EventDataTypes
  from: PointFrom
  createAt: number
  count: number

  extra?: any
}

export enum PointFrom {
  Danmaku,
  Manual,
  Use
}

export interface ResponseUserIndexModel {
  notification: string
  videos: VideoCollectVideo[]
  links: { [key: string]: string }
}
