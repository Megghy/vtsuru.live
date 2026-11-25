import type { SongRequestInfo } from './client-types'
import type { AddSongModel, ResponseSongModel } from './generated/model'
import { vtsuruMutator } from './orval-mutator'

interface ApiResult<T> {
  code: number
  message: string
  data: T
}

export interface CancelFromWebResult {
  id: number
  pointRefunded: boolean
  refundedAmount: number
}

export async function postApiLiveRequestCancelFromWeb(
  params: { target: number; id: number },
  options?: Parameters<typeof vtsuruMutator>[1],
): Promise<ApiResult<CancelFromWebResult>> {
  const query = new URLSearchParams({
    target: String(params.target),
    id: String(params.id),
  }).toString()
  return vtsuruMutator<ApiResult<CancelFromWebResult>>(`/api/live-request/cancel-from-web?${query}`, {
    ...options,
    method: 'POST',
  })
}

export interface FinishAndNextResult {
  finishedId?: number | null
  next?: SongRequestInfo | null
}

export async function postApiLiveRequestFinishAndNext(): Promise<ApiResult<FinishAndNextResult>> {
  return vtsuruMutator<ApiResult<FinishAndNextResult>>('/api/live-request/finish-and-next', {
    method: 'POST',
  })
}

export interface UpdateLiveRequestItemPayload {
  id: number
  songName?: string | null
  songListKey?: string | null
  clearSongListKey?: boolean
}

export async function postApiLiveRequestUpdateItem(
  payload: UpdateLiveRequestItemPayload,
): Promise<ApiResult<SongRequestInfo>> {
  return vtsuruMutator<ApiResult<SongRequestInfo>>('/api/live-request/update-item', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function getApiSongListSearchNeteaseList(params: {
  keyword: string
  limit?: number
}): Promise<ApiResult<ResponseSongModel[]>> {
  const query = new URLSearchParams({
    keyword: params.keyword,
    ...(params.limit ? { limit: String(params.limit) } : {}),
  }).toString()
  return vtsuruMutator<ApiResult<ResponseSongModel[]>>(`/api/song-list/search-netease-list?${query}`, {
    method: 'GET',
  })
}

export interface UpsertSongsBatchResult {
  added: ResponseSongModel[]
  updated: ResponseSongModel[]
  skipped: number
}

export async function postApiSongListUpsertBatch(
  songs: AddSongModel[],
  params?: { updateExisting?: boolean },
): Promise<ApiResult<UpsertSongsBatchResult>> {
  const query =
    params?.updateExisting !== undefined ? `?updateExisting=${String(params.updateExisting)}` : '?updateExisting=true'
  return vtsuruMutator<ApiResult<UpsertSongsBatchResult>>(`/api/song-list/upsert-batch${query}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(songs),
  })
}

export async function postApiSongListMergeDuplicates(payload: {
  primaryKey: string
  duplicateKeys: string[]
}): Promise<ApiResult<ResponseSongModel>> {
  return vtsuruMutator<ApiResult<ResponseSongModel>>('/api/song-list/merge-duplicates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}
