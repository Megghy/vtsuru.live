import type { EventModel as GeneratedEventModel } from './generated/model/eventModel'
import type { ResponsePointHistoryModel } from './generated/model/responsePointHistoryModel'
import type { ResponseQueueModel as GeneratedQueueModel } from './generated/model/responseQueueModel'
import type { ResponseSongRequestModel } from './generated/model/responseSongRequestModel'
import type { SupportTicketMessageModel } from './generated/model/supportTicketMessageModel'
import type { SupportTicketModel } from './generated/model/supportTicketModel'
import type { APIFileModel } from './generated/model/aPIFileModel'
import type { DanmakuModel as GeneratedDanmakuModel } from './generated/model/danmakuModel'
import type { ResponsePointGoodsModel } from './generated/model/responsePointGoodsModel'
import type { ResponseSelectedSubItemOrderInfo } from './generated/model/responseSelectedSubItemOrderInfo'
import type { ResponseUserBasicInfo } from './generated/model/responseUserBasicInfo'

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

export type { ResponseUserBasicInfo as UserBasicInfo } from './generated/model/responseUserBasicInfo'
export type { ResponseUserInfo as UserInfo } from './generated/model/responseUserInfo'
export type { ResponseAccountInfo as AccountInfo } from './generated/model/responseAccountInfo'
export type { EventFetcherStateModel } from './generated/model/eventFetcherStateModel'
export type { LiveReserveInfo } from './generated/model/liveReserveInfo'
export type { ResponseBiliLiveReserveItem as BiliLiveReserveItem } from './generated/model/responseBiliLiveReserveItem'
export type { ResponseBiliLiveReserveModel as BiliLiveReserveModel } from './generated/model/responseBiliLiveReserveModel'
export type { StreamerBaseModel as BaseStreamerModel } from './generated/model/streamerBaseModel'
export type { StreamerModel } from './generated/model/streamerModel'
export type { SettingSendEmail as Setting_SendEmail } from './generated/model/settingSendEmail'
export type { SettingQuestionBox as Setting_QuestionBox } from './generated/model/settingQuestionBox'
export type { UserSetting } from './generated/model/userSetting'
export type { SettingIndex as Setting_Index } from './generated/model/settingIndex'
export type { SettingSongRequest as Setting_LiveRequest } from './generated/model/settingSongRequest'
export type { SettingQueue as Setting_Queue } from './generated/model/settingQueue'
export type { SettingPoint as Setting_Point } from './generated/model/settingPoint'
export type { SettingQuestionDisplay as Setting_QuestionDisplay } from './generated/model/settingQuestionDisplay'
export type { ResponseSongModel as SongsInfo } from './generated/model/responseSongModel'
export type { SongDataSongRequestOption as SongRequestOption } from './generated/model/songDataSongRequestOption'
export type { ResponseQAInfoResponseQATextReviewInfo as QAReviewInfo } from './generated/model/responseQAInfoResponseQATextReviewInfo'
export type { ResponseQAInfoToTarget as QAInfo } from './generated/model/responseQAInfoToTarget'
export type { LotteryUserInfo } from './generated/model/lotteryUserInfo'
export type { LotteryUserCardInfo } from './generated/model/lotteryUserCardInfo'
export type { ResponseScheduleModel as ScheduleWeekInfo } from './generated/model/responseScheduleModel'
export type { ResponseScheduleDayModel as ScheduleDayInfo } from './generated/model/responseScheduleDayModel'
export type { RequestAddBatchScheduleModel as BatchScheduleRequest } from './generated/model/requestAddBatchScheduleModel'
export type { RequestVideoTable as VideoCollectCreateModel } from './generated/model/requestVideoTable'
export type { ResponseVideoCollectModel as VideoCollectTable } from './generated/model/responseVideoCollectModel'
export type { VideoData as VideoCollectVideo } from './generated/model/videoData'
export type { VideoCollectInfoVideoSender as VideoSender } from './generated/model/videoCollectInfoVideoSender'
export type { VideoCollectInfo as VideoInfo } from './generated/model/videoCollectInfo'
export type { ResponseVideoCollectDetail as VideoCollectDetail } from './generated/model/responseVideoCollectDetail'
export type { OpenBLiveClientDataAppStartGameInfo as GameInfo } from './generated/model/openBLiveClientDataAppStartGameInfo'
export type { OpenBLiveClientDataAppStartWebsocketInfo as WebsocketInfo } from './generated/model/openBLiveClientDataAppStartWebsocketInfo'
export type { OpenBLiveClientDataAppStartAnchorInfo as AnchorInfo } from './generated/model/openBLiveClientDataAppStartAnchorInfo'
export type { OpenBLiveClientDataAppStartData as OpenLiveInfo } from './generated/model/openBLiveClientDataAppStartData'
export type { LiveLotteryUserInfo as OpenLiveLotteryUserInfo } from './generated/model/liveLotteryUserInfo'
export type { UpdateLiveLotteryUsersModel } from './generated/model/updateLiveLotteryUsersModel'
export type { DanmakuUserInfo } from './generated/model/danmakuUserInfo'
export type { ResponseLiveInfoModel } from './generated/model/responseLiveInfoModel'
export type { ResponseCurrentLiveModel } from './generated/model/responseCurrentLiveModel'
export type { ResponseLiveRankingEntryModel } from './generated/model/responseLiveRankingEntryModel'
export type DanmakuModel = GeneratedDanmakuModel & { id?: number | string }
export type { SupportTicketImageModel as SupportTicketImage } from './generated/model/supportTicketImageModel'
export type { SupportTicketMessageModel as SupportTicketMessage } from './generated/model/supportTicketMessageModel'
export type { CreateSupportTicketModel as CreateSupportTicketRequest } from './generated/model/createSupportTicketModel'
export type { PointGoodsDataServiceField as ServiceField } from './generated/model/pointGoodsDataServiceField'
export type { PointGoodsDataServiceConfigData as ServiceConfig } from './generated/model/pointGoodsDataServiceConfigData'
export type { RequestPointGoodsModelTempRequestGoodsSetting as PointGoodsSetting } from './generated/model/requestPointGoodsModelTempRequestGoodsSetting'
export type { ResponseSubPointGoodsModel as ResponseSubPointGoodModel } from './generated/model/responseSubPointGoodsModel'
export type { ResponseBasePointGoodsModel } from './generated/model/responseBasePointGoodsModel'
export type { ResponsePointGoodsModel } from './generated/model/responsePointGoodsModel'
export type ResponsePointGoodModel = import('./generated/model/responseBasePointGoodsModel').ResponseBasePointGoodsModel & Partial<Pick<import('./generated/model/responsePointGoodsModel').ResponsePointGoodsModel, 'content' | 'collectUrl' | 'embedCollectUrl' | 'setting' | 'serviceConfig' | 'virtualKeys' | 'keySelectionMode'>>
export type { RequestPointGoodsModelTempSubPointGoodsModel as UploadSubPointGoodsModel } from './generated/model/requestPointGoodsModelTempSubPointGoodsModel'
export type UploadPointGoodsModel = import('./generated/model/requestPointGoodsModel').RequestPointGoodsModel & {
  maxSubItemSelections?: number | null
}
export type { ShippingAddressInfo as AddressInfo } from './generated/model/shippingAddressInfo'
export type { ResponseBiliAuthBasicModel as BiliAuthBaseModel } from './generated/model/responseBiliAuthBasicModel'
export type { ResponseBiliAuthModel as BiliAuthModel } from './generated/model/responseBiliAuthModel'
export type { ResponsePointUserModel } from './generated/model/responsePointUserModel'
export type { ResponsePointGuardDuplicatePointValues } from './generated/model/responsePointGuardDuplicatePointValues'
export type { ResponsePointGuardDuplicateLevelCounts } from './generated/model/responsePointGuardDuplicateLevelCounts'
export type { ResponsePointGuardDuplicateUserModel } from './generated/model/responsePointGuardDuplicateUserModel'
export type { ResponsePointGuardDuplicateEntryModel } from './generated/model/responsePointGuardDuplicateEntryModel'
export type { ResponsePointGuardDuplicateGroupModel } from './generated/model/responsePointGuardDuplicateGroupModel'
export type { ResponsePointGuardDuplicateScanModel } from './generated/model/responsePointGuardDuplicateScanModel'
export type { ResponsePointGuardDuplicateDetailModel } from './generated/model/responsePointGuardDuplicateDetailModel'
export type { RequestPointGuardDuplicatePointValues } from './generated/model/requestPointGuardDuplicatePointValues'
export type { PointControllerRequestApplyPointGuardDuplicateFixModel as RequestApplyPointGuardDuplicateFixModel } from './generated/model/pointControllerRequestApplyPointGuardDuplicateFixModel'
export type { VTsuruCorePointGuardDuplicateApplyResult as ResponsePointGuardDuplicateApplyResult } from './generated/model/vTsuruCorePointGuardDuplicateApplyResult'
export type { ResponsePointOrder2OwnerModel } from './generated/model/responsePointOrder2OwnerModel'
export type { ResponsePointOrder2UserModel } from './generated/model/responsePointOrder2UserModel'
export type { ResponseSelectedSubItemOrderInfo }
export type { PointOrderDataServiceAnswer as ServiceAnswer } from './generated/model/pointOrderDataServiceAnswer'
export type { PointOrderDataServiceTimelineEntry as ServiceTimelineEntry } from './generated/model/pointOrderDataServiceTimelineEntry'
export type { PointOrderDataServiceOrderData as ServiceOrderData } from './generated/model/pointOrderDataServiceOrderData'
export type { ResponseUserIndexModel } from './generated/model/responseUserIndexModel'
export type { ResponseUserCheckInModel as CheckInRankingInfo } from './generated/model/responseUserCheckInModel'
export type { CheckInControllerCheckInResponse as CheckInResult } from './generated/model/checkInControllerCheckInResponse'
export type { VoteConfig } from './generated/model/voteConfig'
export type { VoteOption } from './generated/model/voteOption'
export type { VoteOptionDto } from './generated/model/voteOptionDto'
export type { ResponseVoteSession } from './generated/model/responseVoteSession'
export type { RequestCreateBulletVote } from './generated/model/requestCreateBulletVote'
export type { RequestExtendVote } from './generated/model/requestExtendVote'
export type { VoteOBSData } from './generated/model/voteOBSData'
export type { ResponseNotifaction as NotifactionInfo } from './generated/model/responseNotifaction'
export type { ResponseQAInfo } from './generated/model/responseQAInfo'

export type { APIFileModel }
export type UploadFileResponse = APIFileModel
export type SongRequestInfo = ResponseSongRequestModel & { isInLocal?: boolean }
export type ResponseQueueModel = GeneratedQueueModel & { isInLocal?: boolean }
export type EventModel = Omit<GeneratedEventModel, 'id' | 'type' | 'guard_level' | 'ouId' | 'uid' | 'open_id'> & {
  id?: number
  eventId?: string
  type: EventDataTypes
  uid: number
  open_id: string
  guard_level: GuardLevel
  ouid: string
  gift_icon?: string
  data?: unknown
}
export type SupportTicketSummary = SupportTicketModel
export type SupportTicketDetail = SupportTicketModel & { messages?: SupportTicketMessageModel[] }

export interface PointHistoryExtraBase {
  user?: ResponseUserBasicInfo
  danmaku?: DanmakuModel
  reason?: string
  goods?: ResponsePointGoodsModel | null
  isDiscontinued?: boolean
  remark?: string
  selectedSubItems?: ResponseSelectedSubItemOrderInfo[]
  interactionType?: string
}
export type ResponsePointHisrotyModel = Omit<ResponsePointHistoryModel, 'extra'> & {
  extra?: PointHistoryExtraBase
}

export interface SongAuthorInfo {
  name: string
  id: number
}
export interface ExtendedUploadFileInfo {
  id: string
  name: string
  status: 'uploading' | 'finished' | 'error' | 'removed'
  thumbnailUrl?: string
  file?: File
}
export interface ServiceOrderSummary {
  active: boolean
  appointmentAt?: number
  deliveryUrl?: string
  cancelReason?: string
}

export enum IndexTypes {
  Default,
}
export enum SongListTypes {
  Default,
}
export enum GuardLevel {
  None = 0,
  Zongdu = 1,
  Tidu = 2,
  Jianzhang = 3,
}
export enum EventFetcherType {
  Application,
  OBS,
  Tauri,
  Server,
}
export enum BiliAuthCodeStatusType {
  NotBind,
  Active,
  Notfound,
  Inactive,
}
export enum SaftyLevels {
  Disabled,
  Low,
  Medium,
  High,
}
export enum QuestionDisplayAlign {
  Left,
  Right,
  Center,
}
export enum QuestionDisplayVerticalAlign {
  Top,
  Center,
  Bottom,
}
export enum QuestionDisplayTransition {
  Fade,
  Slide,
  Scale,
  None,
}
export enum QuestionDisplayImageLayout {
  Contain,
  Grid,
}
export enum QuestionDisplayShadow {
  None,
  Soft,
  Strong,
}
export enum SettingPointGiftAllowType {
  All,
  WhiteList,
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
  FansMedalFirst,
}
export enum QueueGiftFilterType {
  Or,
  And,
}
export enum FunctionTypes {
  SongList,
  QuestionBox,
  Schedule,
  LiveRequest,
  Queue,
  Point,
  VideoCollect,
  CheckInRanking,
}
export enum SongFrom {
  Custom,
  Netease,
  FiveSing,
  Kugou,
}
export enum SongLanguage {
  Chinese,
  English,
  Japanese,
  Spanish,
  French,
  Other,
}
export enum LevelTypes {
  Info,
  Success,
  Warn,
  Error,
}
export enum ViolationTypes {
  SENSITIVE_TERM,
  HATE,
  VIOLENCE,
  PORNOGRAPHY,
  POLITICS,
  ADVERTISING,
  AGGRESSION,
}
export enum ThemeType {
  Auto = 'auto',
  Light = 'light',
  Dark = 'dark',
}
export enum DuplicateVideoPolicy {
  MergeRecommendations,
  Reject,
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
export enum OpenLiveLotteryType {
  Waiting,
  Result,
  Drawing,
}
export enum SongRequestFrom {
  Manual,
  Danmaku,
  SC,
  Web,
  Gift,
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
export enum EventDataTypes {
  Guard,
  SC,
  Gift,
  Message,
  Like,
  SCDel,
  Enter,
  Follow,
}
export enum SupportTicketType {
  Bug,
  Feature,
  Account,
  Other,
}
export enum SupportTicketStatus {
  Open,
  InProgress,
  WaitingForUser,
  Resolved,
}
export enum SupportTicketSource {
  User,
  Assistant,
}
export enum SupportTicketAuthorType {
  User,
  Staff,
  System,
}
export enum GoodsStatus {
  Normal,
  Discontinued,
}
export enum GoodsTypes {
  Physical,
  Virtual,
  Service,
}
export enum ServiceFieldType {
  Text,
  Textarea,
  Select,
  Url,
  MultiSelect,
  Date,
  Number,
}
export enum KeySelectionMode {
  None,
  Random,
  Sequential,
}
export enum PointOrderStatus {
  Pending,
  Shipped,
  Completed,
  InProgress,
  Rejected,
  Cancelled,
}
export enum ServiceTimelineActor {
  Buyer,
  Owner,
  System,
}
export enum ServiceTimelineType {
  Message,
  Status,
  Appointment,
  Delivery,
  Refund,
}
export enum PointFrom {
  Danmaku,
  Manual,
  Use,
  CheckIn,
  DailyFirstInteraction,
}
export enum VoteResultMode {
  ByCount = 0,
  ByGiftValue = 1,
}
