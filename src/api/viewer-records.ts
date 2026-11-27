import type {
  QueueFrom,
  QueueStatus,
  ReponseVideoCollectVideo,
  ResponseAccountInfo,
  ResponseSongModel,
  ResponseUserBasicInfo,
  SongRequestFrom,
  SongRequestStatus,
  VideoStatus,
} from './generated/model'
import { vtsuruMutator } from './orval-mutator'

interface ApiEnvelope<T = undefined> {
  code: number
  message?: string
  data: T
}

export interface PaginationEnvelope<T> {
  code: number
  message?: string
  data: T
  pageNum: number
  pageSize: number
  total: number
}

export type BiliAuthExchangeAction = 'created' | 'logged_in' | 'bound'

export interface ExchangeAccountBiliAuthResponse {
  account: ResponseAccountInfo
  token: string
  action: BiliAuthExchangeAction
}

export interface MySongRequestItem {
  id: number
  target: number
  owner: ResponseUserBasicInfo
  songName: string
  song?: ResponseSongModel | null
  status: SongRequestStatus
  from: SongRequestFrom
  price?: number | null
  pointCost?: number | null
  pointRefunded: boolean
  priorityLevel: number
  createAt: number
  startSingAt?: number | null
  finishAt?: number | null
  canCancel: boolean
}

export interface MyQueueRecordItem {
  id: number
  target: number
  owner: ResponseUserBasicInfo
  status: QueueStatus
  from: QueueFrom
  content?: string | null
  giftPrice?: number | null
  pointCost?: number | null
  pointRefunded: boolean
  priorityLevel: number
  batchNo?: number | null
  createAt: number
  startAt?: number | null
  finishAt?: number | null
  canCancel: boolean
}

export interface MyVideoSubmissionItem {
  tableId: string
  shortId: string
  tableName: string
  tableFinished: boolean
  tableEndAt: number
  owner: ResponseUserBasicInfo
  video: ReponseVideoCollectVideo
  canWithdraw: boolean
}

export interface MyForumActivityItem {
  kind: 'topic' | 'comment' | 'reply'
  id: number
  forumId: number
  forumName: string
  forumOwner: ResponseUserBasicInfo
  topicId: number
  topicTitle: string
  contentPreview: string
  createAt: number
  likeCount: number
  commentCount: number
  isPinned: boolean
  isLocked: boolean
}

function buildQuery(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') search.set(k, String(v))
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

export function exchangeBiliAccount(key: string) {
  return vtsuruMutator<ApiEnvelope<ExchangeAccountBiliAuthResponse>>('/api/account/bili-auth/exchange', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key }),
  })
}

export function fetchMySongRequests(
  params: {
    pageNum?: number
    pageSize?: number
    status?: SongRequestStatus
    target?: number
    keyword?: string
  },
  headers?: Record<string, string>,
) {
  return vtsuruMutator<PaginationEnvelope<MySongRequestItem[]>>(
    `/api/live-request/my-requests${buildQuery(params)}`,
    {
      method: 'GET',
      headers,
    },
  )
}

export function fetchMyQueueRecords(
  params: {
    pageNum?: number
    pageSize?: number
    status?: QueueStatus
    target?: number
  },
  headers?: Record<string, string>,
) {
  return vtsuruMutator<PaginationEnvelope<MyQueueRecordItem[]>>(
    `/api/queue/my-records${buildQuery(params)}`,
    {
      method: 'GET',
      headers,
    },
  )
}

export function fetchMyAllVideoSubmissions(
  params: {
    pageNum?: number
    pageSize?: number
    status?: VideoStatus
  },
  headers?: Record<string, string>,
) {
  return vtsuruMutator<PaginationEnvelope<MyVideoSubmissionItem[]>>(
    `/api/video-collect/my-all-submissions${buildQuery(params)}`,
    {
      method: 'GET',
      headers,
    },
  )
}

export function fetchMyForumActivity(params: {
  type?: 'topics' | 'comments'
  pageNum?: number
  pageSize?: number
}) {
  return vtsuruMutator<PaginationEnvelope<MyForumActivityItem[]>>(
    `/api/forum/my-activity${buildQuery(params)}`,
    {
      method: 'GET',
    },
  )
}
