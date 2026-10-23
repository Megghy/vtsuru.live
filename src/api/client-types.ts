import type { DanmakuModel as ApiDanmakuModel } from './generated/model/danmakuModel'
import type { EventDataTypes } from './generated/model/eventDataTypes'
import type { EventModel as ApiEventModel } from './generated/model/eventModel'
import type { GuardLevel } from './generated/model/guardLevel'
import type { RequestPointGoodsModel } from './generated/model/requestPointGoodsModel'
import type { ResponseBasePointGoodsModel } from './generated/model/responseBasePointGoodsModel'
import type { ResponseForumCommentBaseModel } from './generated/model/responseForumCommentBaseModel'
import type { ResponsePointGoodsModel } from './generated/model/responsePointGoodsModel'
import type { ResponsePointHistoryModel } from './generated/model/responsePointHistoryModel'
import type { ResponseQueueModel as ApiQueueModel } from './generated/model/responseQueueModel'
import type { ResponseSelectedSubItemOrderInfo } from './generated/model/responseSelectedSubItemOrderInfo'
import type { ResponseSongRequestModel } from './generated/model/responseSongRequestModel'
import type { ResponseUserBasicInfo } from './generated/model/responseUserBasicInfo'
import type { SupportTicketMessageModel } from './generated/model/supportTicketMessageModel'
import type { SupportTicketModel } from './generated/model/supportTicketModel'

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

export type DanmakuModel = ApiDanmakuModel & { id?: number | string }

export type EventModel = Omit<ApiEventModel, 'id' | 'type' | 'guard_level' | 'ouId' | 'uid' | 'open_id'> & {
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

export type SongRequestInfo = ResponseSongRequestModel & { isInLocal?: boolean }
export type ResponseQueueModel = ApiQueueModel & { isInLocal?: boolean }
export type SupportTicketDetail = SupportTicketModel & { messages?: SupportTicketMessageModel[] }
export type ForumCommentModel = ResponseForumCommentBaseModel & { isDeleted?: boolean }

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

export type ResponsePointGoodModel = ResponseBasePointGoodsModel &
  Partial<
    Pick<
      ResponsePointGoodsModel,
      'content' | 'collectUrl' | 'embedCollectUrl' | 'setting' | 'serviceConfig' | 'virtualKeys' | 'keySelectionMode'
    >
  >

export type UploadPointGoodsModel = RequestPointGoodsModel & {
  maxSubItemSelections?: number | null
}

export enum ThemeType {
  Auto = 'auto',
  Light = 'light',
  Dark = 'dark',
}
