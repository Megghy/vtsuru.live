import type { ResponseQueueModel } from './generated/model'
import { vtsuruMutator } from './orval-mutator'

interface ApiResult<T> {
  code: number
  message: string
  data: T
}

export interface QueueBatchActionResult {
  batchNo: number
  finishedIds: number[]
  started: ResponseQueueModel[]
}

export async function postApiQueueNextBatch(params?: {
  count?: number
}): Promise<ApiResult<QueueBatchActionResult>> {
  const query = params?.count && params.count > 0 ? `?count=${params.count}` : ''
  return vtsuruMutator<ApiResult<QueueBatchActionResult>>(`/api/queue/next-batch${query}`, {
    method: 'POST',
  })
}

export async function postApiQueueFinishAndNextBatch(params?: {
  count?: number
}): Promise<ApiResult<QueueBatchActionResult>> {
  const query = params?.count && params.count > 0 ? `?count=${params.count}` : ''
  return vtsuruMutator<ApiResult<QueueBatchActionResult>>(`/api/queue/finish-and-next-batch${query}`, {
    method: 'POST',
  })
}

export interface ReplaceQueueMemberPayload {
  id: number
  action?: 'cancel' | 'defer'
  refundPoint?: boolean
  pullNext?: boolean
}

export interface ReplaceQueueMemberResult {
  replacedId: number
  action: 'cancel' | 'defer'
  replacement?: ResponseQueueModel | null
}

export async function postApiQueueReplaceMember(
  payload: ReplaceQueueMemberPayload,
): Promise<ApiResult<ReplaceQueueMemberResult>> {
  return vtsuruMutator<ApiResult<ReplaceQueueMemberResult>>('/api/queue/replace-member', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export interface UpdateQueueItemPayload {
  id: number
  content?: string | null
  userName?: string | null
}

export async function postApiQueueUpdateItem(
  payload: UpdateQueueItemPayload,
): Promise<ApiResult<ResponseQueueModel>> {
  return vtsuruMutator<ApiResult<ResponseQueueModel>>('/api/queue/update-item', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function postApiQueueAddWithContent(params: {
  name: string
  content?: string
}): Promise<ApiResult<ResponseQueueModel>> {
  const search = new URLSearchParams({ name: params.name })
  if (params.content?.trim()) {
    search.set('content', params.content.trim())
  }
  return vtsuruMutator<ApiResult<ResponseQueueModel>>(`/api/queue/add?${search.toString()}`, {
    method: 'POST',
  })
}

export interface CancelQueueFromWebResult {
  id: number
  pointRefunded: boolean
  refundedAmount: number
}

export async function postApiQueueCancelFromWeb(params: {
  target: number
  id: number
}): Promise<ApiResult<CancelQueueFromWebResult>> {
  const query = new URLSearchParams({
    target: String(params.target),
    id: String(params.id),
  }).toString()
  return vtsuruMutator<ApiResult<CancelQueueFromWebResult>>(`/api/queue/cancel-from-web?${query}`, {
    method: 'POST',
  })
}
